import { useMemo } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { parseContentHtmlToTree, type TreeNode } from '../utils/parse-html-tree'

/**
 * 监听当前活动页的 contentHtml，产出树。
 * 树身份按 contentHtml 字符串 memo——contentHtml 不变就不重 parse。
 */
export function useHtmlTree(): TreeNode[] {
  const activePageId = useEditorStore(s => s.activePageId)
  const contentHtml = useEditorStore(s => {
    const page = s.pages.find(p => p.id === activePageId)
    return page?.contentHtml ?? ''
  })
  return useMemo(() => parseContentHtmlToTree(contentHtml), [contentHtml])
}
