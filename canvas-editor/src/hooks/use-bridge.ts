import { useCallback, useEffect, useRef } from 'react'
import { useEditorStore, setBridgeSender } from '../stores/editor-store'

type MessageHandler = (data: Record<string, unknown>) => void

export function useBridge() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const setDomTree = useEditorStore(s => s.setDomTree)
  const selectElement = useEditorStore(s => s.selectElement)
  const setSelectedStyles = useEditorStore(s => s.setSelectedStyles)
  const hoverElement = useEditorStore(s => s.hoverElement)
  const selectedId = useEditorStore(s => s.selectedId)

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
      case 'ready':
        sendToIframe({ type: 'request-tree' })
        break
      case 'dom-tree':
        setDomTree(data.tree || [])
        break
      case 'element-click':
        selectElement(data.id as string, data.rect as any, data.label as string)
        if (data.id) {
          sendToIframe({ type: 'get-computed-style', id: data.id })
        }
        break
      case 'computed-style': {
        const raw = data.styles as Record<string, string>
        const camel: Record<string, string> = {}
        for (const [k, v] of Object.entries(raw)) {
          camel[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v
        }
        setSelectedStyles(camel)
        if (data.rect) {
          selectElement(data.id as string, data.rect as any)
        }
        break
      }
      case 'element-rect-update':
        if (data.id === selectedId && data.rect) {
          selectElement(data.id as string, data.rect as any)
        }
        break
      case 'element-replaced':
        if (data.id && data.rect) {
          selectElement(data.id as string, data.rect as any)
        }
        break
      case 'element-hover':
        if (data.id !== selectedId) {
          hoverElement(data.id, data.rect)
        }
        break
    }
  }, [setDomTree, selectElement, setSelectedStyles, hoverElement, selectedId])

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
