import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import { useEditorStore, consumeSuppressReload, sendBridgeMessage } from '../../stores/editor-store'
import { injectBridge } from '../../utils/inject-bridge'

interface ContentIFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  deviceWidth: number
  sendToIframe: (msg: Record<string, unknown>) => void
  registerHandler: (type: string, handler: (data: Record<string, unknown>) => void) => () => void
}

function rectToObj(r: DOMRect) {
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

function inferLabelFromEl(el: Element): string {
  return el.getAttribute('data-sf-id') || el.tagName.toLowerCase()
}

export function ContentIFrame({ iframeRef, deviceWidth }: ContentIFrameProps) {
  const pageHtml = useEditorStore(s => {
    const page = s.pages.find(p => p.id === s.activePageId)
    return page?.html || ''
  })
  const activePageId = useEditorStore(s => s.activePageId)
  const iframeHeight = useEditorStore(s => s.iframeHeight)
  const setIframeHeight = useEditorStore(s => s.setIframeHeight)
  const isPreview = useEditorStore(s => s.activeTool === 'preview')
  const selectElement = useEditorStore(s => s.selectElement)
  const hoverElement = useEditorStore(s => s.hoverElement)

  const [srcDoc, setSrcDoc] = useState('')
  const prevPageIdRef = useRef(activePageId)

  useEffect(() => {
    const pageChanged = prevPageIdRef.current !== activePageId
    prevPageIdRef.current = activePageId

    if (pageChanged || !consumeSuppressReload()) {
      setSrcDoc(pageHtml ? injectBridge(pageHtml) : '')
    }
  }, [pageHtml, activePageId])

  const handleLoad = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc?.body) {
        const h = doc.body.scrollHeight
        if (h > 100) setIframeHeight(h)
      }
    } catch {
      // cross-origin, use default
    }
  }

  const getElementAtPoint = useCallback((clientX: number, clientY: number) => {
    const iframe = iframeRef.current
    if (!iframe) return null
    const iframeRect = iframe.getBoundingClientRect()
    const x = clientX - iframeRect.left
    const y = clientY - iframeRect.top
    try {
      const doc = iframe.contentDocument
      if (!doc) return null
      const el = doc.elementFromPoint(x, y)
      if (!el) return null
      const target = el.closest('[data-sf-id]')
      if (!target) return null
      return {
        id: target.getAttribute('data-sf-id')!,
        rect: rectToObj(target.getBoundingClientRect()),
        label: inferLabelFromEl(target),
      }
    } catch {
      return null
    }
  }, [iframeRef])

  const handleOverlayMove = useCallback((e: React.MouseEvent) => {
    const hit = getElementAtPoint(e.clientX, e.clientY)
    if (hit) {
      const store = useEditorStore.getState()
      if (!store.selectedIds.includes(hit.id)) {
        hoverElement(hit.id, hit.rect)
      }
    } else {
      hoverElement(null)
    }
  }, [getElementAtPoint, hoverElement])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    const hit = getElementAtPoint(e.clientX, e.clientY)
    if (hit) {
      const multi = e.shiftKey || e.metaKey || e.ctrlKey
      selectElement(hit.id, hit.rect, hit.label, multi)
      if (hit.id) {
        sendBridgeMessage({ type: 'get-computed-style', id: hit.id })
      }
    }
  }, [getElementAtPoint, selectElement])

  const handleOverlayLeave = useCallback(() => {
    hoverElement(null)
  }, [hoverElement])

  return (
    <div className="relative" style={{ width: deviceWidth, height: iframeHeight }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
        className="block border-none absolute inset-0"
        style={{
          width: deviceWidth,
          height: iframeHeight,
          pointerEvents: isPreview ? 'auto' : 'none',
        }}
        title="Page Preview"
        onLoad={handleLoad}
      />
      {!isPreview && (
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: 'default' }}
          onMouseMove={handleOverlayMove}
          onClick={handleOverlayClick}
          onMouseLeave={handleOverlayLeave}
        />
      )}
    </div>
  )
}
