import { create } from 'zustand'

// History is page-level: every entry is a full snapshot of one page's
// contentHtml taken just before an operation mutates it. Stack semantics live
// here; the editor store wraps these methods with page snapshot/restore.

export interface PageSnapshot {
  contentHtml: string
}

interface HistoryState {
  undoStack: PageSnapshot[]
  redoStack: PageSnapshot[]
}

interface HistoryActions {
  pushUndo: (snapshot: PageSnapshot) => void
  popUndo: () => PageSnapshot | null
  pushRedo: (snapshot: PageSnapshot) => void
  popRedo: () => PageSnapshot | null
  reset: () => void
}

export const useHistoryStore = create<HistoryState & HistoryActions>()((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUndo: (snapshot) => set((s) => ({ undoStack: [...s.undoStack, snapshot], redoStack: [] })),
  popUndo: () => {
    const stack = get().undoStack
    if (stack.length === 0) return null
    const snap = stack[stack.length - 1]
    set({ undoStack: stack.slice(0, -1) })
    return snap
  },
  pushRedo: (snapshot) => set((s) => ({ redoStack: [...s.redoStack, snapshot] })),
  popRedo: () => {
    const stack = get().redoStack
    if (stack.length === 0) return null
    const snap = stack[stack.length - 1]
    set({ redoStack: stack.slice(0, -1) })
    return snap
  },
  reset: () => set({ undoStack: [], redoStack: [] }),
}))
