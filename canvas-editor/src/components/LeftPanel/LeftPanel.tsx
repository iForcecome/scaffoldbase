import { useEditorStore } from '../../stores/editor-store'
import { PageList } from './PageList'
import { LayerTree } from './LayerTree'
import { SpecStatus } from './SpecStatus'

export function LeftPanel() {
  const isOpen = useEditorStore(s => s.leftPanelOpen)

  if (!isOpen) return null

  return (
    <aside className="w-56 bg-white border-r border-surface-3 flex flex-col shrink-0 z-30">
      <PageList />

      <div className="h-8 px-3 flex items-center border-b border-surface-3 shrink-0">
        <span className="text-[11px] font-semibold text-ink-2 uppercase tracking-wider">图层</span>
      </div>

      <div className="flex-1 overflow-y-auto py-1 text-xs">
        <LayerTree />
      </div>

      <SpecStatus />
    </aside>
  )
}
