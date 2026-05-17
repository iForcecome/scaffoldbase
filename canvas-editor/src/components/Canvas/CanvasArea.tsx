import { useRef, useCallback, useEffect } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { CanvasViewport } from './CanvasViewport'
import { BrowserFrame } from './BrowserFrame'
import { ContentIFrame } from './ContentIFrame'
import { SelectionOverlay } from './SelectionOverlay'
import { HoverHighlight } from './HoverHighlight'
import { ZoomControls } from './ZoomControls'
import { DimensionIndicator } from './DimensionIndicator'
import { MiniMap } from './MiniMap'
import { ChatBar } from '../ChatBar/ChatBar'
import { useBridge } from '../../hooks/use-bridge'

export function CanvasArea() {
  const containerRef = useRef<HTMLDivElement>(null)
  const setViewport = useEditorStore(s => s.setViewport)
  const zoomTo = useEditorStore(s => s.zoomTo)
  const activePageId = useEditorStore(s => s.activePageId)
  const getDeviceWidth = useEditorStore(s => s.getDeviceWidth)
  const selectElement = useEditorStore(s => s.selectElement)
  const isPreview = useEditorStore(s => s.activeTool === 'preview')

  const { iframeRef, sendToIframe, registerHandler } = useBridge()

  const deviceWidth = getDeviceWidth()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-no-canvas-wheel]')) return

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = -e.deltaY * 0.001
        const current = useEditorStore.getState().viewport.zoom
        const newZoom = Math.max(0.1, Math.min(3, current + delta))
        zoomTo(newZoom)
      } else {
        const v = useEditorStore.getState().viewport
        setViewport({ x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomTo, setViewport])

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvasBg) {
      selectElement(null)
    }
  }, [selectElement])

  return (
    <main
      ref={containerRef}
      className="flex-1 relative overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(circle, #d1d5db 0.8px, transparent 0.8px)',
        backgroundSize: '24px 24px',
        backgroundColor: '#f5f5f7',
      }}
      onClick={handleCanvasClick}
      data-canvas-bg="true"
    >
      <CanvasViewport>
        <BrowserFrame deviceWidth={deviceWidth} pageSlug={activePageId}>
          <ContentIFrame
            iframeRef={iframeRef}
            deviceWidth={deviceWidth}
            sendToIframe={sendToIframe}
            registerHandler={registerHandler}
          />
        </BrowserFrame>
      </CanvasViewport>

      {!isPreview && <SelectionOverlay iframeRef={iframeRef} />}
      {!isPreview && <HoverHighlight iframeRef={iframeRef} />}
      <ZoomControls />
      {!isPreview && <DimensionIndicator />}
      <MiniMap />
      {!isPreview && <ChatBar />}
    </main>
  )
}
