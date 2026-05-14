import { type RefObject } from 'react'
import { useEditorStore } from '../../stores/editor-store'

interface SelectionOverlayProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
}

const handles = [
  { pos: 'tl', style: { top: -5, left: -5, cursor: 'nw-resize' } },
  { pos: 'tr', style: { top: -5, right: -5, cursor: 'ne-resize' } },
  { pos: 'bl', style: { bottom: -5, left: -5, cursor: 'sw-resize' } },
  { pos: 'br', style: { bottom: -5, right: -5, cursor: 'se-resize' } },
  { pos: 'tm', style: { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' } },
  { pos: 'bm', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
  { pos: 'ml', style: { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'w-resize' } },
  { pos: 'mr', style: { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'e-resize' } },
] as const

export function SelectionOverlay({ iframeRef }: SelectionOverlayProps) {
  const selectedId = useEditorStore(s => s.selectedId)
  const selectedLabel = useEditorStore(s => s.selectedLabel)
  const selectedRect = useEditorStore(s => s.selectedRect)
  const viewport = useEditorStore(s => s.viewport)

  if (!selectedId || !selectedRect || !iframeRef.current) return null

  const iframeEl = iframeRef.current
  const iframeRect = iframeEl.getBoundingClientRect()

  const x = iframeRect.left + selectedRect.x * viewport.zoom
  const y = iframeRect.top + selectedRect.y * viewport.zoom
  const w = selectedRect.width * viewport.zoom
  const h = selectedRect.height * viewport.zoom

  const displayLabel = selectedLabel || selectedId

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{ left: x, top: y, width: w, height: h }}
    >
      <div className="absolute inset-0 border-2 border-[#4c6ef5] rounded-[2px]" />
      <div className="absolute -inset-[5px] border border-dashed border-[#4c6ef5] rounded-md" />

      <div
        className="absolute -left-[3px] whitespace-nowrap pointer-events-none"
        style={{
          top: -26,
          background: '#4c6ef5',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: '4px 4px 0 0',
          lineHeight: '18px',
        }}
      >
        {displayLabel}
      </div>

      {handles.map(h => (
        <div
          key={h.pos}
          className="absolute pointer-events-auto"
          style={{
            ...h.style as React.CSSProperties,
            width: 8,
            height: 8,
            background: '#fff',
            border: '2px solid #4c6ef5',
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  )
}
