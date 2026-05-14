import { useCallback, useEffect, useRef } from 'react'
import { useEditorStore, setBridgeSender } from '../stores/editor-store'

function handleIframeWheel(data: Record<string, unknown>) {
  const store = useEditorStore.getState()
  const ctrlKey = data.ctrlKey || data.metaKey
  if (ctrlKey) {
    const delta = -(data.deltaY as number) * 0.001
    const newZoom = Math.max(0.1, Math.min(3, store.viewport.zoom + delta))
    store.zoomTo(newZoom)
  } else {
    store.setViewport({
      x: store.viewport.x - (data.deltaX as number),
      y: store.viewport.y - (data.deltaY as number),
    })
  }
}

type MessageHandler = (data: Record<string, unknown>) => void

export function useBridge() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const setDomTree = useEditorStore(s => s.setDomTree)
  const selectElement = useEditorStore(s => s.selectElement)
  const updateSelectedRect = useEditorStore(s => s.updateSelectedRect)
  const setSelectedStyles = useEditorStore(s => s.setSelectedStyles)
  const hoverElement = useEditorStore(s => s.hoverElement)

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
        const currentMode = useEditorStore.getState().activeTool === 'preview' ? 'preview' : 'design'
        sendToIframe({ type: 'set-mode', mode: currentMode })
        break
      }
      case 'dom-tree':
        setDomTree(data.tree || [])
        break
      case 'element-click': {
        const multi = !!(data.shiftKey || data.metaKey || data.ctrlKey)
        selectElement(data.id as string, data.rect as any, data.label as string, multi)
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
        }
        break
      }
      case 'element-rect-update': {
        const store = useEditorStore.getState()
        if (store.selectedIds.includes(data.id as string) && data.rect) {
          updateSelectedRect(data.id as string, data.rect as any)
        }
        break
      }
      case 'element-replaced':
        if (data.id && data.rect) {
          selectElement(data.id as string, data.rect as any)
        }
        break
      case 'element-hover': {
        const store = useEditorStore.getState()
        if (!store.selectedIds.includes(data.id as string)) {
          hoverElement(data.id, data.rect)
        }
        break
      }
      case 'iframe-wheel':
        handleIframeWheel(data)
        break
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
