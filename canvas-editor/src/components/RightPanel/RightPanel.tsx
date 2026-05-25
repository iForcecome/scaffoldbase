import { useToolStore } from '../../stores/tool-store'
import { useSelectionStore } from '../../stores/selection-store'
import { PagePropertiesSection } from './PagePropertiesSection'
import { ElementInspector } from './ElementInspector'

export function RightPanel() {
  const isOpen = useToolStore(s => s.rightPanelOpen)
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const selectedElements = useSelectionStore(s => s.selectedElements)
  if (!isOpen) return null

  const primaryId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null
  const primaryEl = primaryId ? selectedElements[primaryId] : null
  const displayLabel = primaryEl?.label || primaryId

  return (
    <aside className="w-60 bg-white border-l border-surface-3 flex flex-col shrink-0 z-30 overflow-y-auto">
      <div className="h-10 px-3 flex items-center justify-between border-b border-surface-3 shrink-0">
        <span className="text-xs font-semibold text-ink-1">属性</span>
        {primaryId ? (
          <span className="text-[11px] text-brand-600 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
            <span className="truncate max-w-24">{displayLabel}</span>
            {selectedIds.length > 1 && (
              <span className="text-ink-3 font-normal">+{selectedIds.length - 1}</span>
            )}
          </span>
        ) : (
          <span className="text-[11px] text-ink-3 font-medium">页面</span>
        )}
      </div>

      {!primaryId ? <PagePropertiesSection /> : <ElementInspector />}
    </aside>
  )
}
