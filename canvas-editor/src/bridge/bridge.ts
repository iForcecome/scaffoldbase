/**
 * Bridge script injected into the content iframe.
 * Handles DOM tree parsing, click/hover interception, style modification,
 * and communicates with the parent editor via postMessage.
 *
 * This file is compiled to a string and injected via srcdoc.
 */

const BRIDGE_ATTR = 'data-sf-id'
let idCounter = 0

function assignIds(root: Element) {
  const walk = (el: Element) => {
    if (!el.getAttribute(BRIDGE_ATTR)) {
      el.setAttribute(BRIDGE_ATTR, `sf-${idCounter++}`)
    }
    for (const child of Array.from(el.children)) {
      walk(child)
    }
  }
  walk(root)
}

function inferLabel(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const text = el.textContent?.trim().slice(0, 20) || ''

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') return text || tag.toUpperCase()
  if (tag === 'button') return text || 'Button'
  if (tag === 'input') return `Input[${(el as HTMLInputElement).type}]`
  if (tag === 'table') return 'Table'
  if (tag === 'thead') return 'Table Head'
  if (tag === 'tbody') return 'Table Body'
  if (tag === 'tr') return 'Row'
  if (tag === 'th' || tag === 'td') return text || tag
  if (tag === 'a') return text || 'Link'
  if (tag === 'img') return 'Image'
  if (tag === 'nav') return 'Nav'
  if (tag === 'header') return 'Header'
  if (tag === 'footer') return 'Footer'
  if (tag === 'main') return 'Main'
  if (tag === 'section') return 'Section'
  if (tag === 'aside') return 'Aside'
  if (tag === 'form') return 'Form'
  if (tag === 'ul' || tag === 'ol') return 'List'
  if (tag === 'li') return text || 'List Item'
  if (tag === 'p') return text || 'Paragraph'
  if (tag === 'span') return text || 'Span'
  if (tag === 'svg') return 'SVG'

  const cls = el.className
  if (typeof cls === 'string' && cls.trim()) {
    return cls.trim().split(/\s+/)[0].slice(0, 24)
  }
  return tag
}

interface DOMNodeMsg {
  id: string
  tag: string
  label: string
  rect: { x: number; y: number; width: number; height: number }
  children: DOMNodeMsg[]
}

function rectToObj(r: DOMRect) {
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

function parseDOMTree(el: Element, depth = 0): DOMNodeMsg | null {
  if (depth > 12) return null

  const tag = el.tagName.toLowerCase()
  if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return null

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null

  const children: DOMNodeMsg[] = []
  for (const child of Array.from(el.children)) {
    const node = parseDOMTree(child, depth + 1)
    if (node) children.push(node)
  }

  return {
    id: el.getAttribute(BRIDGE_ATTR) || '',
    tag,
    label: inferLabel(el),
    rect: rectToObj(rect),
    children,
  }
}

function sendTree() {
  const body = document.body
  if (!body) return
  assignIds(body)
  const tree = parseDOMTree(body)
  if (tree) {
    parent.postMessage({ type: 'dom-tree', tree: tree.children }, '*')
  }
}

function getElementById(id: string): Element | null {
  return document.querySelector(`[${BRIDGE_ATTR}="${id}"]`)
}

let highlightOverlay: HTMLDivElement | null = null

function ensureHighlightOverlay(): HTMLDivElement {
  if (!highlightOverlay) {
    highlightOverlay = document.createElement('div')
    highlightOverlay.style.cssText =
      'position:fixed;pointer-events:none;z-index:99999;border:1.5px solid #91a7ff;border-radius:2px;transition:all 0.1s ease;display:none;'
    document.body.appendChild(highlightOverlay)
  }
  return highlightOverlay
}

document.addEventListener('click', (e) => {
  e.preventDefault()
  e.stopPropagation()
  const target = (e.target as Element).closest(`[${BRIDGE_ATTR}]`)
  if (target) {
    const id = target.getAttribute(BRIDGE_ATTR)!
    const rect = target.getBoundingClientRect()
    parent.postMessage({ type: 'element-click', id, rect: rectToObj(rect) }, '*')
  }
}, true)

document.addEventListener('mousemove', (e) => {
  const target = (e.target as Element).closest(`[${BRIDGE_ATTR}]`)
  if (target) {
    const id = target.getAttribute(BRIDGE_ATTR)!
    const rect = target.getBoundingClientRect()
    parent.postMessage({ type: 'element-hover', id, rect: rectToObj(rect) }, '*')
    const ov = ensureHighlightOverlay()
    ov.style.display = 'block'
    ov.style.left = rect.x + 'px'
    ov.style.top = rect.y + 'px'
    ov.style.width = rect.width + 'px'
    ov.style.height = rect.height + 'px'
  }
}, true)

document.addEventListener('mouseleave', () => {
  if (highlightOverlay) highlightOverlay.style.display = 'none'
  parent.postMessage({ type: 'element-hover', id: null, rect: null }, '*')
})

document.addEventListener('dblclick', (e) => {
  e.preventDefault()
  e.stopPropagation()
}, true)

window.addEventListener('message', (e) => {
  const data = e.data
  if (!data || !data.type) return

  switch (data.type) {
    case 'update-style': {
      const el = getElementById(data.id) as HTMLElement | null
      if (el) {
        Object.assign(el.style, data.styles)
        const rect = el.getBoundingClientRect()
        parent.postMessage({ type: 'element-rect-update', id: data.id, rect: rectToObj(rect) }, '*')
        sendTree()
      }
      break
    }
    case 'update-text': {
      const el = getElementById(data.id)
      if (el) {
        el.textContent = data.text
        sendTree()
      }
      break
    }
    case 'get-rect': {
      const el = getElementById(data.id)
      if (el) {
        const rect = el.getBoundingClientRect()
        parent.postMessage({ type: 'element-rect', id: data.id, rect: rectToObj(rect) }, '*')
      }
      break
    }
    case 'highlight': {
      const el = getElementById(data.id)
      if (el) {
        const rect = el.getBoundingClientRect()
        const ov = ensureHighlightOverlay()
        ov.style.display = 'block'
        ov.style.left = rect.x + 'px'
        ov.style.top = rect.y + 'px'
        ov.style.width = rect.width + 'px'
        ov.style.height = rect.height + 'px'
      }
      break
    }
    case 'clear-highlight': {
      if (highlightOverlay) highlightOverlay.style.display = 'none'
      break
    }
    case 'get-html': {
      if (highlightOverlay) highlightOverlay.remove()
      highlightOverlay = null
      const html = document.documentElement.outerHTML
      parent.postMessage({ type: 'html-snapshot', html }, '*')
      ensureHighlightOverlay()
      break
    }
    case 'get-computed-style': {
      const el = getElementById(data.id) as HTMLElement | null
      if (el) {
        const cs = window.getComputedStyle(el)
        const styles: Record<string, string> = {}
        const props = [
          'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
          'width', 'height', 'padding', 'margin',
          'fontSize', 'fontWeight', 'fontFamily', 'color', 'backgroundColor',
          'borderRadius', 'border', 'overflow',
        ]
        for (const p of props) {
          styles[p] = cs.getPropertyValue(
            p.replace(/[A-Z]/g, m => '-' + m.toLowerCase())
          )
        }
        const rect = el.getBoundingClientRect()
        parent.postMessage({ type: 'computed-style', id: data.id, styles, rect: rectToObj(rect) }, '*')
      }
      break
    }
    case 'request-tree': {
      sendTree()
      break
    }
  }
})

window.addEventListener('load', () => {
  parent.postMessage({ type: 'ready' }, '*')
  setTimeout(sendTree, 100)
})

if (document.readyState === 'complete') {
  parent.postMessage({ type: 'ready' }, '*')
  setTimeout(sendTree, 100)
}
