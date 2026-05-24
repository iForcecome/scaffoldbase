import type { SelectedElement } from '../../stores/editor-store'

export function SpecBindingSection(_props: {
  pageId: string
  elementId: string
  element: SelectedElement | null
  label: string | null
}) {
  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">Spec 绑定</div>
      <p className="text-[11px] text-ink-3">β7 重写中</p>
    </div>
  )
}
