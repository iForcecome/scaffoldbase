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

const MAX_TURNS = 8

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

## 工具调用纪律
- 不要凭空猜测页面结构。先调 page.read 或 node.find 看清楚再改。
- 改动按粒度选 tool：换文案 → node.replace_text；改样式 → node.update_style；换 variant → node.set_variant；改 props 字段 → node.update_props；插/删/移动 → node.insert / node.remove / node.move。
- node.insert 时如果是页面级 section（顶层），target 用 page.id，position 用 inside:end。
- node.update_style 的 styles 是 camelCase 键、字符串值（如 "16px" / "#fff"）。空字符串值表示删除该样式。
- selection.set 用于"提示用户看哪里"（不破坏 schema），不要为了每次小改都换选区。

## 常用组件 (component)
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
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          content: JSON.stringify(record),
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
