import { type RefObject } from 'react'
import { useEditorStore } from '../../stores/editor-store'

interface HoverHighlightProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
}

export function HoverHighlight({ iframeRef }: HoverHighlightProps) {
  const hoveredId = useEditorStore(s => s.hoveredId)
  const hoveredRect = useEditorStore(s => s.hoveredRect)
  const selectedIds = useEditorStore(s => s.selectedIds)
  const viewport = useEditorStore(s => s.viewport)

  if (!hoveredId || !hoveredRect || selectedIds.includes(hoveredId) || !iframeRef.current) return null

  const iframeEl = iframeRef.current
  const iframeRect = iframeEl.getBoundingClientRect()

  const x = iframeRect.left + hoveredRect.x * viewport.zoom
  const y = iframeRect.top + hoveredRect.y * viewport.zoom
  const w = hoveredRect.width * viewport.zoom
  const h = hoveredRect.height * viewport.zoom

  return (
    <div
      className="fixed pointer-events-none z-40 border-[1.5px] border-brand-300 rounded-[2px] transition-all duration-100"
      style={{ left: x, top: y, width: w, height: h }}
    />
  )
}
