import { defaultTokens } from '../../design-system/tokens'
import { useEditorStore } from '../../stores/editor-store'
import { useSelectionStore } from '../../stores/selection-store'

function countTokenLeaves(value: unknown): number {
  if (Array.isArray(value)) {
    let total = 0
    for (const item of value) total += countTokenLeaves(item)
    return total
  }
  if (value && typeof value === 'object') {
    let total = 0
    for (const item of Object.values(value as Record<string, unknown>)) total += countTokenLeaves(item)
    return total
  }
  return 1
}

export function SpecStatus() {
  const pageCount = useEditorStore(s => s.pages.length)
  const semanticIndex = useSelectionStore(s => s.semanticIndex)
  const dirtyCount = useEditorStore(s => s.dirtyPageIds.length)
  const tokenCount = countTokenLeaves(defaultTokens)

  return (
    <div className="border-t border-surface-3 p-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-ink-2">Spec 状态</span>
        <span className="flex items-center gap-1 text-[11px] text-green-600">
          <span className={`w-1.5 h-1.5 rounded-full ${dirtyCount > 0 ? 'bg-amber-500' : 'bg-green-500'}`} />
          {dirtyCount > 0 ? '有未保存更改' : '已同步'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="spec-mini-tag bg-brand-50 text-brand-600">{pageCount} 页面</span>
        <span className="spec-mini-tag bg-purple-50 text-purple-600">{semanticIndex.length} 节点</span>
        <span className="spec-mini-tag bg-pink-50 text-pink-600">{tokenCount} Token</span>
      </div>
    </div>
  )
}
