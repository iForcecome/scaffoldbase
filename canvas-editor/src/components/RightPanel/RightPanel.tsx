import { useEditorStore } from '../../stores/editor-store'
import { LayoutSection } from './LayoutSection'
import { DisplaySection } from './DisplaySection'
import { TypographySection } from './TypographySection'
import { TokenSection } from './TokenSection'
import { SpecBindingSection } from './SpecBindingSection'

export function RightPanel() {
  const isOpen = useEditorStore(s => s.rightPanelOpen)
  const selectedId = useEditorStore(s => s.selectedId)
  const selectedLabel = useEditorStore(s => s.selectedLabel)
  if (!isOpen) return null

  const displayLabel = selectedLabel || selectedId

  return (
    <aside className="w-60 bg-white border-l border-surface-3 flex flex-col shrink-0 z-30 overflow-y-auto">
      <div className="h-10 px-3 flex items-center justify-between border-b border-surface-3 shrink-0">
        <span className="text-xs font-semibold text-ink-1">属性</span>
        {selectedId && (
          <span className="text-[11px] text-brand-600 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
            <span className="truncate max-w-24">{displayLabel}</span>
          </span>
        )}
      </div>

      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-ink-3">选择一个元素查看属性</p>
        </div>
      ) : (
        <>
          <LayoutSection />
          <DisplaySection />
          <TypographySection />
          <TokenSection />
          <SpecBindingSection elementId={selectedId} label={displayLabel} />
        </>
      )}
    </aside>
  )
}
