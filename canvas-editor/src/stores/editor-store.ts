import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { api } from '../services/api'
import { clonePageSchema, createDefaultPageSchema, renderPageSchemaToHtml, type PageSchema } from '../page-schema/render'
import { buildSemanticIndex, type SemanticIndexEntry } from '../utils/semantic-index'
import { buildPageSchemaFromDomTree } from '../page-schema/from-dom-tree'
import { validatePageSchema } from '../page-schema/validate'
import { applySchemaOperations as applySchemaOperationList } from '../schema-operations/apply-schema-operation'
import type { SchemaOperation } from '../schema-operations/types'
import { useViewportStore, type Device } from './viewport-store'

export type { Device } from './viewport-store'

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
  origin?: unknown
}

interface PageSnapshot {
  html: string
  schema?: PageSchema | null
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
  activeTool: Tool
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  undoStack: PageSnapshot[]
  redoStack: PageSnapshot[]
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
  setTool: (t: Tool) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  updatePageHTML: (pageId: string, html: string) => void
  applySchemaOperations: (pageId: string, operations: SchemaOperation[]) => void
  pushUndo: () => void
  undo: () => void
  redo: () => void
  getActivePage: () => Page | undefined
  getPrimarySelectedId: () => string | null
  addPage: () => void
  deletePage: (id: string) => void
  duplicatePage: (id: string) => void
  renamePage: (id: string, title: string) => void
  upgradePageToSchema: (id: string) => boolean
  markDirty: (pageId?: string) => void
  isDirty: () => boolean
  save: () => Promise<void>
  setEditingText: (id: string | null) => void
}

export {
  setBridgeSender,
  sendBridgeMessage,
  setPendingReveal,
  consumePendingReveal,
  suppressNextIframeReload,
  consumeSuppressReload,
  requestFromBridge,
} from '../bridge/host'
import { sendBridgeMessage } from '../bridge/host'

function createGeneratedPage(id: string, title: string): Page {
  const schema = createDefaultPageSchema(id, title)
  return {
    id,
    title,
    html: renderPageSchemaToHtml(schema),
    schema,
  }
}

function normalizeLoadedPages(pages: Page[]): Page[] {
  const usedIds = new Set<string>()
  return pages.map((page, index) => {
    const normalizedPage: Page = {
      ...page,
      schema: page.schema ? normalizePageSchemaIds(page.schema, index) : null,
    }
    let id = normalizeId(normalizedPage.id, `page-${index + 1}`)
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${normalizeId(normalizedPage.id, `page-${index + 1}`)}-${suffix}`
      suffix += 1
    }
    usedIds.add(id)
    if (id !== normalizedPage.id) {
      normalizedPage.id = id
      if (normalizedPage.schema) normalizedPage.schema.page.id = id
    }
    if (normalizedPage.schema) {
      normalizedPage.html = renderPageSchemaToHtml(normalizedPage.schema)
    }
    return normalizedPage
  })
}

function hashString(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0
  }
  return Math.abs(hash).toString(36).slice(0, 6)
}

function normalizeId(value: unknown, fallback: string): string {
  const raw = String(value ?? '')
  if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(raw)) return raw
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/i, '')
    .replace(/[^a-z0-9]+$/i, '')
    .slice(0, 48)
  return `${cleaned || fallback}-${hashString(raw || fallback)}`
}

function normalizeComponentNodeIds(nodes: PageSchema['page']['sections'], pageId: string): PageSchema['page']['sections'] {
  return nodes.map((node, index) => {
    const id = normalizeId(node.id, `${pageId}.node.${index + 1}`)
    return {
      ...node,
      id,
      children: node.children ? normalizeComponentNodeIds(node.children, id) : undefined,
    }
  })
}

function normalizePageSchemaIds(schema: PageSchema, index: number): PageSchema {
  const next = JSON.parse(JSON.stringify(schema)) as PageSchema
  const pageId = normalizeId(next.page.id, `page-${index + 1}`)
  next.page.id = pageId
  next.page.sections = normalizeComponentNodeIds(next.page.sections, pageId)
  return next
}

function createPageSnapshot(page: Page): PageSnapshot {
  return {
    html: page.html,
    schema: page.schema ? JSON.parse(JSON.stringify(page.schema)) as PageSchema : page.schema ?? null,
  }
}

function restorePageSnapshot(page: Page, snapshot: PageSnapshot) {
  page.html = snapshot.html
  page.schema = snapshot.schema ? JSON.parse(JSON.stringify(snapshot.schema)) as PageSchema : snapshot.schema ?? null
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
    activeTool: 'select',
    leftPanelOpen: true,
    rightPanelOpen: true,
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
        s.pages = normalizeLoadedPages(pages)
        s.activePageId = s.pages[0]?.id ?? ''
        s.dirtyPageIds = []
      }
      s.domTree = []
      s.semanticIndex = []
      s.selectedIds = []
      s.selectedElements = {}
      s.selectedStyles = null
      s.hoveredId = null
      s.hoveredRect = null
      s.undoStack = []
      s.redoStack = []
      s.activeTool = 'select'
      s.editingTextId = null
      useViewportStore.getState().resetViewport()
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
      useViewportStore.getState().resetViewport()
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

    applySchemaOperations: (pageId, operations) => set((s) => {
      const page = s.pages.find(p => p.id === pageId)
      if (!page || !page.schema || operations.length === 0) return

      s.undoStack.push(createPageSnapshot(page))
      s.redoStack = []

      const nextSchema = applySchemaOperationList(page.schema, operations)
      const validation = validatePageSchema(nextSchema)
      if (!validation.ok) {
        throw new Error(`Invalid page schema after operation: ${validation.errors.join('; ')}`)
      }
      page.schema = nextSchema
      page.html = renderPageSchemaToHtml(nextSchema)
      if (!s.dirtyPageIds.includes(pageId)) {
        s.dirtyPageIds.push(pageId)
      }
    }),

    pushUndo: () => set((s) => {
      const page = s.pages.find(p => p.id === s.activePageId)
      if (page) {
        s.undoStack.push(createPageSnapshot(page))
        s.redoStack = []
      }
    }),

    undo: () => set((s) => {
      if (s.undoStack.length === 0) return
      const page = s.pages.find(p => p.id === s.activePageId)
      if (!page) return
      s.redoStack.push(createPageSnapshot(page))
      restorePageSnapshot(page, s.undoStack.pop()!)
      if (!s.dirtyPageIds.includes(s.activePageId)) {
        s.dirtyPageIds.push(s.activePageId)
      }
    }),

    redo: () => set((s) => {
      if (s.redoStack.length === 0) return
      const page = s.pages.find(p => p.id === s.activePageId)
      if (!page) return
      s.undoStack.push(createPageSnapshot(page))
      restorePageSnapshot(page, s.redoStack.pop()!)
      if (!s.dirtyPageIds.includes(s.activePageId)) {
        s.dirtyPageIds.push(s.activePageId)
      }
    }),

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
        html: schema ? renderPageSchemaToHtml(schema) : source.html,
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

    upgradePageToSchema: (id) => {
      let upgraded = false
      set((s) => {
        const page = s.pages.find(p => p.id === id)
        if (!page || page.schema) return

        if (id !== s.activePageId) return
        const schema = buildPageSchemaFromDomTree(id, page.title, s.domTree)
        if (!schema) return

        s.undoStack.push(createPageSnapshot(page))
        s.redoStack = []
        page.schema = schema
        page.html = renderPageSchemaToHtml(schema)
        if (!s.dirtyPageIds.includes(id)) {
          s.dirtyPageIds.push(id)
        }
        upgraded = true
      })
      return upgraded
    },

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
            const derivedSchema = page.schema || (pageId === state.activePageId
              ? buildPageSchemaFromDomTree(pageId, page.title, state.domTree)
              : null)
            const html = page.schema
              ? renderPageSchemaToHtml(page.schema)
              : page.html

            if (derivedSchema && !page.schema) {
              page.schema = derivedSchema
            }
            if (html !== page.html) {
              page.html = html
            }
            await api.pages.update(state.projectId, pageId, {
              html,
              title: page.title,
              schema: page.schema ?? derivedSchema ?? undefined,
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

