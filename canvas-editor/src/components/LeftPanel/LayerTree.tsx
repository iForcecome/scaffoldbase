// v2 Day 0 占位：v1 schema 树已删除。
// β5 阶段将基于 DOMParser 重新实现「contentHtml → 图层树」。
export function LayerTree() {
  return (
    <div className="p-4 text-[11px] text-ink-3 leading-relaxed">
      <p>图层树（β5 重写中）</p>
      <p className="mt-1 text-ink-4">v2 将直接基于 DOM 解析当前页面的 contentHtml。</p>
    </div>
  )
}
