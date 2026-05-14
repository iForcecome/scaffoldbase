import { Plus } from 'lucide-react'
import { useEditorStore } from '../../stores/editor-store'
import { LayerTree } from './LayerTree'
import { SpecStatus } from './SpecStatus'

export function LeftPanel() {
  const isOpen = useEditorStore(s => s.leftPanelOpen)

  if (!isOpen) return null

  return (
    <aside className="w-56 bg-white border-r border-surface-3 flex flex-col shrink-0 z-30">
      <div className="h-10 px-3 flex items-center justify-between border-b border-surface-3 shrink-0">
        <div className="flex items-center gap-1">
          <button className="text-xs font-semibold text-brand-600 px-2 py-1 rounded bg-brand-50">
            图层
          </button>
          <button className="text-xs font-medium text-ink-3 px-2 py-1 rounded hover:bg-surface-1 transition-colors">
            组件
          </button>
        </div>
        <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-2 transition-colors">
          <Plus className="w-3.5 h-3.5 text-ink-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1 text-xs">
        <LayerTree />
      </div>

      <SpecStatus />
    </aside>
  )
}
