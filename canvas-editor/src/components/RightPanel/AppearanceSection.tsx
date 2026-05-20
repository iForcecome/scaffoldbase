import { useState, useEffect } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { useSelectionStore } from '../../stores/selection-store'

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return rgb
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(+m[1])}${hex(+m[2])}${hex(+m[3])}`
}

export function AppearanceSection() {
  const selectedId = useSelectionStore(s => s.selectedIds.length > 0 ? s.selectedIds[s.selectedIds.length - 1] : null)
  const styles = useSelectionStore(s => s.selectedStyles)
  const activePageId = useEditorStore(s => s.activePageId)
  const applySchemaOperations = useEditorStore(s => s.applySchemaOperations)

  const [bgColor, setBgColor] = useState('')
  const [borderRadius, setBorderRadius] = useState('')
  const [borderWidth, setBorderWidth] = useState('')
  const [borderColor, setBorderColor] = useState('')
  const [opacity, setOpacity] = useState('1')

  useEffect(() => {
    if (!styles) return
    setBgColor(rgbToHex(styles.backgroundColor ?? ''))
    setBorderRadius(parseFloat(styles.borderRadius ?? '0') ? styles.borderRadius?.replace('px', '') ?? '' : '')
    setBorderWidth(parseFloat(styles.borderTopWidth ?? '0') ? styles.borderTopWidth?.replace('px', '') ?? '' : '')
    setBorderColor(rgbToHex(styles.borderTopColor ?? ''))
    setOpacity(styles.opacity ?? '1')
  }, [styles])

  const updateStyle = (prop: string, value: string) => {
    if (!selectedId || !activePageId) return
    applySchemaOperations(activePageId, [{ type: 'updateStyle', target: selectedId, styles: { [prop]: value } }])
  }

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">外观</div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-3 w-10 shrink-0">背景</span>
          <input
            type="color"
            className="w-6 h-6 rounded border border-surface-3 cursor-pointer p-0.5 shrink-0"
            value={bgColor.startsWith('#') ? bgColor : '#ffffff'}
            onChange={e => { setBgColor(e.target.value); updateStyle('backgroundColor',e.target.value) }}
          />
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400 w-0"
            value={bgColor}
            onChange={e => setBgColor(e.target.value)}
            onBlur={() => updateStyle('backgroundColor',bgColor)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder="transparent"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-3 w-10 shrink-0">圆角</span>
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400 w-0"
            value={borderRadius}
            onChange={e => setBorderRadius(e.target.value)}
            onBlur={() => updateStyle('borderRadius', borderRadius ? borderRadius + 'px' : '0')}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder="0"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-3 w-10 shrink-0">边框</span>
          <input
            className="w-12 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
            value={borderWidth}
            onChange={e => setBorderWidth(e.target.value)}
            onBlur={() => updateStyle('borderWidth', borderWidth ? borderWidth + 'px' : '0')}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder="0"
          />
          <input
            type="color"
            className="w-6 h-6 rounded border border-surface-3 cursor-pointer p-0.5 shrink-0"
            value={borderColor.startsWith('#') ? borderColor : '#000000'}
            onChange={e => { setBorderColor(e.target.value); updateStyle('borderColor', e.target.value) }}
          />
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400 w-0"
            value={borderColor}
            onChange={e => setBorderColor(e.target.value)}
            onBlur={() => updateStyle('borderColor', borderColor)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            placeholder="#000000"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-3 w-10 shrink-0">透明</span>
          <input
            type="range"
            min="0" max="1" step="0.05"
            className="flex-1 h-1.5 accent-brand-500"
            value={opacity}
            onChange={e => { setOpacity(e.target.value); updateStyle('opacity', e.target.value) }}
          />
          <span className="text-[10px] font-mono text-ink-2 w-8 text-right">{Math.round(+opacity * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
