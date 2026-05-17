import type { ComponentNode, PageSchema } from '../page-schema/types'
import type { SchemaOperation } from './types'
import {
  findSchemaNode,
  insertSchemaNode,
  moveSchemaNode,
  removeSchemaNode,
  resolveSchemaNodeId,
  updateSchemaNode,
} from './schema-tree'

function inferTextProp(target: string, node: ComponentNode): string {
  if (target.endsWith('.title')) return 'title'
  if (target.endsWith('.description')) return 'description'
  if (target.endsWith('.label')) return 'label'
  if ('title' in node.props) return 'title'
  if ('description' in node.props) return 'description'
  if ('label' in node.props) return 'label'
  return 'text'
}

function replaceText(schema: PageSchema, target: string, text: string): PageSchema {
  const nodeId = resolveSchemaNodeId(schema, target)
  if (!nodeId) return schema

  return updateSchemaNode(schema, nodeId, node => {
    const prop = inferTextProp(target, node)
    return {
      ...node,
      label: prop === 'title' || prop === 'label' ? text.slice(0, 120) : node.label,
      props: {
        ...node.props,
        [prop]: text,
      },
    }
  })
}

export function applySchemaOperation(schema: PageSchema, operation: SchemaOperation): PageSchema {
  switch (operation.type) {
    case 'replaceText':
      return replaceText(schema, operation.target, operation.text)
    case 'setVariant': {
      const nodeId = resolveSchemaNodeId(schema, operation.target)
      if (!nodeId) return schema
      return updateSchemaNode(schema, nodeId, node => ({ ...node, variant: operation.variant }))
    }
    case 'updateProps': {
      const nodeId = resolveSchemaNodeId(schema, operation.target)
      if (!nodeId) return schema
      return updateSchemaNode(schema, nodeId, node => ({ ...node, props: { ...node.props, ...operation.props } }))
    }
    case 'insertComponent':
      return findSchemaNode(schema, operation.target)
        ? insertSchemaNode(schema, operation.target, operation.position, operation.node)
        : schema
    case 'removeNode':
      return removeSchemaNode(schema, operation.target)
    case 'moveNode':
      return moveSchemaNode(schema, operation.target, operation.reference, operation.position)
    default:
      return schema
  }
}

export function applySchemaOperations(schema: PageSchema, operations: SchemaOperation[]): PageSchema {
  return operations.reduce((nextSchema, operation) => applySchemaOperation(nextSchema, operation), schema)
}
