import { create } from 'zustand'
import {
  streamChat,
  extractHTML,
  buildFragmentSystemPrompt,
  buildFullPageSystemPrompt,
  buildFragmentUserPrompt,
  buildFullPageUserPrompt,
  type ChatMessage as APIChatMessage,
} from '../services/ai-service'
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

export const useChatStore = create<ChatState & ChatActions>()((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  error: null,
  abortController: null,

  sendMessage: async (text: string) => {
    const editorStore = useEditorStore.getState()
    const page = editorStore.getActivePage()
    if (!page) return

    const selectedId = editorStore.selectedId

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
      let apiMessages: APIChatMessage[]
      let isFragmentMode = false

      if (selectedId) {
        try {
          const resp = await requestFromBridge<{ html: string; tag: string; label: string }>(
            { type: 'get-element-html', id: selectedId },
            'element-html',
          )
          const cleanHtml = stripBridgeAttrs(resp.html)
          const elementInfo = { tag: resp.tag || 'div', label: resp.label || '元素' }

          apiMessages = [
            { role: 'system', content: buildFragmentSystemPrompt() },
            { role: 'user', content: buildFragmentUserPrompt(cleanHtml, text, elementInfo) },
          ]
          isFragmentMode = true
        } catch {
          apiMessages = [
            { role: 'system', content: buildFullPageSystemPrompt() },
            { role: 'user', content: buildFullPageUserPrompt(page.html, text) },
          ]
        }
      } else {
        apiMessages = [
          { role: 'system', content: buildFullPageSystemPrompt() },
          { role: 'user', content: buildFullPageUserPrompt(page.html, text) },
        ]
      }

      let fullContent = ''

      for await (const chunk of streamChat(apiMessages, abortController.signal)) {
        fullContent += chunk
        set({ streamingContent: fullContent })
      }

      const html = extractHTML(fullContent)
      let htmlApplied = false

      if (html) {
        editorStore.pushUndo()

        if (isFragmentMode && selectedId) {
          sendBridgeMessage({ type: 'replace-element-html', id: selectedId, html })

          try {
            const pageResp = await requestFromBridge<{ html: string }>(
              { type: 'get-page-html' },
              'page-html',
            )
            suppressNextIframeReload()
            editorStore.updatePageHTML(page.id, pageResp.html)
          } catch {
            // iframe sync failed but visual update already applied
          }
        } else {
          editorStore.updatePageHTML(page.id, html)
        }

        htmlApplied = true
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
