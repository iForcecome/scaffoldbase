import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { api } from '../services/api'

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
  projectId: string | null
  projectName: string
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
  customWidth: number | null
  activeTool: Tool
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  iframeHeight: number
  undoStack: string[]
  redoStack: string[]
  saving: boolean
  dirtyPageIds: string[]
  editingTextId: string | null
}

interface EditorActions {
  loadProject: (projectId: string, name: string, pages: Page[]) => void
  setActivePage: (id: string) => void
  setDomTree: (tree: DOMNode[]) => void
  selectElement: (id: string | null, rect?: Rect | null, label?: string | null, multi?: boolean) => void
  updateSelectedRect: (id: string, rect: Rect) => void
  setSelectedStyles: (styles: Record<string, string>) => void
  hoverElement: (id: string | null, rect?: Rect | null) => void
  setViewport: (v: Partial<EditorState['viewport']>) => void
  zoomTo: (zoom: number) => void
  setDevice: (d: Device) => void
  setCustomWidth: (w: number) => void
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
  markDirty: (pageId?: string) => void
  isDirty: () => boolean
  save: () => Promise<void>
  setEditingText: (id: string | null) => void
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

const DEFAULT_HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script src="https://cdn.tailwindcss.com"><\/script></head><body class="bg-white p-8"><h1 class="text-2xl font-bold">新页面</h1><p class="text-gray-500 mt-2">开始编辑你的页面</p></body></html>'

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    projectId: null,
    projectName: '',
    pages: [],
    activePageId: '',
    domTree: [],
    selectedIds: [],
    selectedElements: {},
    selectedStyles: null,
    hoveredId: null,
    hoveredRect: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    device: 'desktop',
    customWidth: null,
    activeTool: 'select',
    leftPanelOpen: true,
    rightPanelOpen: true,
    iframeHeight: 800,
    undoStack: [],
    redoStack: [],
    saving: false,
    dirtyPageIds: [],
    editingTextId: null,

    loadProject: (projectId, name, pages) => set((s) => {
      s.projectId = projectId
      s.projectName = name
      if (pages.length === 0) {
        const defaultPage: Page = { id: 'page-' + Date.now(), title: '首页', html: DEFAULT_HTML }
        s.pages = [defaultPage]
        s.activePageId = defaultPage.id
        s.dirtyPageIds = [defaultPage.id]
      } else {
        s.pages = pages
        s.activePageId = pages[0].id
        s.dirtyPageIds = []
      }
      s.domTree = []
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
      s.hoveredId = null
      s.hoveredRect = null
      s.viewport = { x: 0, y: 0, zoom: 1 }
      s.undoStack = []
      s.redoStack = []
      s.activeTool = 'select'
      s.editingTextId = null
    }),

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
      s.customWidth = null
      s.viewport = { x: 0, y: 0, zoom: 1 }
    }),

    setCustomWidth: (w) => set((s) => {
      s.customWidth = Math.max(320, Math.min(2560, w))
      s.viewport = { x: 0, y: 0, zoom: s.viewport.zoom }
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
      if (page) {
        page.html = html
        if (!s.dirtyPageIds.includes(pageId)) {
          s.dirtyPageIds.push(pageId)
        }
      }
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
      if (!s.dirtyPageIds.includes(s.activePageId)) {
        s.dirtyPageIds.push(s.activePageId)
      }
    }),

    redo: () => set((s) => {
      if (s.redoStack.length === 0) return
      const page = s.pages.find(p => p.id === s.activePageId)
      if (!page) return
      s.undoStack.push(page.html)
      page.html = s.redoStack.pop()!
      if (!s.dirtyPageIds.includes(s.activePageId)) {
        s.dirtyPageIds.push(s.activePageId)
      }
    }),

    getDeviceWidth: () => get().customWidth ?? DEVICE_WIDTHS[get().device],
    getActivePage: () => get().pages.find(p => p.id === get().activePageId),
    getPrimarySelectedId: () => {
      const ids = get().selectedIds
      return ids.length > 0 ? ids[ids.length - 1] : null
    },

    addPage: () => set((s) => {
      const id = 'page-' + Date.now()
      const html = DEFAULT_HTML
      s.pages.push({ id, title: '新页面', html })
      s.activePageId = id
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
      if (!s.dirtyPageIds.includes(id)) {
        s.dirtyPageIds.push(id)
      }
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
      const dirtyIdx = s.dirtyPageIds.indexOf(id)
      if (dirtyIdx >= 0) s.dirtyPageIds.splice(dirtyIdx, 1)
      // Mark remaining pages dirty so save will sync the full page list
      if (!s.dirtyPageIds.includes(s.activePageId)) {
        s.dirtyPageIds.push(s.activePageId)
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
      if (!s.dirtyPageIds.includes(newId)) {
        s.dirtyPageIds.push(newId)
      }
    }),

    renamePage: (id, title) => set((s) => {
      const page = s.pages.find(p => p.id === id)
      if (page) {
        page.title = title
        if (!s.dirtyPageIds.includes(id)) {
          s.dirtyPageIds.push(id)
        }
      }
    }),

    markDirty: (pageId) => set((s) => {
      const id = pageId ?? s.activePageId
      if (id && !s.dirtyPageIds.includes(id)) {
        s.dirtyPageIds.push(id)
      }
    }),

    isDirty: () => get().dirtyPageIds.length > 0,

    save: async () => {
      const state = get()
      if (!state.projectId || state.dirtyPageIds.length === 0) return
      set({ saving: true })
      try {
        for (const pageId of state.dirtyPageIds) {
          const page = state.pages.find(p => p.id === pageId)
          if (page) {
            await api.pages.update(state.projectId, pageId, {
              html: page.html,
              title: page.title,
            })
          }
        }
        set((s) => { s.dirtyPageIds = [] })
      } finally {
        set({ saving: false })
      }
    },

    setEditingText: (id) => set((s) => { s.editingTextId = id }),
  }))
)

let _syncTimer: ReturnType<typeof setTimeout> | null = null

export function syncHTMLFromIframe(delay = 600) {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(async () => {
    const state = useEditorStore.getState()
    if (!state.projectId || !state.activePageId) return
    try {
      const resp = await requestFromBridge<{ html: string }>(
        { type: 'get-page-html' },
        'page-html',
      )
      const currentPage = state.pages.find(p => p.id === state.activePageId)
      if (currentPage && currentPage.html !== resp.html) {
        state.pushUndo()
        suppressNextIframeReload()
        state.updatePageHTML(state.activePageId, resp.html)
      }
    } catch { /* iframe not ready */ }
  }, delay)
}
