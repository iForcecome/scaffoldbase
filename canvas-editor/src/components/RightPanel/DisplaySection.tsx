import { useEditorStore } from '../../stores/editor-store'

const displayModes = ['flex', 'grid', 'block', 'none'] as const
const directions = ['row', 'column'] as const
const alignMap = ['flex-start', 'center', 'flex-end']

export function DisplaySection() {
  const selectedId = useEditorStore(s => s.selectedIds.length > 0 ? s.selectedIds[s.selectedIds.length - 1] : null)
  const styles = useEditorStore(s => s.selectedStyles)
  const activePageId = useEditorStore(s => s.activePageId)
  const applySchemaOperations = useEditorStore(s => s.applySchemaOperations)

  const display = styles?.display ?? 'flex'
  const direction = styles?.flexDirection ?? 'row'
  const alignItems = styles?.alignItems ?? 'center'
  const justifyContent = styles?.justifyContent ?? 'flex-start'

  const alignIndex = alignMap.indexOf(alignItems)

  const updateStyle = (prop: string, value: string) => {
    if (!selectedId || !activePageId) return
    applySchemaOperations(activePageId, [{ type: 'updateStyle', target: selectedId, styles: { [prop]: value } }])
  }

  const justifyLabel = justifyContent.replace('space-', '').replace('flex-', '')

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">显示</div>

      <div className="grid grid-cols-4 gap-1 mb-2">
        {displayModes.map(m => (
          <button
            key={m}
            className={`h-7 rounded text-[10px] transition-colors ${
              display === m
                ? 'bg-brand-50 text-brand-600 font-semibold border border-brand-200'
                : 'bg-surface-1 text-ink-3 font-medium hover:bg-surface-2'
            }`}
            onClick={() => updateStyle('display', m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-ink-3 w-12 shrink-0">方向</span>
        <div className="flex-1 flex gap-1">
          {directions.map(d => (
            <button
              key={d}
              className={`flex-1 h-7 rounded text-[10px] transition-colors ${
                direction === d
                  ? 'bg-brand-50 text-brand-600 font-semibold border border-brand-200'
                  : 'bg-surface-1 text-ink-3 font-medium'
              }`}
              onClick={() => updateStyle('flexDirection', d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-ink-3 w-12 shrink-0">对齐</span>
        <div className="flex-1 flex gap-1">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              className={`flex-1 h-7 rounded flex items-center justify-center transition-colors ${
                alignIndex === i
                  ? 'bg-brand-50 border border-brand-200'
                  : 'bg-surface-1 hover:bg-surface-2'
              }`}
              onClick={() => updateStyle('alignItems', alignMap[i])}
            >
              <svg className={`w-3.5 h-3.5 ${alignIndex === i ? 'text-brand-600' : 'text-ink-3'}`} viewBox="0 0 16 16" fill="none">
                {i === 0 && <><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor"/><rect x="1" y="7" width="10" height="2" rx="1" fill="currentColor"/><rect x="1" y="12" width="12" height="2" rx="1" fill="currentColor"/></>}
                {i === 1 && <><rect x="2" y="2" width="12" height="2" rx="1" fill="currentColor"/><rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/><rect x="3" y="12" width="10" height="2" rx="1" fill="currentColor"/></>}
                {i === 2 && <><rect x="1" y="2" width="14" height="2" rx="1" fill="currentColor"/><rect x="5" y="7" width="10" height="2" rx="1" fill="currentColor"/><rect x="3" y="12" width="12" height="2" rx="1" fill="currentColor"/></>}
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-ink-3 w-12 shrink-0">间距</span>
        <div className="flex-1 flex items-center gap-1.5">
          <span className="text-[11px] text-ink-3">justify</span>
          <div className="flex-1 bg-surface-1 rounded px-2 py-1 text-[10px] font-mono text-ink-1 text-center">
            {justifyLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
