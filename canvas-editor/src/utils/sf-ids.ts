// sf-id 持久化层 —— content-html 的 DOM 操作前置。
//
// 决策：
// - 只持久化 `data-sf-id`（DOM 操作工具按它定位元素）
// - 语义属性（data-sf-component / role / variant / label）保持 ephemeral，
//   由 iframe 内的 bridge-script runtime 重新推断；这样 contentHtml 干净，
//   且 textContent 改了 label 也自动跟着变
// - 序遍历稳定：同样 HTML 输入产出同样 sf-id 序列
//
// 不使用模板字符串/正则解析 HTML —— 用 DOMParser，避免 SAX 边界问题。

const SF_ID_ATTR = 'data-sf-id'

interface ParseResult {
  doc: Document
  hadDoctype: boolean
  hadHtmlWrapper: boolean
}

function parseHtml(html: string): ParseResult {
  const trimmed = html.trim()
  const hadDoctype = /^<!DOCTYPE/i.test(trimmed)
  const hadHtmlWrapper = /<html[\s>]/i.test(trimmed) || hadDoctype
  // DOMParser 会自动补全 html / head / body —— 我们记下原本有没有
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return { doc, hadDoctype, hadHtmlWrapper }
}

function serializeHtml(parsed: ParseResult): string {
  const { doc, hadDoctype, hadHtmlWrapper } = parsed
  if (hadHtmlWrapper) {
    const docType = hadDoctype ? '<!DOCTYPE html>\n' : ''
    return docType + doc.documentElement.outerHTML
  }
  // 原始是片段（无 <html>），只取 body 内部
  return doc.body.innerHTML
}

/**
 * 给所有缺 sf-id 的元素分配 id。BFS 序遍历，从已有最大 id 之后续编号。
 * 已有 id 的元素保留。返回新的 contentHtml 字符串。
 */
export function assignSfIds(contentHtml: string): string {
  if (!contentHtml) return contentHtml
  const parsed = parseHtml(contentHtml)
  const root = parsed.doc.body || parsed.doc.documentElement
  if (!root) return contentHtml

  // 找已有的最大编号，避免冲突
  let maxId = -1
  root.querySelectorAll<HTMLElement>(`[${SF_ID_ATTR}]`).forEach(el => {
    const v = el.getAttribute(SF_ID_ATTR) || ''
    const m = /^sf-(\d+)$/.exec(v)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxId) maxId = n
    }
  })

  let next = maxId + 1
  const walk = (el: Element) => {
    if (!el.getAttribute(SF_ID_ATTR)) {
      el.setAttribute(SF_ID_ATTR, `sf-${next++}`)
    }
    for (let i = 0; i < el.children.length; i++) walk(el.children[i])
  }
  walk(root)

  return serializeHtml(parsed)
}

/** 给一段 HTML 片段分配 sf-id（用于 insert_html / replace_html op 内的新元素）。 */
export function assignSfIdsToFragment(fragmentHtml: string, startFrom: number): { html: string; nextId: number } {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = fragmentHtml
  let next = startFrom
  const walk = (el: Element) => {
    if (!el.getAttribute(SF_ID_ATTR)) {
      el.setAttribute(SF_ID_ATTR, `sf-${next++}`)
    }
    for (let i = 0; i < el.children.length; i++) walk(el.children[i])
  }
  for (let i = 0; i < wrapper.children.length; i++) walk(wrapper.children[i])
  return { html: wrapper.innerHTML, nextId: next }
}

/** 找一段 contentHtml 里已用过的最大 sf-id 编号，+1 作为下一个起点。 */
export function nextSfIdSeed(contentHtml: string): number {
  const parsed = parseHtml(contentHtml)
  let maxId = -1
  parsed.doc.querySelectorAll<HTMLElement>(`[${SF_ID_ATTR}]`).forEach(el => {
    const v = el.getAttribute(SF_ID_ATTR) || ''
    const m = /^sf-(\d+)$/.exec(v)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > maxId) maxId = n
    }
  })
  return maxId + 1
}

export { parseHtml, serializeHtml, SF_ID_ATTR }
export type { ParseResult }
