// Server-side agent loop: 把用户意图翻译成 tool 调用序列。
//
// 设计简化：
// - 每轮调 AI 是非流式（拿完整响应再处理）；流式 tool_use 是 v2 优化
// - 用 OpenAI Chat Completions tools API（也兼容大多数 OpenAI-compatible 服务）
// - 最多 8 轮（防 AI 死循环）

import { env } from '../env.js'
import { TOOL_DEFS, TOOL_NAMES } from './agent-tools-schema.js'
import {
  awaitToolResult,
  closeRun,
  createRun,
  getRun,
  type ToolResultRecord,
} from './agent-runs.js'

const MAX_TURNS = 16

interface AssistantToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

interface ChatMessage {
  role: ChatRole
  content: string | null
  name?: string
  tool_calls?: AssistantToolCall[]
  tool_call_id?: string
}

export interface AgentEmit {
  text: (text: string) => void
  toolRequest: (callId: string, name: string, params: unknown) => void
  step: (info: { turn: number; summary: string }) => void
  error: (message: string) => void
  done: () => void
}

export interface AgentInput {
  projectId: string
  userMessage: string
  pageContext?: {
    activePageId?: string
    pageSchema?: unknown
    selectedNode?: unknown
  }
}

function buildSystemPrompt(): string {
  return `你是 SpecFlow 画布编辑器的设计 Agent。用户用自然语言描述意图，你通过调用 tools 完成任务。

## 工具结果如何理解
- tool 返回 ok:true 即成功，**不要再调用其他 tool 反复验证**。改完直接给用户总结。
- tool 返回 ok:false 时，看 error.message 知道哪步错；不要换工具反复试同一件事。
- 如果用户要改"某个组件的某个字段"，**用 1 个 tool 就够**：node_update_props 改 props，node_replace_text 改文案。**不要先 read 再 update**——多余。
- 节点 id 已经在用户消息附带的 pageSchema 里，直接用，不要先调 node_find 或 page_read 确认 id。

## 工具粒度选择
- 换文字（标题/描述/按钮文案）→ node_replace_text（target 可用 "nodeId.title" / "nodeId.description"），或 node_update_props（props 写完整字段）
- 改样式 → node_update_style（camelCase 键、字符串值如 "16px"；空字符串表示删除该样式）
- 换变体 → node_set_variant
- 插入/删除/移动节点 → node_insert / node_remove / node_move
- 改页面级背景/边距 → node_update_style，nodeId 传 page.id
- 改页面标题（浏览器标签）→ page_rename，**不是** node_update_props（PageHeader 的 title 是组件 prop，不是页面 title）

## 常用组件
PageHeader / FilterBar / DataTable / Section / FormSection / Modal / EmptyState / Navigation / Region / Button

variant 常见值：default / primary / compact / spacious

## 输出
- 调 tool 时不要附加多余 thinking 文字。
- 最后一轮（无 tool_calls）给出 1-2 句对用户的总结。`
}

function buildUserMessage(input: AgentInput): string {
  const parts: string[] = []
  if (input.pageContext?.activePageId) {
    parts.push(`当前活动页：${input.pageContext.activePageId}`)
  }
  if (input.pageContext?.selectedNode) {
    parts.push(`用户当前选中：\n${JSON.stringify(input.pageContext.selectedNode, null, 2)}`)
  }
  if (input.pageContext?.pageSchema) {
    parts.push(`当前页 schema 摘要：\n\`\`\`json\n${JSON.stringify(input.pageContext.pageSchema, null, 2)}\n\`\`\``)
  }
  parts.push(`用户指令：${input.userMessage}`)
  return parts.join('\n\n')
}

interface ChatCompletionChoice {
  finish_reason: 'stop' | 'tool_calls' | 'length' | string
  message: {
    role: 'assistant'
    content: string | null
    tool_calls?: AssistantToolCall[]
  }
}

interface ChatCompletionResponse {
  choices: ChatCompletionChoice[]
}

async function callAI(
  messages: ChatMessage[],
  signal: AbortSignal,
): Promise<ChatCompletionChoice> {
  const apiKey = env.AI_API_KEY
  if (!apiKey) throw new Error('AI_API_KEY not configured')

  const res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      tools: TOOL_DEFS,
      tool_choice: 'auto',
      temperature: 0.3,
      stream: false,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API error (${res.status}): ${text}`)
  }

  const data = (await res.json()) as ChatCompletionResponse
  const choice = data.choices?.[0]
  if (!choice) throw new Error('AI returned no choices')
  return choice
}

function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function runAgent(
  runId: string,
  input: AgentInput,
  emit: AgentEmit,
  signal: AbortSignal,
): Promise<void> {
  const run = getRun(runId)
  if (!run) {
    emit.error(`Run ${runId} not found`)
    return
  }
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserMessage(input) },
  ]

  try {
    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      if (signal.aborted) return

      const choice = await callAI(messages, signal)
      const assistantText = choice.message.content ?? ''
      const toolCalls = choice.message.tool_calls ?? []

      if (assistantText) emit.text(assistantText)
      emit.step({ turn, summary: toolCalls.length > 0 ? `${toolCalls.length} tool call(s)` : 'final' })

      // 把 assistant 这轮加入历史（即便没 tool_calls 也要加，下一轮才看得到）
      messages.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      })

      if (toolCalls.length === 0) {
        emit.done()
        return
      }

      // 校验 tool 名都在白名单
      for (const call of toolCalls) {
        if (!TOOL_NAMES.has(call.function.name)) {
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ ok: false, error: { code: 'unknown_tool', message: `Tool ${call.function.name} 不存在` } }),
          })
          continue
        }
      }

      // 发请求给 client、等结果
      const pendingCallIds: string[] = []
      for (const call of toolCalls) {
        if (!TOOL_NAMES.has(call.function.name)) continue
        const params = parseToolArguments(call.function.arguments)
        emit.toolRequest(call.id, call.function.name, params)
        pendingCallIds.push(call.id)
      }

      // 并行等所有结果
      const results = await Promise.allSettled(
        pendingCallIds.map(callId => awaitToolResult(run, callId)),
      )

      for (let i = 0; i < pendingCallIds.length; i++) {
        const callId = pendingCallIds[i]
        const settled = results[i]
        const record: ToolResultRecord = settled.status === 'fulfilled'
          ? settled.value
          : {
              callId,
              name: toolCalls.find(c => c.id === callId)?.function.name ?? 'unknown',
              ok: false,
              error: { code: 'tool_wait_failed', message: settled.reason?.message ?? String(settled.reason) },
            }
        const content = JSON.stringify(record)
        // 把 AI 看到的 tool_result 打出来，方便排查"为什么 AI 反复试"
        // eslint-disable-next-line no-console
        console.log(`[agent turn ${turn}] tool=${record.name} ok=${record.ok}${record.ok ? '' : ` err=${record.error?.message}`} ${content.length > 240 ? content.slice(0, 240) + '...' : content}`)
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content,
        })
      }
    }

    emit.error(`Agent loop exceeded MAX_TURNS (${MAX_TURNS})`)
  } catch (err) {
    emit.error(err instanceof Error ? err.message : String(err))
  } finally {
    closeRun(runId)
  }
}

/** 路由层调用：先建 run、拿 runId 发给 client，再调 runAgent */
export function startRun(projectId: string) {
  return createRun(projectId)
}

export { closeRun, submitToolResult } from './agent-runs.js'
export type { ToolResultRecord } from './agent-runs.js'
