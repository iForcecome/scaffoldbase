import type { ComponentNode, PageSchema } from '../page-schema/types'

export type InsertPosition = 'before' | 'after' | 'inside:start' | 'inside:end'

function cloneSchema(schema: PageSchema): PageSchema {
  // 用 JSON-clone 而不是 structuredClone：editor-store 的 set 回调把 immer
  // proxy 当 schema 传过来，structuredClone 在 proxy 上会 DataCloneError；
  // schema 是 JSON-safe 的纯数据，JSON-clone 是足够且更宽容的方案。
  return JSON.parse(JSON.stringify(schema))
}

function visit(nodes: ComponentNode[], id: string): ComponentNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = node.children ? visit(node.children, id) : null
    if (child) return child
  }
  return null
}

function updateNodes(nodes: ComponentNode[], id: string, updater: (node: ComponentNode) => ComponentNode): ComponentNode[] {
  return nodes.map(node => {
    if (node.id === id) return updater(node)
    if (!node.children) return node
    return { ...node, children: updateNodes(node.children, id, updater) }
  })
}

function removeFromNodes(nodes: ComponentNode[], id: string): { nodes: ComponentNode[]; removed: ComponentNode | null } {
  let removed: ComponentNode | null = null
  const nextNodes: ComponentNode[] = []

  for (const node of nodes) {
    if (node.id === id) {
      removed = node
      continue
    }
    if (node.children) {
      const result = removeFromNodes(node.children, id)
      if (result.removed) {
        removed = result.removed
        nextNodes.push({ ...node, children: result.nodes })
      } else {
        nextNodes.push(node)
      }
    } else {
      nextNodes.push(node)
    }
  }

  return { nodes: nextNodes, removed }
}

function insertIntoNodes(nodes: ComponentNode[], target: string, position: InsertPosition, nodeToInsert: ComponentNode): ComponentNode[] {
  const nextNodes: ComponentNode[] = []

  for (const node of nodes) {
    if (node.id === target) {
      if (position === 'before') nextNodes.push(nodeToInsert)
      if (position === 'inside:start') nextNodes.push({ ...node, children: [nodeToInsert, ...(node.children ?? [])] })
      else if (position === 'inside:end') nextNodes.push({ ...node, children: [...(node.children ?? []), nodeToInsert] })
      else nextNodes.push(node)
      if (position === 'after') nextNodes.push(nodeToInsert)
      continue
    }
    nextNodes.push(node.children
      ? { ...node, children: insertIntoNodes(node.children, target, position, nodeToInsert) }
      : node)
  }

  return nextNodes
}

export function findSchemaNode(schema: PageSchema, id: string): ComponentNode | null {
  if (schema.page.id === id) {
    return { id: schema.page.id, component: 'Page', props: {}, children: schema.page.sections }
  }
  return visit(schema.page.sections, id)
}

export function resolveSchemaNodeId(schema: PageSchema, id: string): string | null {
  if (findSchemaNode(schema, id)) return id
  const parts = id.split('.')
  while (parts.length > 1) {
    parts.pop()
    const candidate = parts.join('.')
    if (findSchemaNode(schema, candidate)) return candidate
  }
  return null
}

export function updateSchemaNode(schema: PageSchema, id: string, updater: (node: ComponentNode) => ComponentNode): PageSchema {
  const next = cloneSchema(schema)
  next.page.sections = updateNodes(next.page.sections, id, updater)
  return next
}

export function insertSchemaNode(schema: PageSchema, target: string, position: InsertPosition, node: ComponentNode): PageSchema {
  const next = cloneSchema(schema)
  // 同上：AI 传过来的 node 是 JSON 反序列化的，JSON-clone 就够
  const newNode = JSON.parse(JSON.stringify(node)) as ComponentNode
  if (target === next.page.id) {
    if (position === 'inside:start') {
      next.page.sections = [newNode, ...next.page.sections]
    } else {
      next.page.sections = [...next.page.sections, newNode]
    }
  } else {
    next.page.sections = insertIntoNodes(next.page.sections, target, position, newNode)
  }
  return next
}

export function removeSchemaNode(schema: PageSchema, id: string): PageSchema {
  const next = cloneSchema(schema)
  next.page.sections = removeFromNodes(next.page.sections, id).nodes
  return next
}

export function moveSchemaNode(schema: PageSchema, target: string, reference: string, position: InsertPosition): PageSchema {
  const next = cloneSchema(schema)
  const result = removeFromNodes(next.page.sections, target)
  if (!result.removed) return schema
  next.page.sections = result.nodes
  next.page.sections = insertIntoNodes(next.page.sections, reference, position, result.removed)
  return next
}
