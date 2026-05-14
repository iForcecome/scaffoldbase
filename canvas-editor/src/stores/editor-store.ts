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
  desktop: 960,
  tablet: 768,
  mobile: 375,
}

export type Tool = 'select' | 'zoom' | 'marquee' | 'text' | 'insert'

interface EditorState {
  pages: Page[]
  activePageId: string
  domTree: DOMNode[]
  selectedId: string | null
  selectedLabel: string | null
  selectedRect: { x: number; y: number; width: number; height: number } | null
  selectedStyles: Record<string, string> | null
  hoveredId: string | null
  hoveredRect: { x: number; y: number; width: number; height: number } | null
  viewport: { x: number; y: number; zoom: number }
  device: Device
  activeTool: Tool
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  undoStack: string[]
  redoStack: string[]
}

interface EditorActions {
  setActivePage: (id: string) => void
  setDomTree: (tree: DOMNode[]) => void
  selectElement: (id: string | null, rect?: { x: number; y: number; width: number; height: number } | null, label?: string | null) => void
  setSelectedStyles: (styles: Record<string, string>) => void
  hoverElement: (id: string | null, rect?: { x: number; y: number; width: number; height: number } | null) => void
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
  getDeviceWidth: () => number
  getActivePage: () => Page | undefined
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
    selectedId: null,
    selectedLabel: null,
    selectedRect: null,
    selectedStyles: null,
    hoveredId: null,
    hoveredRect: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    device: 'desktop',
    activeTool: 'select',
    leftPanelOpen: true,
    rightPanelOpen: true,
    undoStack: [],
    redoStack: [],

    setActivePage: (id) => set((s) => {
      s.activePageId = id
      s.selectedId = null
      s.selectedLabel = null
      s.selectedRect = null
      s.selectedStyles = null
      s.hoveredId = null
      s.hoveredRect = null
      s.domTree = []
      s.viewport = { x: 0, y: 0, zoom: 1 }
    }),

    setDomTree: (tree) => set((s) => { s.domTree = tree }),

    selectElement: (id, rect, label) => set((s) => {
      s.selectedId = id
      if (id === null) {
        s.selectedLabel = null
        s.selectedStyles = null
      } else if (label !== undefined) {
        s.selectedLabel = label ?? null
      }
      s.selectedRect = rect ?? null
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

    setTool: (t) => set((s) => { s.activeTool = t }),
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
  }))
)
