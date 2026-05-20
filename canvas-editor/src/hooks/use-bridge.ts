import { useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { setBridgeSender, consumePendingReveal } from '../bridge/host'
import { useViewportStore } from '../stores/viewport-store'
import { useSelectionStore } from '../stores/selection-store'
import { useToolStore } from '../stores/tool-store'
import { deriveSpecPath } from '../utils/spec-path'

function handleIframeWheel(data: Record<string, unknown>) {
  const vp = useViewportStore.getState()
  const ctrlKey = data.ctrlKey || data.metaKey
  if (ctrlKey) {
    const delta = -(data.deltaY as number) * 0.001
    const newZoom = Math.max(0.1, Math.min(3, vp.viewport.zoom + delta))
    vp.zoomTo(newZoom)
  } else {
    vp.setViewport({
      x: vp.viewport.x - (data.deltaX as number),
      y: vp.viewport.y - (data.deltaY as number),
    })
  }
}

type MessageHandler = (data: Record<string, unknown>) => void

export function useBridge() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const setDomTree = useSelectionStore(s => s.setDomTree)
  const selectElement = useSelectionStore(s => s.selectElement)
  const updateSelectedRect = useSelectionStore(s => s.updateSelectedRect)
  const setSelectedStyles = useSelectionStore(s => s.setSelectedStyles)
  const hoverElement = useSelectionStore(s => s.hoverElement)

  const handlersRef = useRef<Map<string, MessageHandler>>(new Map())

  const onMessage = useCallback((e: MessageEvent) => {
    const data = e.data
    if (!data || !data.type) return

    const handler = handlersRef.current.get(data.type)
    if (handler) {
      handler(data)
      return
    }

    switch (data.type) {
      case 'ready': {
        sendToIframe({ type: 'request-tree' })
        const tool = useToolStore.getState()
        const selection = useSelectionStore.getState()
        const currentMode = tool.activeTool === 'preview' ? 'preview' : 'design'
        sendToIframe({ type: 'set-mode', mode: currentMode })
        const lastSelected = selection.selectedIds[selection.selectedIds.length - 1]
        if (lastSelected) sendToIframe({ type: 'get-computed-style', id: lastSelected })
        break
      }
      case 'dom-tree':
        setDomTree(data.tree || [])
        break
      case 'element-click': {
        const multi = !!(data.shiftKey || data.metaKey || data.ctrlKey)
        const activePageId = useEditorStore.getState().activePageId
        const sfId = data.sfId as string | null
        const component = data.component as string | null
        const role = data.role as string | null
        const variant = data.variant as string | null
        const specPath = deriveSpecPath(activePageId, {
          sfId,
          component,
          role,
          label: data.label as string | null,
          specPath: data.specPath as string | null,
        })
        selectElement(data.id as string, data.rect as any, data.label as string, multi, {
          sfId,
          component,
          role,
          variant,
          specPath,
        })
        if (data.id) {
          sendToIframe({ type: 'get-computed-style', id: data.id })
        }
        break
      }
      case 'computed-style': {
        const raw = data.styles as Record<string, string>
        const camel: Record<string, string> = {}
        for (const [k, v] of Object.entries(raw)) {
          camel[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v
        }
        setSelectedStyles(camel)
        if (data.rect && data.id) {
          updateSelectedRect(data.id as string, data.rect as any)
          const revealId = consumePendingReveal()
          if (revealId === data.id) {
            useViewportStore.getState().panToElement(data.rect as any)
          }
        }
        break
      }
      case 'element-rect-update': {
        const sel = useSelectionStore.getState()
        if (sel.selectedIds.includes(data.id as string) && data.rect) {
          updateSelectedRect(data.id as string, data.rect as any)
        }
        break
      }
      case 'element-replaced':
        if (data.id && data.rect) {
          selectElement(data.id as string, data.rect as any)
        }
        break
      case 'reorder-done':
        break
      case 'element-hover': {
        const sel = useSelectionStore.getState()
        if (!sel.selectedIds.includes(data.id as string)) {
          hoverElement(data.id, data.rect)
        }
        break
      }
      case 'element-rect': {
        const sel = useSelectionStore.getState()
        const id = data.id as string
        if (sel.hoveredId === id && data.rect) {
          hoverElement(id, data.rect as any)
        }
        break
      }
      case 'iframe-wheel':
        handleIframeWheel(data)
        break
      case 'edit-done': {
        useToolStore.getState().setEditingText(null)
        break
      }
      case 'navigate-page': {
        const store = useEditorStore.getState()
        const targetId = data.pageId as string
        const page = store.pages.find(p => p.id === targetId)
        if (page) store.setActivePage(targetId)
        break
      }
    }
  }, [setDomTree, selectElement, updateSelectedRect, setSelectedStyles, hoverElement])

  useEffect(() => {
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onMessage])

  const sendToIframe = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*')
  }, [])

  useEffect(() => {
    setBridgeSender(sendToIframe)
    return () => setBridgeSender(() => {})
  }, [sendToIframe])

  const registerHandler = useCallback((type: string, handler: MessageHandler) => {
    handlersRef.current.set(type, handler)
    return () => { handlersRef.current.delete(type) }
  }, [])

  return { iframeRef, sendToIframe, registerHandler }
}
