import { useViewportStore } from '../../stores/viewport-store'

export function ZoomControls() {
  const viewport = useViewportStore(s => s.viewport)
  const zoomTo = useViewportStore(s => s.zoomTo)
  const setViewport = useViewportStore(s => s.setViewport)

  const zoomPercent = Math.round(viewport.zoom * 100)

  return (
    <div className="absolute top-4 left-4 z-20 zoom-control rounded-lg flex items-center gap-1 p-1" data-no-canvas-wheel>
      <button
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-2 transition-colors text-ink-2"
        onClick={() => zoomTo(viewport.zoom - 0.1)}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M19.5 12h-15"/>
        </svg>
      </button>
      <span className="text-xs font-medium text-ink-1 w-10 text-center">
        {zoomPercent}%
      </span>
      <button
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-2 transition-colors text-ink-2"
        onClick={() => zoomTo(viewport.zoom + 0.1)}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
      </button>
      <div className="w-px h-5 bg-surface-3" />
      <button
        className="w-7 h-7 rounded flex items-center justify-center hover:bg-surface-2 transition-colors text-ink-2"
        onClick={() => { zoomTo(1); setViewport({ x: 0, y: 0 }) }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>
        </svg>
      </button>
    </div>
  )
}
