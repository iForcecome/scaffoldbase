// contentHtml → 图层树
//
// 与 useSelectedElementSnapshot 一样用 DOMParser；树视图每次都重 parse。
// 性能没问题（contentHtml ≤ 几百 KB，浏览器 parse 速度毫秒级）。
//
// label 用最简规则：tag + 截断的文本预览。bridge-script 里的 inferLabel 那套
// 用于 iframe runtime（选中显示），左栏树用更紧凑的一行展示，简化版即可。

export interface TreeNode {
  sfId: string
  tag: string
  label: string
  /** 用于缩进与折叠 */
  depth: number
  children: TreeNode[]
}

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

function previewText(el: Element): string {
  // 取自己的 textContent，去前后空白和换行折叠
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > 16 ? text.slice(0, 16) + '…' : text
}

function inferLabel(el: Element): string {
  const tag = el.tagName.toLowerCase()
  // void / 媒体 / 输入类：tag + 关键 attr
  if (tag === 'img') {
    const alt = el.getAttribute('alt')
    return alt ? `img · ${alt.slice(0, 12)}` : 'img'
  }
  if (tag === 'input') {
    const type = el.getAttribute('type') || 'text'
    const name = el.getAttribute('name') || el.getAttribute('placeholder') || ''
    return name ? `input[${type}] · ${name.slice(0, 12)}` : `input[${type}]`
  }
  if (VOID_TAGS.has(tag)) return tag

  // 优先看 data-sf-label（bridge-script 推断完写入了 iframe 内 DOM，但 contentHtml 里
  // 通常没有；这里是兜底）
  const sfLabel = el.getAttribute('data-sf-label')
  if (sfLabel) return sfLabel

  const text = previewText(el)
  return text ? `${tag} · ${text}` : tag
}

function buildNode(el: Element, depth: number): TreeNode {
  const sfId = el.getAttribute('data-sf-id') || ''
  const children: TreeNode[] = []
  for (const child of Array.from(el.children)) {
    children.push(buildNode(child, depth + 1))
  }
  return {
    sfId,
    tag: el.tagName.toLowerCase(),
    label: inferLabel(el),
    depth,
    children,
  }
}

/**
 * 从完整 contentHtml 解析出树，根为 body 的直接子元素们（body 本身作为顶层
 * 不展示，避免每次都多一层缩进；body 选中通过别的方式触发即可）。
 * 但保留 body 作为隐藏根，sfId="sf-0" 仍能通过其他渠道找到。
 */
export function parseContentHtmlToTree(contentHtml: string): TreeNode[] {
  if (!contentHtml) return []
  const doc = new DOMParser().parseFromString(contentHtml, 'text/html')
  const body = doc.body
  if (!body) return []
  // body 作为根挂出来；用户可视化操作通常从 body 开始
  return [buildNode(body, 0)]
}

/** 收集树里所有 sfId（含根），便于 expand-all / Set 操作 */
export function collectSfIds(nodes: TreeNode[]): string[] {
  const out: string[] = []
  const walk = (n: TreeNode) => {
    if (n.sfId) out.push(n.sfId)
    for (const c of n.children) walk(c)
  }
  for (const n of nodes) walk(n)
  return out
}
