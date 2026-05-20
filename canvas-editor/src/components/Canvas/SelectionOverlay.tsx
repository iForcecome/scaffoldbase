import { type RefObject, useState, useLayoutEffect } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { useViewportStore } from '../../stores/viewport-store'

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
  const selectedIds = useEditorStore(s => s.selectedIds)
  const selectedElements = useEditorStore(s => s.selectedElements)
  const viewport = useViewportStore(s => s.viewport)
  const [, remeasure] = useState(0)

  useLayoutEffect(() => {
    remeasure(n => n + 1)
  }, [viewport.x, viewport.y, viewport.zoom])

  if (selectedIds.length === 0 || !iframeRef.current) return null

  const iframeEl = iframeRef.current
  const iframeRect = iframeEl.getBoundingClientRect()
  const primaryId = selectedIds[selectedIds.length - 1]
  const isSingle = selectedIds.length === 1

  return (
    <>
      {selectedIds.map(id => {
        const el = selectedElements[id]
        if (!el?.rect) return null

        const x = iframeRect.left + el.rect.x * viewport.zoom
        const y = iframeRect.top + el.rect.y * viewport.zoom
        const w = el.rect.width * viewport.zoom
        const h = el.rect.height * viewport.zoom
        const isPrimary = id === primaryId
        const displayLabel = el.label || id

        return (
          <div
            key={id}
            className="fixed pointer-events-none z-50"
            style={{ left: x, top: y, width: w, height: h }}
          >
            <div
              className="absolute inset-0 rounded-[2px]"
              style={{
                border: isPrimary ? '2px solid #4c6ef5' : '2px solid #4c6ef5',
                opacity: isPrimary ? 1 : 0.7,
              }}
            />
            {isPrimary && (
              <div className="absolute -inset-[5px] border border-dashed border-[#4c6ef5] rounded-md" />
            )}

            <div
              className="absolute -left-[3px] whitespace-nowrap pointer-events-none"
              style={{
                top: -26,
                background: isPrimary ? '#4c6ef5' : '#748ffc',
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

            {(isSingle || isPrimary) && handles.map(h => (
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
      })}
    </>
  )
}
