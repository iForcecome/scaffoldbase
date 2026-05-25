import { useSelectedElementSnapshot } from '../../hooks/use-selected-element'
import { InspectorContent } from './InspectorContent'
import { InspectorClasses } from './InspectorClasses'
import { InspectorStyle } from './InspectorStyle'
import { InspectorAttrs } from './InspectorAttrs'

export function ElementInspector() {
  const snapshot = useSelectedElementSnapshot()
  if (!snapshot) {
    return (
      <div className="p-3 text-[11px] text-ink-3">已选元素未在当前页面中找到。</div>
    )
  }
  return (
    <div className="flex flex-col" data-testid="element-inspector">
      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5">元素</div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-mono text-brand-600">&lt;{snapshot.tag}&gt;</span>
          <span className="text-[10px] text-ink-3 font-mono truncate" title={snapshot.sfId}>{snapshot.sfId}</span>
        </div>
      </div>
      <InspectorContent snapshot={snapshot} />
      <InspectorClasses snapshot={snapshot} />
      <InspectorStyle snapshot={snapshot} />
      <InspectorAttrs snapshot={snapshot} />
    </div>
  )
}
