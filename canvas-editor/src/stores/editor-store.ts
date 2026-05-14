import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { mockPages } from '../data/mock-pages'

export interface DOMNode {
  id: string
  tag: string
  label: string
  rect: { x: number; y: number; width: number; height: number }
  styles: Record<string, string>
  children: DOMNode[]
}

export interface Page {
  id: string
  title: string
  html: string
}

export type Device = 'desktop' | 'tablet' | 'mobile'

const DEVICE_WIDTHS: Record<Device, number> = {
  desktop: 1080,
  tablet: 768,
  mobile: 375,
}

export type Tool = 'select' | 'zoom' | 'marquee' | 'text' | 'insert' | 'preview'

type Rect = { x: number; y: number; width: number; height: number }

export interface SelectedElement {
  label: string | null
  rect: Rect | null
}

interface EditorState {
  pages: Page[]
  activePageId: string
  domTree: DOMNode[]
  selectedIds: string[]
  selectedElements: Record<string, SelectedElement>
  selectedStyles: Record<string, string> | null
  hoveredId: string | null
  hoveredRect: Rect | null
  viewport: { x: number; y: number; zoom: number }
  device: Device
  activeTool: Tool
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  iframeHeight: number
  undoStack: string[]
  redoStack: string[]
}

interface EditorActions {
  setActivePage: (id: string) => void
  setDomTree: (tree: DOMNode[]) => void
  selectElement: (id: string | null, rect?: Rect | null, label?: string | null, multi?: boolean) => void
  updateSelectedRect: (id: string, rect: Rect) => void
  setSelectedStyles: (styles: Record<string, string>) => void
  hoverElement: (id: string | null, rect?: Rect | null) => void
  setViewport: (v: Partial<EditorState['viewport']>) => void
  zoomTo: (zoom: number) => void
  setDevice: (d: Device) => void
  setTool: (t: Tool) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  updatePageHTML: (pageId: string, html: string) => void
  pushUndo: () => void
  undo: () => void
  redo: () => void
  setIframeHeight: (h: number) => void
  getDeviceWidth: () => number
  getActivePage: () => Page | undefined
  getPrimarySelectedId: () => string | null
  addPage: () => void
  deletePage: (id: string) => void
  duplicatePage: (id: string) => void
  renamePage: (id: string, title: string) => void
}

let _bridgeSender: ((msg: Record<string, unknown>) => void) | null = null

export function setBridgeSender(fn: (msg: Record<string, unknown>) => void) {
  _bridgeSender = fn
}

export function sendBridgeMessage(msg: Record<string, unknown>) {
  _bridgeSender?.(msg)
}

let _suppressIframeReload = false
export function suppressNextIframeReload() { _suppressIframeReload = true }
export function consumeSuppressReload(): boolean {
  if (_suppressIframeReload) { _suppressIframeReload = false; return true }
  return false
}

export function requestFromBridge<T = Record<string, unknown>>(
  msg: Record<string, unknown>,
  responseType: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error(`Bridge timeout waiting for "${responseType}"`))
    }, timeoutMs)

    const handler = (e: MessageEvent) => {
      if (e.data?.type === responseType) {
        clearTimeout(timer)
        window.removeEventListener('message', handler)
        resolve(e.data as T)
      }
    }
    window.addEventListener('message', handler)
    sendBridgeMessage(msg)
  })
}

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    pages: mockPages,
    activePageId: mockPages[0].id,
    domTree: [],
    selectedIds: [],
    selectedElements: {},
    selectedStyles: null,
    hoveredId: null,
    hoveredRect: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    device: 'desktop',
    activeTool: 'select',
    leftPanelOpen: true,
    rightPanelOpen: true,
    iframeHeight: 800,
    undoStack: [],
    redoStack: [],

    setActivePage: (id) => set((s) => {
      s.activePageId = id
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
      s.hoveredId = null
      s.hoveredRect = null
      s.domTree = []
      s.viewport = { x: 0, y: 0, zoom: 1 }
    }),

    setDomTree: (tree) => set((s) => { s.domTree = tree }),

    selectElement: (id, rect, label, multi) => set((s) => {
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
          if (s.selectedIds.length === 0) {
            s.selectedStyles = null
          }
        } else {
          s.selectedIds.push(id)
          s.selectedElements[id] = { label: label ?? null, rect: rect ?? null }
          s.selectedStyles = null
        }
      } else {
        s.selectedIds = [id]
        s.selectedElements = { [id]: { label: label ?? null, rect: rect ?? null } }
        s.selectedStyles = null
      }
    }),

    updateSelectedRect: (id, rect) => set((s) => {
      if (s.selectedElements[id]) {
        s.selectedElements[id].rect = rect
      }
    }),

    setSelectedStyles: (styles) => set((s) => { s.selectedStyles = styles }),

    hoverElement: (id, rect) => set((s) => {
      s.hoveredId = id
      s.hoveredRect = rect ?? null
    }),

    setViewport: (v) => set((s) => {
      Object.assign(s.viewport, v)
    }),

    zoomTo: (zoom) => set((s) => {
      s.viewport.zoom = Math.max(0.1, Math.min(3, zoom))
    }),

    setDevice: (d) => set((s) => {
      s.device = d
      s.viewport = { x: 0, y: 0, zoom: 1 }
    }),

    setIframeHeight: (h) => set((s) => { s.iframeHeight = Math.max(768, h) }),
    setTool: (t) => set((s) => {
      const wasPreview = s.activeTool === 'preview'
      const willPreview = t === 'preview'
      s.activeTool = t
      if (willPreview) {
        s.selectedIds = []
        s.selectedElements = {}
        s.selectedStyles = null
        s.hoveredId = null
        s.hoveredRect = null
      }
      if (wasPreview !== willPreview) {
        sendBridgeMessage({ type: 'set-mode', mode: willPreview ? 'preview' : 'design' })
      }
    }),
    toggleLeftPanel: () => set((s) => { s.leftPanelOpen = !s.leftPanelOpen }),
    toggleRightPanel: () => set((s) => { s.rightPanelOpen = !s.rightPanelOpen }),

    updatePageHTML: (pageId, html) => set((s) => {
      const page = s.pages.find(p => p.id === pageId)
      if (page) page.html = html
    }),

    pushUndo: () => set((s) => {
      const page = s.pages.find(p => p.id === s.activePageId)
      if (page) {
        s.undoStack.push(page.html)
        s.redoStack = []
      }
    }),

    undo: () => set((s) => {
      if (s.undoStack.length === 0) return
      const page = s.pages.find(p => p.id === s.activePageId)
      if (!page) return
      s.redoStack.push(page.html)
      page.html = s.undoStack.pop()!
    }),

    redo: () => set((s) => {
      if (s.redoStack.length === 0) return
      const page = s.pages.find(p => p.id === s.activePageId)
      if (!page) return
      s.undoStack.push(page.html)
      page.html = s.redoStack.pop()!
    }),

    getDeviceWidth: () => DEVICE_WIDTHS[get().device],
    getActivePage: () => get().pages.find(p => p.id === get().activePageId),
    getPrimarySelectedId: () => {
      const ids = get().selectedIds
      return ids.length > 0 ? ids[ids.length - 1] : null
    },

    addPage: () => set((s) => {
      const id = 'page-' + Date.now()
      s.pages.push({
        id,
        title: '新页面',
        html: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script src="https://cdn.tailwindcss.com"><\/script></head><body class="bg-white p-8"><h1 class="text-2xl font-bold">新页面</h1></body></html>',
      })
      s.activePageId = id
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
    }),

    deletePage: (id) => set((s) => {
      if (s.pages.length <= 1) return
      const idx = s.pages.findIndex(p => p.id === id)
      if (idx < 0) return
      s.pages.splice(idx, 1)
      if (s.activePageId === id) {
        s.activePageId = s.pages[Math.min(idx, s.pages.length - 1)].id
        s.selectedIds = []
        s.selectedElements = {}
        s.selectedStyles = null
      }
    }),

    duplicatePage: (id) => set((s) => {
      const source = s.pages.find(p => p.id === id)
      if (!source) return
      const newId = 'page-' + Date.now()
      const idx = s.pages.findIndex(p => p.id === id)
      s.pages.splice(idx + 1, 0, {
        id: newId,
        title: source.title + ' 副本',
        html: source.html,
      })
      s.activePageId = newId
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
    }),

    renamePage: (id, title) => set((s) => {
      const page = s.pages.find(p => p.id === id)
      if (page) page.title = title
    }),
  }))
)
