import { useState } from 'react'
import { dispatchTools } from '../../tools'
import type { ElementSnapshot } from '../../hooks/use-selected-element'

interface Props {
  snapshot: ElementSnapshot
}

export function InspectorContent({ snapshot }: Props) {
  const [draft, setDraft] = useState(snapshot.text ?? '')
  // 切换元素或外部 text 变化时，render 阶段同步 draft（React 19 推荐：
  // 渲染期 setState 比 useEffect 同步开销小，React 会丢弃首次 render 输出）
  const [lastKey, setLastKey] = useState(snapshot.sfId + ':' + (snapshot.text ?? ''))
  const nextKey = snapshot.sfId + ':' + (snapshot.text ?? '')
  if (lastKey !== nextKey) {
    setLastKey(nextKey)
    setDraft(snapshot.text ?? '')
  }

  if (!snapshot.isTextLeaf) {
    return (
      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">文字</div>
        <p className="text-[11px] text-ink-3">非纯文本元素（含子节点）。改文本请用 AI 聊天，或在 iframe 内双击。</p>
      </div>
    )
  }

  const commit = () => {
    const next = draft
    if (next === (snapshot.text ?? '')) return
    void dispatchTools([{ name: 'dom_set_text', params: { sfId: snapshot.sfId, text: next } }])
  }

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">文字</div>
      <textarea
        className="w-full bg-surface-1 rounded-md px-2 py-1.5 text-xs text-ink-0 outline-none focus:ring-1 focus:ring-brand-400 resize-y min-h-[64px]"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur()
        }}
        placeholder="输入文字..."
      />
      <p className="text-[10px] text-ink-3 mt-1">⌘+Enter 提交</p>
    </div>
  )
}
