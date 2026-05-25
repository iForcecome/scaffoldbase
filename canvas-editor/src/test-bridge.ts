// 仅 dev mode 下挂载到 window，给 e2e 测试调 tool。
// 通过 main.tsx 顶层 import 引入。生产构建时 import.meta.env.DEV === false，无副作用。

import { dispatchTools } from './tools'
import { useEditorStore } from './stores/editor-store'
import { useChatStore, type AgentTraceEntry } from './stores/chat-store'

declare global {
  interface Window {
    __sfTest__?: {
      dispatchTools: typeof dispatchTools
      getActiveContentHtml: () => string | null
      getActivePageId: () => string
      getPageContentHtml: (pageId: string) => string | null
      chat: {
        send: (text: string) => Promise<void>
        getState: () => {
          isStreaming: boolean
          error: string | null
          lastAssistant: string | null
          lastTrace: AgentTraceEntry[] | null
        }
      }
    }
  }
}

if (import.meta.env.DEV) {
  window.__sfTest__ = {
    dispatchTools,
    getActiveContentHtml: () => {
      const s = useEditorStore.getState()
      return s.pages.find(p => p.id === s.activePageId)?.contentHtml ?? null
    },
    getActivePageId: () => useEditorStore.getState().activePageId,
    getPageContentHtml: (pageId) => {
      const s = useEditorStore.getState()
      return s.pages.find(p => p.id === pageId)?.contentHtml ?? null
    },
    chat: {
      send: (text) => useChatStore.getState().sendMessage(text),
      getState: () => {
        const s = useChatStore.getState()
        const lastAssistant = [...s.messages].reverse().find(m => m.role === 'assistant')
        return {
          isStreaming: s.isStreaming,
          error: s.error,
          lastAssistant: lastAssistant?.content ?? null,
          lastTrace: lastAssistant?.trace ?? null,
        }
      },
    },
  }
}
