import { create } from 'zustand'
import { api } from '../services/api'
import { useEditorStore, sendBridgeMessage, requestFromBridge, suppressNextIframeReload } from './editor-store'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  htmlApplied?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent: string
  error: string | null
  abortController: AbortController | null
}

interface ChatActions {
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => void
  clearMessages: () => void
  clearError: () => void
}

function stripBridgeAttrs(html: string): string {
  return html.replace(/\s*data-sf-id="[^"]*"/g, '')
}

interface SSEEvent {
  type: 'chunk' | 'applied' | 'done' | 'error'
  content?: string
  html?: string
  mode?: 'diff' | 'fragment'
  message?: string
}

async function* parseSSE(response: Response, signal?: AbortSignal): AsyncGenerator<SSEEvent> {
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
          yield JSON.parse(trimmed.slice(6)) as SSEEvent
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
  error: null,
  abortController: null,

  sendMessage: async (text: string) => {
    const editorStore = useEditorStore.getState()
    const page = editorStore.getActivePage()
    if (!page || !editorStore.projectId) return

    const selectedIds = editorStore.selectedIds
    const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null

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
      error: null,
      abortController,
    }))

    try {
      let elementHtml: string | undefined
      let elementId: string | undefined
      let fragmentId: string | undefined

      if (selectedId) {
        try {
          const resp = await requestFromBridge<{ html: string; tag: string; label: string }>(
            { type: 'get-element-html', id: selectedId },
            'element-html',
          )
          elementHtml = stripBridgeAttrs(resp.html)
          elementId = selectedId
          fragmentId = selectedId
        } catch {
          // fall through to full-page mode
        }
      }

      const response = await api.chat.stream(
        editorStore.projectId,
        { message: text, pageId: page.id, elementHtml, elementId },
        abortController.signal,
      )

      if (!response.ok) {
        const errBody = await response.text()
        throw new Error(`API ${response.status}: ${errBody}`)
      }

      let fullContent = ''
      let htmlApplied = false

      for await (const event of parseSSE(response, abortController.signal)) {
        switch (event.type) {
          case 'chunk':
            fullContent += event.content ?? ''
            set({ streamingContent: fullContent })
            break

          case 'applied':
            if (event.html) {
              editorStore.pushUndo()
              if (event.mode === 'fragment' && fragmentId) {
                sendBridgeMessage({ type: 'replace-element-html', id: fragmentId, html: event.html })
                try {
                  const pageResp = await requestFromBridge<{ html: string }>(
                    { type: 'get-page-html' },
                    'page-html',
                  )
                  suppressNextIframeReload()
                  editorStore.updatePageHTML(page.id, pageResp.html)
                } catch {
                  // visual update already applied via bridge
                }
              } else {
                editorStore.updatePageHTML(page.id, event.html)
              }
              htmlApplied = true
            }
            break

          case 'error':
            throw new Error(event.message || '服务端错误')

          case 'done':
            break
        }
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        htmlApplied,
      }

      set(s => ({
        messages: [...s.messages, assistantMsg],
        isStreaming: false,
        streamingContent: '',
        abortController: null,
      }))
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        set({ isStreaming: false, streamingContent: '', abortController: null })
        return
      }
      set({
        isStreaming: false,
        streamingContent: '',
        error: (err as Error).message || '请求失败',
        abortController: null,
      })
    }
  },

  stopStreaming: () => {
    const { abortController } = get()
    abortController?.abort()
    set({ isStreaming: false, streamingContent: '', abortController: null })
  },

  clearMessages: () => set({ messages: [], error: null }),
  clearError: () => set({ error: null }),
}))
