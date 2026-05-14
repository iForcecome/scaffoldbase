import { useState, useEffect, useRef, type RefObject } from 'react'
import { useEditorStore, consumeSuppressReload } from '../../stores/editor-store'
import { injectBridge } from '../../utils/inject-bridge'

interface ContentIFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  deviceWidth: number
  sendToIframe: (msg: Record<string, unknown>) => void
  registerHandler: (type: string, handler: (data: Record<string, unknown>) => void) => () => void
}

export function ContentIFrame({ iframeRef, deviceWidth }: ContentIFrameProps) {
  const pageHtml = useEditorStore(s => {
    const page = s.pages.find(p => p.id === s.activePageId)
    return page?.html || ''
  })
  const activePageId = useEditorStore(s => s.activePageId)

  const [srcDoc, setSrcDoc] = useState('')
  const [iframeHeight, setIframeHeight] = useState(800)
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

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin"
      className="block border-none"
      style={{
        width: deviceWidth,
        height: iframeHeight,
        pointerEvents: 'auto',
      }}
      title="Page Preview"
      onLoad={handleLoad}
    />
  )
}
