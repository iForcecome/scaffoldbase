import type { ReactNode } from 'react'
import { useEditorStore } from '../../stores/editor-store'

export function CanvasViewport({ children }: { children: ReactNode }) {
  const viewport = useEditorStore(s => s.viewport)

  return (
    <div className="absolute inset-0 flex items-start justify-center pt-8 pb-36 overflow-auto pointer-events-none">
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
