// 给右栏属性面板的 "当前选中元素快照"。
//
// 设计：
// - 真相是 contentHtml + selectedId；selection-store 自己存的 label/component 是
//   bridge 推断的浮动 meta，不能当作 attr 来源（会过时）
// - 每次 contentHtml 或 selectedId 变 → 重新 parse + querySelector 提取属性
// - 不嫌弃 perf：右栏只在选中时挂载、contentHtml 改完才重算

import { useMemo } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { useSelectionStore } from '../stores/selection-store'

export interface ElementSnapshot {
  sfId: string
  tag: string
  classes: string[]
  /** 解析后的 inline style："color"→"red" */
  styles: Record<string, string>
  /** 除 data-sf-id / class / style 外的所有 attr */
  attrs: Record<string, string>
  /** 是否纯文本叶子节点（只有 text node 子节点 / 无子节点） */
  isTextLeaf: boolean
  /** 纯文本叶子时的 textContent；否则为 null */
  text: string | null
}

const HIDDEN_ATTRS = new Set(['data-sf-id', 'class', 'style'])

function parseStyles(style: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const piece of style.split(';')) {
    const idx = piece.indexOf(':')
    if (idx < 0) continue
    const key = piece.slice(0, idx).trim()
    const value = piece.slice(idx + 1).trim()
    if (key && value) out[key] = value
  }
  return out
}

function isTextLeafElement(el: Element): boolean {
  for (const child of el.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) return false
  }
  return true
}

export function useSelectedElementSnapshot(): ElementSnapshot | null {
  const activePageId = useEditorStore(s => s.activePageId)
  const contentHtml = useEditorStore(s => {
    const page = s.pages.find(p => p.id === activePageId)
    return page?.contentHtml ?? ''
  })
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const primaryId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null

  return useMemo<ElementSnapshot | null>(() => {
    if (!primaryId || !contentHtml) return null
    const doc = new DOMParser().parseFromString(contentHtml, 'text/html')
    const el = doc.querySelector(`[data-sf-id="${primaryId}"]`)
    if (!el) return null

    const attrs: Record<string, string> = {}
    for (const attr of Array.from(el.attributes)) {
      if (HIDDEN_ATTRS.has(attr.name)) continue
      attrs[attr.name] = attr.value
    }
    const isLeaf = isTextLeafElement(el)

    return {
      sfId: primaryId,
      tag: el.tagName.toLowerCase(),
      classes: Array.from(el.classList),
      styles: parseStyles(el.getAttribute('style') || ''),
      attrs,
      isTextLeaf: isLeaf,
      text: isLeaf ? (el.textContent ?? '') : null,
    }
  }, [contentHtml, primaryId])
}
