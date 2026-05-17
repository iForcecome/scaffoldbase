import type { DOMNode } from '../stores/editor-store'
import type { ComponentNode, PageLayout, PageSchema } from './types'

function inferLayoutFromPage(pageId: string, title: string): PageLayout {
  const text = `${pageId} ${title}`.toLowerCase()
  if (text.includes('详情')) return 'detail'
  if (text.includes('设置')) return 'settings'
  if (text.includes('表单') || text.includes('配置')) return 'form-flow'
  if (text.includes('落地页') || text.includes('首页') || text.includes('营销')) return 'marketing'
  return 'dashboard'
}

function toComponentNode(node: DOMNode): ComponentNode | null {
  const children = node.children.map(toComponentNode).filter(Boolean) as ComponentNode[]
  const component = node.component || node.semanticLabel ? (node.component || 'Region') : null

  if (!component && children.length === 0) return null

  return {
    id: node.sfId || node.id,
    component: component || 'Region',
    role: node.role || undefined,
    label: node.semanticLabel || node.label,
    variant: node.variant || undefined,
    props: {},
    children: children.length > 0 ? children : undefined,
  }
}

export function buildPageSchemaFromDomTree(pageId: string, title: string, domTree: DOMNode[]): PageSchema | null {
  const sections = domTree.map(toComponentNode).filter(Boolean) as ComponentNode[]
  if (sections.length === 0) return null

  return {
    page: {
      id: pageId,
      title,
      layout: inferLayoutFromPage(pageId, title),
      sections,
    },
  }
}

