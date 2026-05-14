export function SpecStatus() {
  return (
    <div className="border-t border-surface-3 p-3 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-ink-2">Spec 状态</span>
        <span className="flex items-center gap-1 text-[11px] text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          已同步
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <span className="spec-mini-tag bg-brand-50 text-brand-600">3 页面</span>
        <span className="spec-mini-tag bg-purple-50 text-purple-600">4 实体</span>
        <span className="spec-mini-tag bg-pink-50 text-pink-600">12 Token</span>
      </div>
    </div>
  )
}
