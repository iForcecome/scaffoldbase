import { useRef, useEffect, type ReactNode } from 'react'
import { useEditorStore } from '../../stores/editor-store'

export function CanvasViewport({ children }: { children: ReactNode }) {
  const viewport = useEditorStore(s => s.viewport)
  const activePageId = useEditorStore(s => s.activePageId)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 })
  }, [activePageId])

  return (
    <div ref={scrollRef} className="absolute inset-0 flex items-start justify-center pt-8 pb-36 overflow-auto pointer-events-none">
      <div
        className="pointer-events-auto shrink-0"
        style={{
          transform: `scale(${viewport.zoom}) translate(${viewport.x / viewport.zoom}px, ${viewport.y / viewport.zoom}px)`,
          transformOrigin: 'center top',
        }}
      >
        {children}
      </div>
    </div>
  )
}
