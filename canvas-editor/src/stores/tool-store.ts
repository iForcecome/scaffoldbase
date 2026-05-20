import { create } from 'zustand'
import { sendBridgeMessage } from '../bridge/host'

export type Tool = 'select' | 'zoom' | 'marquee' | 'text' | 'insert' | 'preview'

interface ToolState {
  activeTool: Tool
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  editingTextId: string | null
}

interface ToolActions {
  setTool: (t: Tool) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  setEditingText: (id: string | null) => void
}

// Selection-clearing when entering preview lives in stores/coordinate.ts as a
// subscription, so tool-store stays pure data + bridge mode hand-off.
export const useToolStore = create<ToolState & ToolActions>()((set, get) => ({
  activeTool: 'select',
  leftPanelOpen: true,
  rightPanelOpen: true,
  editingTextId: null,

  setTool: (t) => {
    const wasPreview = get().activeTool === 'preview'
    const willPreview = t === 'preview'
    set({ activeTool: t })
    if (wasPreview !== willPreview) {
      sendBridgeMessage({ type: 'set-mode', mode: willPreview ? 'preview' : 'design' })
    }
  },
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setEditingText: (id) => set({ editingTextId: id }),
}))
