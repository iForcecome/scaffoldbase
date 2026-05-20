import { useEditorStore } from '../../stores/editor-store'
import { useSelectionStore } from '../../stores/selection-store'

export function TypographySection() {
  const selectedId = useSelectionStore(s => s.selectedIds.length > 0 ? s.selectedIds[s.selectedIds.length - 1] : null)
  const styles = useSelectionStore(s => s.selectedStyles)
  const activePageId = useEditorStore(s => s.activePageId)
  const applySchemaOperations = useEditorStore(s => s.applySchemaOperations)

  const fontSize = styles?.fontSize ?? ''
  const fontWeight = styles?.fontWeight ?? ''
  const color = styles?.color ?? '#0f172a'

  const updateStyle = (prop: string, value: string) => {
    if (!selectedId || !activePageId) return
    applySchemaOperations(activePageId, [{ type: 'updateStyle', target: selectedId, styles: { [prop]: value } }])
  }

  const sizeLabel = fontSize ? `${parseFloat(fontSize)}px` : '--'
  const weightLabel = fontWeight || '--'

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">文字样式</div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-3 w-10">大小</span>
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
            defaultValue={sizeLabel}
            key={sizeLabel}
            onBlur={e => {
              const v = e.target.value.replace('px', '').trim()
              if (v) updateStyle('fontSize', v + 'px')
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-3 w-10">粗细</span>
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
            defaultValue={weightLabel}
            key={weightLabel}
            onBlur={e => updateStyle('fontWeight', e.target.value.trim())}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-3 w-10">颜色</span>
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="color"
              className="w-5 h-5 rounded border border-surface-3 cursor-pointer p-0"
              value={rgbToHex(color)}
              onChange={e => updateStyle('color', e.target.value)}
            />
            <input
              className="flex-1 text-xs font-mono text-ink-2 bg-transparent outline-none"
              defaultValue={rgbToHex(color)}
              key={color}
              onBlur={e => updateStyle('color', e.target.value.trim())}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function rgbToHex(rgb: string): string {
  if (rgb.startsWith('#')) return rgb
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return '#000000'
  return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}
