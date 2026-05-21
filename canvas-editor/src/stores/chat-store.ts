import { create } from 'zustand'
import { api } from '../services/api'
import { useEditorStore } from './editor-store'
import { useSelectionStore } from './selection-store'
import { dispatchTools } from '../tools'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  /** Agent 执行轨迹，给用户看 "AI 做了哪些步骤" */
  trace?: AgentTraceEntry[]
}

export interface AgentTraceEntry {
  turn: number
  /** turn 完成时的摘要，如 "3 tool call(s)" 或 "final" */
  summary: string
  /** 这一 turn 调用的所有 tool */
  toolCalls?: Array<{
    name: string
    callId: string
    ok: boolean
    error?: string
  }>
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  /** 当前 run 的 trace，turn-by-turn 累加 */
  streamingTrace: AgentTraceEntry[]
  error: string | null
  abortController: AbortController | null
}

interface ChatActions {
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => void
  clearMessages: () => void
  clearError: () => void
}

interface AgentSSEEvent {
  type: 'run_started' | 'text' | 'tool_request' | 'step' | 'done' | 'error'
  runId?: string
  text?: string
  callId?: string
  name?: string
  params?: unknown
  turn?: number
  summary?: string
  message?: string
}

async function* parseAgentSSE(response: Response, signal?: AbortSignal): AsyncGenerator<AgentSSEEvent> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        try {
          yield JSON.parse(trimmed.slice(6)) as AgentSSEEvent
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const useChatStore = create<ChatState & ChatActions>()((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  streamingTrace: [],
  error: null,
  abortController: null,

  sendMessage: async (text: string) => {
    const editorStore = useEditorStore.getState()
    const selectionStore = useSelectionStore.getState()
    const page = editorStore.getActivePage()
    if (!page || !editorStore.projectId) return

    const selectedId = selectionStore.selectedIds[selectionStore.selectedIds.length - 1] ?? null
    const selectedElement = selectedId ? selectionStore.selectedElements[selectedId] : null

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    const abortController = new AbortController()

    set(s => ({
      messages: [...s.messages, userMsg],
      isStreaming: true,
      streamingContent: '',
      streamingTrace: [],
      error: null,
      abortController,
    }))

    let runId: string | null = null
    let fullText = ''
    const trace: AgentTraceEntry[] = []
    // 累积每一 turn 期间的 tool 调用结果，准备塞进对应 trace entry
    const pendingToolCallsByTurn = new Map<number, AgentTraceEntry['toolCalls']>()
    let currentTurn = 0

    try {
      const response = await api.agent.start(
        editorStore.projectId,
        {
          message: text,
          pageId: page.id,
          pageSchema: page.schema ?? undefined,
          selectedNode: selectedElement
            ? {
                id: selectedId,
                label: selectedElement.label,
                component: selectedElement.component,
                role: selectedElement.role,
                variant: selectedElement.variant,
                specPath: selectedElement.specPath,
              }
            : undefined,
        },
        abortController.signal,
      )

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Agent ${response.status}: ${body}`)
      }

      for await (const event of parseAgentSSE(response, abortController.signal)) {
        switch (event.type) {
          case 'run_started':
            runId = event.runId ?? null
            break

          case 'text':
            if (event.text) {
              fullText += event.text
              set({ streamingContent: fullText })
            }
            break

          case 'step':
            currentTurn = event.turn ?? currentTurn + 1
            trace.push({
              turn: currentTurn,
              summary: event.summary ?? '',
              toolCalls: pendingToolCallsByTurn.get(currentTurn) ?? [],
            })
            set({ streamingTrace: [...trace] })
            break

          case 'tool_request': {
            if (!runId || !event.callId || !event.name) break
            // dispatch 本地工具
            const dispatchResult = await dispatchTools([{
              callId: event.callId,
              name: event.name,
              params: (event.params as Record<string, unknown>) ?? {},
            }])
            const r = dispatchResult.results[0]
            // 记到 pending（本 turn 还没来 step 事件之前先攒着）
            const turnBucket = pendingToolCallsByTurn.get(currentTurn + 1) ?? []
            turnBucket.push({
              name: event.name,
              callId: event.callId,
              ok: r?.ok ?? false,
              error: r?.error?.message,
            })
            pendingToolCallsByTurn.set(currentTurn + 1, turnBucket)
            // 报告回服务端
            await api.agent.submitToolResult(editorStore.projectId, {
              runId,
              callId: event.callId,
              name: event.name,
              ok: r?.ok ?? false,
              data: r?.data,
              error: r?.error,
            })
            break
          }

          case 'error':
            throw new Error(event.message || 'Agent 错误')

          case 'done':
            break
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullText || '已完成。',
        timestamp: Date.now(),
        trace: trace.length > 0 ? trace : undefined,
      }

      set(s => ({
        messages: [...s.messages, assistantMsg],
        isStreaming: false,
        streamingContent: '',
        streamingTrace: [],
        abortController: null,
      }))
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        set({ isStreaming: false, streamingContent: '', streamingTrace: [], abortController: null })
        return
      }
      set({
        isStreaming: false,
        streamingContent: '',
        streamingTrace: [],
        error: (err as Error).message || '请求失败',
        abortController: null,
      })
    }
  },

  stopStreaming: () => {
    const { abortController } = get()
    abortController?.abort()
    set({ isStreaming: false, streamingContent: '', streamingTrace: [], abortController: null })
  },

  clearMessages: () => set({ messages: [], error: null }),
  clearError: () => set({ error: null }),
}))
