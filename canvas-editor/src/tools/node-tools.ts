import { registerTool } from './registry'
import type { ToolDef } from './types'
import type { ComponentNode, PageSchema } from '../page-schema/types'
import type { SchemaOperation } from '../schema-operations/types'

type Position = 'before' | 'after' | 'inside:start' | 'inside:end'
const POSITION_ENUM: Position[] = ['before', 'after', 'inside:start', 'inside:end']

function ensurePage(ctx: { getPageSchema: (id: string) => PageSchema | null }, pageId: string) {
  const schema = ctx.getPageSchema(pageId)
  return schema
}

const nodeRead: ToolDef<{ pageId: string; nodeId: string }, ComponentNode | null> = {
  name: 'node.read',
  description: '读取页面中某个节点的完整定义（含 children）。深拷贝返回。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'nodeId'],
    properties: {
      pageId: { type: 'string' },
      nodeId: { type: 'string' },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, nodeId }, ctx) => {
    const schema = ensurePage(ctx, pageId)
    if (!schema) return { ok: false, error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` } }
    const found = findNode(schema.page.sections, nodeId)
    if (!found) return { ok: false, error: { code: 'node_not_found', message: `节点 ${nodeId} 不存在` } }
    return { ok: true, data: found, summary: `read node ${nodeId}` }
  },
}

const nodeFind: ToolDef<{ pageId: string; component?: string; role?: string; textContains?: string; labelContains?: string }, Array<{ id: string; component: string; label?: string; path: string[] }>> = {
  name: 'node.find',
  description: '在页面中按 component / role / 文本 / label 模糊查找节点，返回匹配列表（含 path 路径）。多条件 AND 关系。',
  paramsSchema: {
    type: 'object',
    required: ['pageId'],
    properties: {
      pageId: { type: 'string' },
      component: { type: 'string', description: '精确匹配 component 名（如 "PageHeader"）' },
      role: { type: 'string', description: '精确匹配 role' },
      textContains: { type: 'string', description: '检查 props.title/description/label/text 是否包含' },
      labelContains: { type: 'string', description: '检查 label 字段是否包含' },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, component, role, textContains, labelContains }, ctx) => {
    const schema = ensurePage(ctx, pageId)
    if (!schema) return { ok: false, error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` } }
    const matches: Array<{ id: string; component: string; label?: string; path: string[] }> = []
    walkSchema(schema.page.sections, [], (node, path) => {
      if (component && node.component !== component) return
      if (role && node.role !== role) return
      if (labelContains && !(node.label ?? '').includes(labelContains)) return
      if (textContains) {
        const haystack = [
          node.label ?? '',
          node.props?.title,
          node.props?.description,
          node.props?.text,
          node.props?.label,
        ].filter(v => typeof v === 'string').join('\n')
        if (!haystack.includes(textContains)) return
      }
      matches.push({ id: node.id, component: node.component, label: node.label, path })
    })
    return { ok: true, data: matches, summary: `found ${matches.length} matches` }
  },
}

const nodeInsert: ToolDef<{ pageId: string; target: string; position: Position; node: ComponentNode }, void> = {
  name: 'node.insert',
  description: '在指定页面的 target 节点周围插入一个 ComponentNode。target 可以是 page.id（插入到 sections 根）。position 决定相对位置。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'target', 'position', 'node'],
    properties: {
      pageId: { type: 'string' },
      target: { type: 'string' },
      position: { type: 'string', enum: POSITION_ENUM },
      node: { type: 'object', description: 'ComponentNode 形状的对象（含 id, component, props 等）' },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, target, position, node }) => {
    const op: SchemaOperation = { type: 'insertComponent', target, position, node }
    return {
      ok: true,
      effects: [{ kind: 'schema_op', pageId, op }],
      summary: `insert ${node.component} at ${position} of ${target}`,
    }
  },
}

const nodeRemove: ToolDef<{ pageId: string; nodeId: string }, void> = {
  name: 'node.remove',
  description: '从页面中删除一个节点（连带 children）。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'nodeId'],
    properties: {
      pageId: { type: 'string' },
      nodeId: { type: 'string' },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, nodeId }) => ({
    ok: true,
    effects: [{ kind: 'schema_op', pageId, op: { type: 'removeNode', target: nodeId } }],
    summary: `remove node ${nodeId}`,
  }),
}

const nodeMove: ToolDef<{ pageId: string; nodeId: string; referenceId: string; position: Position }, void> = {
  name: 'node.move',
  description: '把一个节点移动到 reference 节点周围。常用于拖拽 / 调整顺序。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'nodeId', 'referenceId', 'position'],
    properties: {
      pageId: { type: 'string' },
      nodeId: { type: 'string' },
      referenceId: { type: 'string' },
      position: { type: 'string', enum: POSITION_ENUM },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, nodeId, referenceId, position }) => ({
    ok: true,
    effects: [{ kind: 'schema_op', pageId, op: { type: 'moveNode', target: nodeId, reference: referenceId, position } }],
    summary: `move ${nodeId} → ${position} ${referenceId}`,
  }),
}

const nodeUpdateProps: ToolDef<{ pageId: string; nodeId: string; props: Record<string, unknown> }, void> = {
  name: 'node.update_props',
  description: '合并更新节点的 props 字段（浅合并，传入字段覆盖同名字段，其他保留）。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'nodeId', 'props'],
    properties: {
      pageId: { type: 'string' },
      nodeId: { type: 'string' },
      props: { type: 'object' },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, nodeId, props }) => ({
    ok: true,
    effects: [{ kind: 'schema_op', pageId, op: { type: 'updateProps', target: nodeId, props } }],
    summary: `update props of ${nodeId}`,
  }),
}

const nodeUpdateStyle: ToolDef<{ pageId: string; nodeId: string; styles: Record<string, string> }, void> = {
  name: 'node.update_style',
  description: '合并更新节点的内联样式。styles 是 camelCase 键。空字符串值表示删除该样式。nodeId 等于 page.id 时改页面级 style。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'nodeId', 'styles'],
    properties: {
      pageId: { type: 'string' },
      nodeId: { type: 'string' },
      styles: { type: 'object', additionalProperties: { type: 'string' } },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, nodeId, styles }) => ({
    ok: true,
    effects: [{ kind: 'schema_op', pageId, op: { type: 'updateStyle', target: nodeId, styles } }],
    summary: `update style of ${nodeId} (${Object.keys(styles).length} props)`,
  }),
}

const nodeSetVariant: ToolDef<{ pageId: string; nodeId: string; variant: string }, void> = {
  name: 'node.set_variant',
  description: '设置节点的 variant（设计系统变体名，如 "compact"、"spacious"）。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'nodeId', 'variant'],
    properties: {
      pageId: { type: 'string' },
      nodeId: { type: 'string' },
      variant: { type: 'string', maxLength: 80 },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, nodeId, variant }) => ({
    ok: true,
    effects: [{ kind: 'schema_op', pageId, op: { type: 'setVariant', target: nodeId, variant } }],
    summary: `set variant of ${nodeId} → ${variant}`,
  }),
}

const nodeReplaceText: ToolDef<{ pageId: string; targetId: string; text: string }, void> = {
  name: 'node.replace_text',
  description: '替换节点的文本内容。targetId 可以是节点 id，也可以是 "nodeId.title" / "nodeId.description" / "nodeId.label" 这类子字段。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'targetId', 'text'],
    properties: {
      pageId: { type: 'string' },
      targetId: { type: 'string' },
      text: { type: 'string', maxLength: 2000 },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, targetId, text }) => ({
    ok: true,
    effects: [{ kind: 'schema_op', pageId, op: { type: 'replaceText', target: targetId, text } }],
    summary: `replace text of ${targetId}`,
  }),
}

// 内部辅助
function findNode(nodes: ComponentNode[], id: string): ComponentNode | null {
  for (const node of nodes) {
    if (node.id === id) return structuredClone(node)
    if (node.children) {
      const child = findNode(node.children, id)
      if (child) return child
    }
  }
  return null
}

function walkSchema(
  nodes: ComponentNode[],
  parentPath: string[],
  visit: (node: ComponentNode, path: string[]) => void,
): void {
  for (const node of nodes) {
    const path = [...parentPath, node.id]
    visit(node, path)
    if (node.children) walkSchema(node.children, path, visit)
  }
}

export const nodeTools: ToolDef[] = [
  nodeRead as ToolDef,
  nodeFind as ToolDef,
  nodeInsert as ToolDef,
  nodeRemove as ToolDef,
  nodeMove as ToolDef,
  nodeUpdateProps as ToolDef,
  nodeUpdateStyle as ToolDef,
  nodeSetVariant as ToolDef,
  nodeReplaceText as ToolDef,
]

nodeTools.forEach(registerTool)
