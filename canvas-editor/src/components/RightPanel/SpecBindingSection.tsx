import { Link, Box, CheckCircle } from 'lucide-react'

export function SpecBindingSection({ elementId, label }: { elementId: string; label: string | null }) {
  const displayLabel = label || elementId

  return (
    <div className="p-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">Spec 绑定</div>
      <div className="bg-surface-1 rounded-lg p-2.5 text-xs space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link className="w-3 h-3 text-brand-500 shrink-0" />
          <span className="text-ink-1 font-medium truncate">pages.order-list.{displayLabel}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-3 h-3 text-purple-500 shrink-0" />
          <span className="text-ink-2 truncate">组件：{displayLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
          <span className="text-green-600">Spec 一致</span>
        </div>
      </div>
    </div>
  )
}
