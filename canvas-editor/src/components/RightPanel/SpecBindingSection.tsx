import { Link, Box, CheckCircle } from 'lucide-react'
import type { SelectedElement } from '../../stores/editor-store'
import { deriveSpecPath } from '../../utils/spec-path'

export function SpecBindingSection({
  pageId,
  elementId,
  element,
  label,
}: {
  pageId: string
  elementId: string
  element: SelectedElement | null
  label: string | null
}) {
  const displayLabel = label || elementId
  const sfId = element?.sfId || elementId
  const component = element?.component || displayLabel
  const role = element?.role || '未识别'
  const specBindingElement = element ?? {
    sfId,
    component,
    role,
    label: displayLabel,
    specPath: null,
  }
  const specPath = deriveSpecPath(pageId, specBindingElement)

  return (
    <div className="p-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">语义 / Spec</div>
      <div className="bg-surface-1 rounded-lg p-2.5 text-xs space-y-1.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Link className="w-3 h-3 text-brand-500 shrink-0" />
          <span className="text-ink-1 font-medium truncate" title={specPath}>{specPath}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-3 h-3 text-purple-500 shrink-0" />
          <span className="text-ink-2 truncate">组件：{component}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <Box className="w-3 h-3 text-blue-500 shrink-0" />
          <span className="text-ink-2 truncate">角色：{role}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
          <span className="text-green-600">{element?.specPath ? 'Spec 已绑定' : '等待确认'}</span>
        </div>
      </div>
    </div>
  )
}
