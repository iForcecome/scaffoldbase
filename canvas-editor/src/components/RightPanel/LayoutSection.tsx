import { useState, useEffect } from 'react'
import { useEditorStore, sendBridgeMessage } from '../../stores/editor-store'

function parsePx(raw: string | undefined): string {
  if (!raw) return '0'
  return String(Math.round(parseFloat(raw)))
}

function parsePadding(raw: string): [string, string, string, string] {
  const parts = raw.replace(/px/g, '').trim().split(/\s+/)
  if (parts.length === 1) return [parts[0], parts[0], parts[0], parts[0]]
  if (parts.length === 2) return [parts[0], parts[1], parts[0], parts[1]]
  if (parts.length === 3) return [parts[0], parts[1], parts[2], parts[1]]
  return [parts[0], parts[1], parts[2], parts[3]]
}

export function LayoutSection() {
  const rect = useEditorStore(s => s.selectedRect)
  const styles = useEditorStore(s => s.selectedStyles)
  const selectedId = useEditorStore(s => s.selectedId)

  const x = Math.round(rect?.x ?? 0)
  const y = Math.round(rect?.y ?? 0)

  const wFromStyle = parsePx(styles?.width)
  const hFromStyle = parsePx(styles?.height)
  const wDisplay = styles?.width ? wFromStyle : String(Math.round(rect?.width ?? 0))
  const hDisplay = styles?.height ? hFromStyle : String(Math.round(rect?.height ?? 0))

  const [wLocal, setWLocal] = useState(wDisplay)
  const [hLocal, setHLocal] = useState(hDisplay)
  const [padValues, setPadValues] = useState<[string, string, string, string]>(['0', '0', '0', '0'])

  useEffect(() => { setWLocal(wDisplay) }, [wDisplay])
  useEffect(() => { setHLocal(hDisplay) }, [hDisplay])
  useEffect(() => {
    setPadValues(parsePadding(styles?.padding ?? '0'))
  }, [styles?.padding])

  const updateStyle = (prop: string, value: string) => {
    if (!selectedId) return
    sendBridgeMessage({ type: 'update-style', id: selectedId, styles: { [prop]: value } })
    sendBridgeMessage({ type: 'get-computed-style', id: selectedId })
  }

  const commitW = () => {
    if (wLocal !== wDisplay) updateStyle('width', wLocal + 'px')
  }
  const commitH = () => {
    if (hLocal !== hDisplay) updateStyle('height', hLocal + 'px')
  }

  const handlePadChange = (index: number, value: string) => {
    const next = [...padValues] as [string, string, string, string]
    next[index] = value
    setPadValues(next)
    updateStyle('padding', next.map(v => v + 'px').join(' '))
  }

  const padLabels = ['上', '右', '下', '左']

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">布局</div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'X', value: String(x) },
          { label: 'Y', value: String(y) },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-3 w-3">{item.label}</span>
            <div className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 text-center">
              {item.value}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-3 w-3">W</span>
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 text-center outline-none focus:ring-1 focus:ring-brand-400 w-0"
            value={wLocal}
            onChange={e => setWLocal(e.target.value)}
            onBlur={commitW}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-3 w-3">H</span>
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 text-center outline-none focus:ring-1 focus:ring-brand-400 w-0"
            value={hLocal}
            onChange={e => setHLocal(e.target.value)}
            onBlur={commitH}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {padLabels.map((label, i) => (
          <div key={label} className="flex flex-col items-center">
            <input
              className="bg-surface-1 rounded px-1.5 py-1 text-[10px] font-mono text-ink-2 text-center w-full outline-none focus:ring-1 focus:ring-brand-400"
              value={padValues[i]}
              onChange={e => handlePadChange(i, e.target.value)}
            />
            <span className="text-[9px] text-ink-4 mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
