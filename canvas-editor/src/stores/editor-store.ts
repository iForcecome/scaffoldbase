import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { api } from '../services/api'
import { clonePageSchema, createDefaultPageSchema, renderPageSchemaToHtml, type PageSchema } from '../page-schema/render'
import { validatePageSchema } from '../page-schema/validate'
import { applySchemaOperations as applySchemaOperationList } from '../schema-operations/apply-schema-operation'
import type { SchemaOperation } from '../schema-operations/types'
import { useViewportStore } from './viewport-store'
import { useSelectionStore } from './selection-store'
import { useHistoryStore, type PageSnapshot } from './history-store'

export type { Device } from './viewport-store'
export type { SelectedElement } from './selection-store'
export type { Tool } from './tool-store'

export interface Page {
  id: string
  title: string
  html: string
  schema?: PageSchema | null
  origin?: unknown
}

interface EditorState {
  projectId: string | null
  projectName: string
  pages: Page[]
  activePageId: string
  saving: boolean
  dirtyPageIds: string[]
}

interface EditorActions {
  loadProject: (projectId: string, name: string, pages: Page[]) => void
  setActivePage: (id: string) => void
  updatePageHTML: (pageId: string, html: string) => void
  applySchemaOperations: (pageId: string, operations: SchemaOperation[]) => void
  pushUndo: () => void
  undo: () => void
  redo: () => void
  getActivePage: () => Page | undefined
  addPage: () => void
  deletePage: (id: string) => void
  duplicatePage: (id: string) => void
  renamePage: (id: string, title: string) => void
  upgradePageToSchema: (id: string) => boolean
  markDirty: (pageId?: string) => void
  isDirty: () => boolean
  save: () => Promise<void>
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
    saving: false,
    dirtyPageIds: [],

    loadProject: (projectId, name, pages) => {
      set((s) => {
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
      })
      useHistoryStore.getState().reset()
      useSelectionStore.getState().resetForPageChange()
      useViewportStore.getState().resetViewport()
    },

    setActivePage: (id) => {
      set((s) => { s.activePageId = id })
      useSelectionStore.getState().resetForPageChange()
      useViewportStore.getState().resetViewport()
    },

    updatePageHTML: (pageId, html) => set((s) => {
      const page = s.pages.find(p => p.id === pageId)
      if (page) {
        page.html = html
        if (!s.dirtyPageIds.includes(pageId)) {
          s.dirtyPageIds.push(pageId)
        }
      }
    }),

    applySchemaOperations: (pageId, operations) => {
      let snapshot: PageSnapshot | null = null
      set((s) => {
        const page = s.pages.find(p => p.id === pageId)
        if (!page || !page.schema || operations.length === 0) return
        snapshot = createPageSnapshot(page)

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
      })
      if (snapshot) useHistoryStore.getState().pushUndo(snapshot)
    },

    pushUndo: () => {
      const page = get().pages.find(p => p.id === get().activePageId)
      if (page) useHistoryStore.getState().pushUndo(createPageSnapshot(page))
    },

    undo: () => {
      const popped = useHistoryStore.getState().popUndo()
      if (!popped) return
      set((s) => {
        const page = s.pages.find(p => p.id === s.activePageId)
        if (!page) return
        useHistoryStore.getState().pushRedo(createPageSnapshot(page))
        restorePageSnapshot(page, popped)
        if (!s.dirtyPageIds.includes(s.activePageId)) {
          s.dirtyPageIds.push(s.activePageId)
        }
      })
    },

    redo: () => {
      const popped = useHistoryStore.getState().popRedo()
      if (!popped) return
      set((s) => {
        const page = s.pages.find(p => p.id === s.activePageId)
        if (!page) return
        useHistoryStore.getState().pushUndo(createPageSnapshot(page))
        restorePageSnapshot(page, popped)
        if (!s.dirtyPageIds.includes(s.activePageId)) {
          s.dirtyPageIds.push(s.activePageId)
        }
      })
    },

    getActivePage: () => get().pages.find(p => p.id === get().activePageId),

    addPage: () => {
      const id = 'page-' + Date.now()
      set((s) => {
        s.pages.push(createGeneratedPage(id, '新页面'))
        s.activePageId = id
        if (!s.dirtyPageIds.includes(id)) s.dirtyPageIds.push(id)
      })
      useSelectionStore.getState().clearSelection()
    },

    deletePage: (id) => {
      let activeChanged = false
      set((s) => {
        if (s.pages.length <= 1) return
        const idx = s.pages.findIndex(p => p.id === id)
        if (idx < 0) return
        s.pages.splice(idx, 1)
        if (s.activePageId === id) {
          s.activePageId = s.pages[Math.min(idx, s.pages.length - 1)].id
          activeChanged = true
        }
        const dirtyIdx = s.dirtyPageIds.indexOf(id)
        if (dirtyIdx >= 0) s.dirtyPageIds.splice(dirtyIdx, 1)
        if (!s.dirtyPageIds.includes(s.activePageId)) {
          s.dirtyPageIds.push(s.activePageId)
        }
      })
      if (activeChanged) useSelectionStore.getState().clearSelection()
    },

    duplicatePage: (id) => {
      set((s) => {
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
        if (!s.dirtyPageIds.includes(newId)) s.dirtyPageIds.push(newId)
      })
      useSelectionStore.getState().clearSelection()
    },

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
      // Stage 2 made schema mandatory; this lives on as a defensive no-op for
      // any legacy page that slipped through without one. Real migration is
      // server/scripts/migrate-pages-to-schema.ts (headless Playwright).
      const page = get().pages.find(p => p.id === id)
      return !!page?.schema
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
            const html = page.schema ? renderPageSchemaToHtml(page.schema) : page.html
            if (html !== page.html) page.html = html
            await api.pages.update(state.projectId, pageId, {
              html,
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
  }))
)

