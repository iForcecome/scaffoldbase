import { useState, useEffect, useRef, useCallback, type RefObject } from 'react'
import { useEditorStore, consumeSuppressReload, sendBridgeMessage } from '../../stores/editor-store'
import { useViewportStore } from '../../stores/viewport-store'
import { useSelectionStore } from '../../stores/selection-store'
import { useToolStore } from '../../stores/tool-store'
import { injectBridge } from '../../utils/inject-bridge'
import { ensureTailwindCdn } from '../../utils/inject-tailwind'

interface ContentIFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>
  deviceWidth: number
  sendToIframe: (msg: Record<string, unknown>) => void
  registerHandler: (type: string, handler: (data: Record<string, unknown>) => void) => () => void
}

function rectToObj(r: DOMRect) {
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

function inferLabelFromEl(el: Element): string {
  const semanticLabel = el.getAttribute('data-sf-label')
  if (semanticLabel) return semanticLabel
  return el.getAttribute('data-sf-id') || el.tagName.toLowerCase()
}

function getDirectText(el: Element): string {
  let text = ''
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent?.trim() ?? ''
  })
  return text.slice(0, 24)
}

function inferSemanticFromEl(el: Element) {
  const tag = el.tagName.toLowerCase()
  const text = (el.textContent || '').trim()

  if (tag === 'header') return { component: 'PageHeader', role: 'header', label: '页面标题区' }
  if (tag === 'nav') return { component: 'Navigation', role: 'navigation', label: '导航菜单' }
  if (tag === 'form') return { component: 'FormSection', role: 'form', label: '表单区' }
  if (tag === 'table') return { component: 'DataTable', role: 'table', label: '数据表格' }
  if (tag === 'button') return { component: 'Button', role: 'action', label: getDirectText(el) || '按钮' }
  if (['h1', 'h2', 'h3'].includes(tag)) return { component: null, role: 'title', label: getDirectText(el) || '标题' }
  if (tag === 'p') return { component: null, role: 'description', label: getDirectText(el) || '描述' }

  if (['div', 'section', 'main', 'article'].includes(tag)) {
    if (el.querySelector(':scope > table') || el.querySelector('table')) {
      return { component: 'DataTable', role: 'table', label: '数据表格' }
    }
    const hasField = !!el.querySelector('input, select, textarea')
    const buttons = el.querySelectorAll('button')
    const hasSearchText = ['搜索', '筛选', '重置', '状态', '日期'].some(keyword => text.includes(keyword))
    if ((hasField && buttons.length > 0) || (hasSearchText && buttons.length >= 1)) {
      return { component: 'FilterBar', role: 'filters', label: '筛选区' }
    }
    const directTitle = el.querySelector(':scope > h1, :scope > h2, :scope > h3')
    if (directTitle && buttons.length > 0) {
      return { component: 'PageHeader', role: 'header', label: '页面标题区' }
    }
    if (el.querySelector('label') && el.querySelector('input, select, textarea')) {
      return { component: 'FormSection', role: 'form', label: '表单区' }
    }
  }

  return { component: null, role: null, label: null }
}

function isDecorativeElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase()
  if (!['div', 'span'].includes(tag)) return false
  if ((el.textContent || '').trim()) return false
  if (el.querySelector('img, svg, canvas, input, select, textarea, button, a')) return false

  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  if (!style) return false
  const className = el.getAttribute('class') || ''
  const isOverlay = (
    style.position === 'absolute' ||
    style.position === 'fixed' ||
    className.includes('absolute') ||
    className.includes('inset-0')
  )
  const isFaint = Number.parseFloat(style.opacity || '1') <= 0.25 || className.includes('opacity-')

  return isOverlay && isFaint
}

function resolveSelectableTarget(el: Element): Element | null {
  let target: Element | null = el.closest('[data-sf-id]')
  while (target && target.parentElement && target.tagName.toLowerCase() !== 'body') {
    if (!isDecorativeElement(target)) return target
    target = target.parentElement.closest('[data-sf-id]') || target.parentElement
  }
  return target
}

const TEXT_TAGS = new Set(['h1','h2','h3','h4','h5','h6','p','span','a','button','label','li','td','th','figcaption','blockquote','caption','dt','dd'])

export function ContentIFrame({ iframeRef, deviceWidth }: ContentIFrameProps) {
  const pageHtml = useEditorStore(s => {
    const page = s.pages.find(p => p.id === s.activePageId)
    return page?.contentHtml || ''
  })
  const sharedHead = useEditorStore(s => s.sharedHead)
  const activePageId = useEditorStore(s => s.activePageId)
  const iframeHeight = useViewportStore(s => s.iframeHeight)
  const setIframeHeight = useViewportStore(s => s.setIframeHeight)
  const isPreview = useToolStore(s => s.activeTool === 'preview')
  const editingTextId = useToolStore(s => s.editingTextId)
  const selectElement = useSelectionStore(s => s.selectElement)
  const hoverElement = useSelectionStore(s => s.hoverElement)
  const setEditingText = useToolStore(s => s.setEditingText)

  const [srcDoc, setSrcDoc] = useState('')
  const prevPageIdRef = useRef(activePageId)

  useEffect(() => {
    const pageChanged = prevPageIdRef.current !== activePageId
    prevPageIdRef.current = activePageId

    if (pageChanged || !consumeSuppressReload()) {
      if (!pageHtml) {
        setSrcDoc('')
      } else {
        const composed = sharedHead
          ? pageHtml.replace('</head>', sharedHead + '</head>')
          : pageHtml
        setSrcDoc(injectBridge(ensureTailwindCdn(composed)))
      }
    }
  }, [pageHtml, sharedHead, activePageId])

  const handleLoad = () => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc?.body) {
        const h = doc.body.scrollHeight
        if (h > 100) setIframeHeight(h)
      }
    } catch {
      // cross-origin, use default
    }
  }

  const getElementAtPoint = useCallback((clientX: number, clientY: number) => {
    const iframe = iframeRef.current
    if (!iframe) return null
    const iframeRect = iframe.getBoundingClientRect()
    const x = clientX - iframeRect.left
    const y = clientY - iframeRect.top
    try {
      const doc = iframe.contentDocument
      if (!doc) return null
      const el = doc.elementFromPoint(x, y)
      if (!el) return null
      const target = resolveSelectableTarget(el)
      if (!target) return null
      const inferred = inferSemanticFromEl(target)
      const sfId = target.getAttribute('data-sf-id')
      return {
        id: sfId!,
        rect: rectToObj(target.getBoundingClientRect()),
        label: target.getAttribute('data-sf-label') || inferred.label || inferLabelFromEl(target),
        sfId,
        component: target.getAttribute('data-sf-component') || inferred.component,
        role: target.getAttribute('data-sf-role') || inferred.role,
        variant: target.getAttribute('data-sf-variant'),
        specPath: null,
      }
    } catch {
      return null
    }
  }, [activePageId, iframeRef])

  const handleOverlayMove = useCallback((e: React.MouseEvent) => {
    const hit = getElementAtPoint(e.clientX, e.clientY)
    if (hit) {
      const sel = useSelectionStore.getState()
      if (!sel.selectedIds.includes(hit.id)) {
        hoverElement(hit.id, hit.rect)
      }
    } else {
      hoverElement(null)
    }
  }, [getElementAtPoint, hoverElement])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    const hit = getElementAtPoint(e.clientX, e.clientY)
    if (hit) {
      const multi = e.shiftKey || e.metaKey || e.ctrlKey
      selectElement(hit.id, hit.rect, hit.label, multi, {
        sfId: hit.sfId,
        component: hit.component,
        role: hit.role,
        variant: hit.variant,
        specPath: hit.specPath,
      })
      if (hit.id) {
        sendBridgeMessage({ type: 'get-computed-style', id: hit.id })
      }
    }
  }, [getElementAtPoint, selectElement])

  const handleOverlayLeave = useCallback(() => {
    hoverElement(null)
  }, [hoverElement])

  const handleOverlayDblClick = useCallback((e: React.MouseEvent) => {
    const hit = getElementAtPoint(e.clientX, e.clientY)
    if (!hit) return
    try {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const el = doc.querySelector(`[data-sf-id="${hit.id}"]`)
      if (!el) return
      const tag = el.tagName.toLowerCase()
      if (TEXT_TAGS.has(tag)) {
        setEditingText(hit.id)
        sendBridgeMessage({ type: 'start-edit', id: hit.id })
      }
    } catch { /* ignore */ }
  }, [getElementAtPoint, iframeRef, setEditingText])

  const isEditing = editingTextId !== null

  return (
    <div className="relative" style={{ width: deviceWidth, height: iframeHeight }}>
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
        className="block border-none absolute inset-0"
        style={{
          width: deviceWidth,
          height: iframeHeight,
          pointerEvents: (isPreview || isEditing) ? 'auto' : 'none',
        }}
        title="Page Preview"
        onLoad={handleLoad}
      />
      {!isPreview && !isEditing && (
        <div
          className="absolute inset-0 z-10"
          style={{ cursor: 'default' }}
          onMouseMove={handleOverlayMove}
          onClick={handleOverlayClick}
          onDoubleClick={handleOverlayDblClick}
          onMouseLeave={handleOverlayLeave}
        />
      )}
    </div>
  )
}
