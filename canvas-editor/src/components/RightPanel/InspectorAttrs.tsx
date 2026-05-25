import { useState } from 'react'
import { dispatchTools } from '../../tools'
import type { ElementSnapshot } from '../../hooks/use-selected-element'

interface Props {
  snapshot: ElementSnapshot
}

export function InspectorAttrs({ snapshot }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [newName, setNewName] = useState('')
  const [newValue, setNewValue] = useState('')

  const entries = Object.entries(snapshot.attrs)

  const setAttr = (name: string, value: string) => {
    void dispatchTools([{ name: 'dom_set_attr', params: { sfId: snapshot.sfId, name, value } }])
  }

  const removeAttr = (name: string) => {
    void dispatchTools([{ name: 'dom_remove_attr', params: { sfId: snapshot.sfId, name } }])
  }

  const addAttr = () => {
    const n = newName.trim()
    if (!n) return
    setAttr(n, newValue)
    setNewName('')
    setNewValue('')
  }

  return (
    <div className="p-3 border-b border-surface-3">
      <button
        type="button"
        className="flex items-center gap-1.5 w-full text-left mb-2"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">属性</span>
        <span className="text-[10px] text-ink-3">{entries.length}</span>
        <span className="ml-auto text-[10px] text-ink-3">{expanded ? '收起' : '展开'}</span>
      </button>
      {expanded && (
        <>
          {entries.length > 0 ? (
            <div className="space-y-1 mb-2">
              {entries.map(([name, value]) => (
                <AttrRow
                  key={name}
                  name={name}
                  value={value}
                  onCommit={v => setAttr(name, v)}
                  onRemove={() => removeAttr(name)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-ink-3 mb-2">暂无属性</p>
          )}
          <div className="flex items-center gap-1.5">
            <input
              className="w-16 bg-surface-1 rounded-md px-2 py-1 text-[11px] font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="name"
            />
            <input
              className="flex-1 bg-surface-1 rounded-md px-2 py-1 text-[11px] font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400 w-0"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder="value"
              onKeyDown={e => { if (e.key === 'Enter') addAttr() }}
            />
            <button
              type="button"
              className="text-[11px] text-brand-600 hover:text-brand-700 px-1.5 py-1 shrink-0"
              onClick={addAttr}
            >
              加
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function AttrRow({ name, value, onCommit, onRemove }: {
  name: string
  value: string
  onCommit: (value: string) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState(value)
  // value 由父级 snapshot 驱动，本地 draft 仅短期承载编辑中的输入
  // 当外部 value 变（其他来源改了）时同步 — 用 key={name+value} 避免脏读

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-16 text-[11px] font-mono text-ink-2 truncate shrink-0" title={name}>{name}</span>
      <input
        className="flex-1 bg-surface-1 rounded-md px-2 py-1 text-[11px] font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400 w-0"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onCommit(draft) }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(value); (e.target as HTMLInputElement).blur() }
        }}
      />
      <button
        type="button"
        className="text-ink-3 hover:text-red-500 text-sm leading-none px-1 shrink-0"
        onClick={onRemove}
        aria-label={`删除属性 ${name}`}
      >
        ×
      </button>
    </div>
  )
}
