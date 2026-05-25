import { useState } from 'react'
import { dispatchTools } from '../../tools'
import type { ElementSnapshot } from '../../hooks/use-selected-element'

// 高频内联样式：保持精简，需要更多时鼓励改 class。
// 顺序按修改频率排，最常改的在最上。
const STYLE_KEYS = [
  { key: 'color', label: '颜色', placeholder: '#222 / red' },
  { key: 'background-color', label: '背景', placeholder: '#f5f5f5' },
  { key: 'font-size', label: '字号', placeholder: '14px' },
  { key: 'font-weight', label: '字重', placeholder: '500' },
  { key: 'padding', label: 'Padding', placeholder: '8px 16px' },
  { key: 'margin', label: 'Margin', placeholder: '0 auto' },
  { key: 'width', label: '宽度', placeholder: '100% / 320px' },
  { key: 'height', label: '高度', placeholder: 'auto / 48px' },
] as const

interface Props {
  snapshot: ElementSnapshot
}

function snapshotKey(snapshot: ElementSnapshot): string {
  return snapshot.sfId + ':' + STYLE_KEYS.map(s => snapshot.styles[s.key] ?? '').join('|')
}

function initDrafts(snapshot: ElementSnapshot): Record<string, string> {
  return Object.fromEntries(STYLE_KEYS.map(s => [s.key, snapshot.styles[s.key] ?? '']))
}

export function InspectorStyle({ snapshot }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => initDrafts(snapshot))
  // 切换元素或外部 style 变（commit 后 / AI 改完）时重置 drafts。
  // render 阶段 setState 是 React 19 推荐的 "sync state from props" 模式
  const [lastKey, setLastKey] = useState(snapshotKey(snapshot))
  const nextKey = snapshotKey(snapshot)
  if (lastKey !== nextKey) {
    setLastKey(nextKey)
    setDrafts(initDrafts(snapshot))
  }

  const commit = (key: string) => {
    const next = drafts[key] ?? ''
    const current = snapshot.styles[key] ?? ''
    if (next === current) return
    void dispatchTools([{ name: 'dom_set_style', params: { sfId: snapshot.sfId, property: key, value: next } }])
  }

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">样式</div>
      <div className="space-y-1.5">
        {STYLE_KEYS.map(({ key, label, placeholder }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-3 w-14 shrink-0">{label}</span>
            <input
              className="flex-1 bg-surface-1 rounded-md px-2 py-1 text-[11px] font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400 w-0"
              value={drafts[key] ?? ''}
              onChange={e => setDrafts(prev => ({ ...prev, [key]: e.target.value }))}
              onBlur={() => commit(key)}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-ink-3 mt-1.5">留空回车 = 删除该样式</p>
    </div>
  )
}
