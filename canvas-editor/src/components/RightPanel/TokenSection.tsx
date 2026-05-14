export function TokenSection() {
  const tokens = [
    { prop: 'font-size', value: 'text-xl' },
    { prop: 'font-weight', value: 'font-bold' },
    { prop: 'color', value: 'ink-0' },
    { prop: 'margin-bottom', value: 'mb-5' },
  ]

  return (
    <div className="p-3 border-b border-surface-3">
      <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">Design Token</div>
      <div className="space-y-1.5">
        {tokens.map(t => (
          <div key={t.prop} className="flex items-center justify-between gap-2 text-xs min-w-0">
            <span className="text-ink-2 shrink-0">{t.prop}</span>
            <span className="font-mono text-brand-600 bg-brand-50 px-1.5 rounded truncate">{t.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
