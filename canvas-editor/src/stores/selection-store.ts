import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { buildSemanticIndex, type SemanticIndexEntry } from '../utils/semantic-index'

export interface DOMNode {
  id: string
  sfId?: string | null
  tag: string
  label: string
  semanticLabel?: string | null
  component?: string | null
  role?: string | null
  variant?: string | null
  specPath?: string | null
  rect: { x: number; y: number; width: number; height: number }
  styles: Record<string, string>
  children: DOMNode[]
}

type Rect = { x: number; y: number; width: number; height: number }

export interface SelectedElement {
  label: string | null
  rect: Rect | null
  sfId?: string | null
  component?: string | null
  role?: string | null
  variant?: string | null
  specPath?: string | null
}

interface SelectionState {
  domTree: DOMNode[]
  semanticIndex: SemanticIndexEntry[]
  selectedIds: string[]
  selectedElements: Record<string, SelectedElement>
  selectedStyles: Record<string, string> | null
  hoveredId: string | null
  hoveredRect: Rect | null
}

interface SelectionActions {
  setDomTree: (tree: DOMNode[]) => void
  selectElement: (id: string | null, rect?: Rect | null, label?: string | null, multi?: boolean, meta?: Partial<SelectedElement>) => void
  updateSelectedRect: (id: string, rect: Rect) => void
  setSelectedStyles: (styles: Record<string, string>) => void
  hoverElement: (id: string | null, rect?: Rect | null) => void
  clearSelection: () => void
  resetForPageChange: () => void
  getPrimarySelectedId: () => string | null
}

export const useSelectionStore = create<SelectionState & SelectionActions>()(
  immer((set, get) => ({
    domTree: [],
    semanticIndex: [],
    selectedIds: [],
    selectedElements: {},
    selectedStyles: null,
    hoveredId: null,
    hoveredRect: null,

    setDomTree: (tree) => set((s) => {
      s.domTree = tree
      s.semanticIndex = buildSemanticIndex(tree)
    }),

    selectElement: (id, rect, label, multi, meta) => set((s) => {
      if (id === null) {
        s.selectedIds = []
        s.selectedElements = {}
        s.selectedStyles = null
        return
      }

      if (multi) {
        const idx = s.selectedIds.indexOf(id)
        if (idx >= 0) {
          s.selectedIds.splice(idx, 1)
          delete s.selectedElements[id]
          if (s.selectedIds.length === 0) s.selectedStyles = null
        } else {
          s.selectedIds.push(id)
          s.selectedElements[id] = { label: label ?? null, rect: rect ?? null, ...meta }
          s.selectedStyles = null
        }
      } else {
        s.selectedIds = [id]
        s.selectedElements = { [id]: { label: label ?? null, rect: rect ?? null, ...meta } }
        s.selectedStyles = null
      }
    }),

    updateSelectedRect: (id, rect) => set((s) => {
      if (s.selectedElements[id]) s.selectedElements[id].rect = rect
    }),

    setSelectedStyles: (styles) => set((s) => { s.selectedStyles = styles }),

    hoverElement: (id, rect) => set((s) => {
      s.hoveredId = id
      s.hoveredRect = rect ?? null
    }),

    clearSelection: () => set((s) => {
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
    }),

    resetForPageChange: () => set((s) => {
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
      s.hoveredId = null
      s.hoveredRect = null
      s.domTree = []
      s.semanticIndex = []
    }),

    getPrimarySelectedId: () => {
      const ids = get().selectedIds
      return ids.length > 0 ? ids[ids.length - 1] : null
    },
  }))
)
