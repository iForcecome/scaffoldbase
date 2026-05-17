import type { DOMNode } from '../stores/editor-store'

export interface SemanticIndexEntry {
  id: string
  sfId: string | null
  label: string
  component: string | null
  role: string | null
  variant: string | null
  specPath: string | null
  tag: string
  depth: number
  path: string
}

export function buildSemanticIndex(nodes: DOMNode[]): SemanticIndexEntry[] {
  const index: SemanticIndexEntry[] = []

  const walk = (node: DOMNode, depth: number, parentPath: string) => {
    const path = parentPath ? `${parentPath}/${node.id}` : node.id
    index.push({
      id: node.id,
      sfId: node.sfId ?? null,
      label: node.semanticLabel || node.label,
      component: node.component ?? null,
      role: node.role ?? null,
      variant: node.variant ?? null,
      specPath: node.specPath ?? null,
      tag: node.tag,
      depth,
      path,
    })
    for (const child of node.children) {
      walk(child, depth + 1, path)
    }
  }

  for (const node of nodes) {
    walk(node, 0, '')
  }

  return index
}

