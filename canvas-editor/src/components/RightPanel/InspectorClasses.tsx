import { useState } from 'react'
import { dispatchTools } from '../../tools'
import type { ElementSnapshot } from '../../hooks/use-selected-element'

interface Props {
  snapshot: ElementSnapshot
}

export function InspectorClasses({ snapshot }: Props) {
  const [draft, setDraft] = useState('')

  const removeClass = (cls: string) => {
    void dispatchTools([{ name: 'dom_remove_class', params: { sfId: snapshot.sfId, classNames: [cls] } }])
  }

  const addClasses = () => {
    const tokens = draft.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return
    void dispatchTools([{ name: 'dom_add_class', params: { sfId: snapshot.sfId, classNames: tokens } }])
    setDraft('')
  }

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">Class</div>
      {snapshot.classes.length > 0 ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {snapshot.classes.map(cls => (
            <span
              key={cls}
              className="inline-flex items-center gap-1 bg-surface-1 rounded px-1.5 py-0.5 text-[11px] font-mono text-ink-1 group"
            >
              <span>{cls}</span>
              <button
                type="button"
                className="text-ink-3 hover:text-red-500 leading-none"
                onClick={() => removeClass(cls)}
                aria-label={`删除 ${cls}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-ink-3 mb-2">暂无 class</p>
      )}
      <input
        className="w-full bg-surface-1 rounded-md px-2 py-1.5 text-[11px] font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addClasses()
          }
        }}
        onBlur={addClasses}
        placeholder="加 class（空格分隔，回车提交）"
      />
    </div>
  )
}
