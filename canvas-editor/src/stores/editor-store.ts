import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { api } from '../services/api'
import { useViewportStore } from './viewport-store'
import { useSelectionStore } from './selection-store'
import { useHistoryStore, type PageSnapshot } from './history-store'
import { assignSfIds } from '../utils/sf-ids'

export type { Device } from './viewport-store'
export type { SelectedElement } from './selection-store'
export type { Tool } from './tool-store'

export interface Page {
  id: string
  title: string
  layoutId: string | null
  contentHtml: string
}

interface EditorState {
  projectId: string | null
  projectName: string
  sharedHead: string
  pages: Page[]
  activePageId: string
  saving: boolean
  dirtyPageIds: string[]
}

interface EditorActions {
  loadProject: (input: {
    projectId: string
    name: string
    pages: Page[]
    sharedHead?: string
  }) => void
  setActivePage: (id: string) => void
  updatePageContentHtml: (pageId: string, contentHtml: string) => void
  setSharedHead: (sharedHead: string) => void
  pushUndo: () => void
  undo: () => void
  redo: () => void
  getActivePage: () => Page | undefined
  addPage: () => void
  deletePage: (id: string) => void
  duplicatePage: (id: string) => void
  renamePage: (id: string, title: string) => void
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

const DEFAULT_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <main class="min-h-screen p-8">
    <h1 class="text-3xl font-bold">新页面</h1>
  </main>
</body>
</html>`

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

function createGeneratedPage(id: string, title: string): Page {
  return { id, title, layoutId: null, contentHtml: assignSfIds(DEFAULT_PAGE_HTML) }
}

/**
 * load 阶段：对每个 page 的 contentHtml 跑一次 assignSfIds。
 * - 已有 sf-id 的元素保留
 * - 新分配的会写回 contentHtml
 * - 与原始字符串不等 → 标 dirty，下次 save 持久化到 server
 */
function normalizeLoadedPages(pages: Page[]): { pages: Page[]; dirtyIds: string[] } {
  const usedIds = new Set<string>()
  const dirtyIds: string[] = []
  const normalized = pages.map((page, index) => {
    const rawHtml = page.contentHtml ?? DEFAULT_PAGE_HTML
    const withIds = assignSfIds(rawHtml)
    const normalizedPage: Page = {
      id: page.id,
      title: page.title ?? `页面 ${index + 1}`,
      layoutId: page.layoutId ?? null,
      contentHtml: withIds,
    }
    let id = normalizeId(normalizedPage.id, `page-${index + 1}`)
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${normalizeId(normalizedPage.id, `page-${index + 1}`)}-${suffix}`
      suffix += 1
    }
    usedIds.add(id)
    normalizedPage.id = id
    if (withIds !== rawHtml) dirtyIds.push(id)
    return normalizedPage
  })
  return { pages: normalized, dirtyIds }
}

function createPageSnapshot(page: Page): PageSnapshot {
  return { contentHtml: page.contentHtml }
}

function restorePageSnapshot(page: Page, snapshot: PageSnapshot) {
  page.contentHtml = snapshot.contentHtml
}

export const useEditorStore = create<EditorState & EditorActions>()(
  immer((set, get) => ({
    projectId: null,
    projectName: '',
    sharedHead: '',
    pages: [],
    activePageId: '',
    saving: false,
    dirtyPageIds: [],

    loadProject: ({ projectId, name, pages, sharedHead }) => {
      set((s) => {
        s.projectId = projectId
        s.projectName = name
        s.sharedHead = sharedHead ?? ''
        if (pages.length === 0) {
          const defaultPage = createGeneratedPage('page-' + Date.now(), '首页')
          s.pages = [defaultPage]
          s.activePageId = defaultPage.id
          s.dirtyPageIds = [defaultPage.id]
        } else {
          const { pages: normalized, dirtyIds } = normalizeLoadedPages(pages)
          s.pages = normalized
          s.activePageId = normalized[0]?.id ?? ''
          s.dirtyPageIds = dirtyIds
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

    updatePageContentHtml: (pageId, contentHtml) => set((s) => {
      const page = s.pages.find(p => p.id === pageId)
      if (page) {
        page.contentHtml = contentHtml
        if (!s.dirtyPageIds.includes(pageId)) {
          s.dirtyPageIds.push(pageId)
        }
      }
    }),

    setSharedHead: (sharedHead) => set((s) => {
      s.sharedHead = sharedHead
    }),

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
        s.pages.splice(idx + 1, 0, {
          id: newId,
          title: source.title + ' 副本',
          layoutId: source.layoutId,
          contentHtml: source.contentHtml,
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
              contentHtml: page.contentHtml,
              title: page.title,
              layoutId: page.layoutId,
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
