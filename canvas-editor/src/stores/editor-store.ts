import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { api } from '../services/api'
import { clonePageSchema, createDefaultPageSchema, renderPageSchemaToHtml, type PageSchema } from '../page-schema/render'
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

export interface Page {
  id: string
  title: string
  html: string
  schema?: PageSchema | null
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
  sfId?: string | null
  component?: string | null
  role?: string | null
  variant?: string | null
  specPath?: string | null
}

interface EditorState {
  projectId: string | null
  projectName: string
  pages: Page[]
  activePageId: string
  domTree: DOMNode[]
  semanticIndex: SemanticIndexEntry[]
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
  selectElement: (id: string | null, rect?: Rect | null, label?: string | null, multi?: boolean, meta?: Partial<SelectedElement>) => void
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
  panToElement: (rect: Rect) => void
}

let _bridgeSender: ((msg: Record<string, unknown>) => void) | null = null

export function setBridgeSender(fn: (msg: Record<string, unknown>) => void) {
  _bridgeSender = fn
}

export function sendBridgeMessage(msg: Record<string, unknown>) {
  _bridgeSender?.(msg)
}

let _pendingRevealId: string | null = null
export function setPendingReveal(id: string | null) { _pendingRevealId = id }
export function consumePendingReveal(): string | null {
  const id = _pendingRevealId
  _pendingRevealId = null
  return id
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

function createGeneratedPage(id: string, title: string): Page {
  const schema = createDefaultPageSchema(id, title)
  return {
    id,
    title,
    html: renderPageSchemaToHtml(schema),
    schema,
  }
}

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    projectId: null,
    projectName: '',
    pages: [],
    activePageId: '',
    domTree: [],
    semanticIndex: [],
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
        const defaultPage = createGeneratedPage('page-' + Date.now(), '首页')
        s.pages = [defaultPage]
        s.activePageId = defaultPage.id
        s.dirtyPageIds = [defaultPage.id]
      } else {
        s.pages = pages
        s.activePageId = pages[0].id
        s.dirtyPageIds = []
      }
      s.domTree = []
      s.semanticIndex = []
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
      s.semanticIndex = []
      s.viewport = { x: 0, y: 0, zoom: 1 }
    }),

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
          if (s.selectedIds.length === 0) {
            s.selectedStyles = null
          }
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
      s.pages.push(createGeneratedPage(id, '新页面'))
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
      const schema = source.schema ? clonePageSchema(source.schema, {
        id: newId,
        title: source.title + ' 副本',
      }) : null
      s.pages.splice(idx + 1, 0, {
        id: newId,
        title: source.title + ' 副本',
        html: source.html,
        schema,
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
              schema: page.schema ?? undefined,
            })
          }
        }
        set((s) => { s.dirtyPageIds = [] })
      } finally {
        set({ saving: false })
      }
    },

    setEditingText: (id) => set((s) => { s.editingTextId = id }),

    panToElement: (rect) => {
      const s = get()
      const zoom = s.viewport.zoom
      const canvasEl = document.querySelector('[data-canvas-bg]') as HTMLElement | null
      if (!canvasEl) return
      const canvasBounds = canvasEl.getBoundingClientRect()

      const iframeEl = canvasEl.querySelector('iframe')
      if (!iframeEl) return
      const iframeRect = iframeEl.getBoundingClientRect()

      const elLeft = iframeRect.left + rect.x * zoom
      const elTop = iframeRect.top + rect.y * zoom
      const elRight = elLeft + rect.width * zoom
      const elBottom = elTop + rect.height * zoom

      const PAD = 50
      const vLeft = canvasBounds.left + PAD
      const vTop = canvasBounds.top + PAD
      const vRight = canvasBounds.right - PAD
      const vBottom = canvasBounds.bottom - PAD

      if (elLeft >= vLeft && elTop >= vTop && elRight <= vRight && elBottom <= vBottom) {
        return
      }

      const isCompletelyOutside =
        elRight < vLeft || elLeft > vRight || elBottom < vTop || elTop > vBottom

      if (isCompletelyOutside || (elRight - elLeft) > (vRight - vLeft) || (elBottom - elTop) > (vBottom - vTop)) {
        const dx = (vLeft + vRight) / 2 - (elLeft + elRight) / 2
        const dy = vTop - elTop
        set((s) => { s.viewport.x += dx; s.viewport.y += dy })
        return
      }

      let dx = 0, dy = 0
      if (elLeft < vLeft) dx = vLeft - elLeft
      else if (elRight > vRight) dx = vRight - elRight
      if (elTop < vTop) dy = vTop - elTop
      else if (elBottom > vBottom) dy = vBottom - elBottom

      set((s) => { s.viewport.x += dx; s.viewport.y += dy })
    },
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
