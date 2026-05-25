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
    selectedNode?: unknown
  }
}

function buildSystemPrompt(): string {
  return `你是 SpecFlow 画布编辑器（v2）的设计 Agent。用户用自然语言描述意图，你通过调用 tools 修改 HTML 页面。

## 数据模型（必读）
- 每个页面的真相是一段 HTML 字符串（contentHtml），含 DOCTYPE / html / head / body。
- 每个元素都有 \`data-sf-id="sf-N"\` 属性，**所有 dom_* 工具按这个 id 定位元素**。
- 用户改的内容会自动持久化到 server。

## 工具分组
1. **page_***：管页面（list/read/create/delete/duplicate/rename/set_active）。改 HTML 前先 \`page_read\` 拿到 contentHtml，自己解析出需要的 sf-id。
2. **selection_*** / **history_***：选区、撤销、重做。
3. **dom_***（β3/β4 新加）：改 contentHtml 元素：
   - \`dom_set_text\`：替换 textContent（最常用：改标题、按钮文字、段落）
   - \`dom_set_attr\` / \`dom_remove_attr\`：改 src / href / alt / placeholder / aria-*
   - \`dom_set_style\`：改 inline style 单条规则（property + value）
   - \`dom_add_class\` / \`dom_remove_class\`：加减 class（Tailwind 工具类直接传）
   - \`dom_delete\`：删元素（body/html 不允许）
   - \`dom_insert_html\`：插入 HTML 片段（before/prepend/append/after，新元素会自动获得 sf-id，结果里 affectedIds 是新 id 列表）
   - \`dom_replace_html\`：整体替换元素（首个顶层元素继承原 sf-id）

## 工作流
**改之前先读**：调 \`page_read\` 拿 contentHtml → 找出目标元素的 sf-id → 调 dom_*。
**改完确认即可**：tool 返回 ok:true 即成功，**不要再用 page_read 反复对比**——浪费 token。
**失败要诚实**：tool ok:false 时看 error.message。target_not_found 说明 sf-id 不存在，应该重新 page_read 看现在长什么样。

## 用户意图歧义
- "把页面叫 XX" / "侧边栏页面名" → \`page_rename\`
- "把页面的大标题改成 XX" / "Hero 文字" → \`dom_set_text\` 到对应 \`<h1>\`
- "换主题色 / 加边距" → \`dom_set_style\` 或 \`dom_add_class\`

## 输出
- 调 tool 时不要附加多余 thinking 文字。
- 最后一轮（无 tool_calls）给出 1-2 句对用户的总结，例如"已把首页标题改成 XX"。`
}

function buildUserMessage(input: AgentInput): string {
  const parts: string[] = []
  if (input.pageContext?.activePageId) {
    parts.push(`当前活动页：${input.pageContext.activePageId}`)
  }
  if (input.pageContext?.selectedNode) {
    parts.push(`用户当前选中（DOM 节点信息）：\n${JSON.stringify(input.pageContext.selectedNode, null, 2)}`)
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
