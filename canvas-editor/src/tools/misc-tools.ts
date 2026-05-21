import { registerTool } from './registry'
import type { ToolDef } from './types'

const selectionSet: ToolDef<{ nodeIds: string[] }, void> = {
  name: 'selection_set',
  description: '设置当前选区（多选时用多个 id）。传空数组等价于清空选区。',
  paramsSchema: {
    type: 'object',
    required: ['nodeIds'],
    properties: {
      nodeIds: { type: 'array', items: { type: 'string' }, maxItems: 50 },
    },
    additionalProperties: false,
  },
  execute: ({ nodeIds }) => ({
    ok: true,
    effects: [{ kind: 'selection_set', nodeIds }],
    summary: `select ${nodeIds.length} node(s)`,
  }),
}

const selectionHover: ToolDef<{ nodeId: string | null }, void> = {
  name: 'selection_hover',
  description: '设置悬停节点（用于 AI 提示用户关注哪一块）。传 null 取消悬停。',
  paramsSchema: {
    type: 'object',
    required: ['nodeId'],
    properties: {
      nodeId: { type: ['string', 'null'] },
    },
    additionalProperties: false,
  },
  execute: ({ nodeId }) => ({
    ok: true,
    effects: [{ kind: 'selection_hover', nodeId }],
    summary: nodeId ? `hover ${nodeId}` : 'clear hover',
  }),
}

const historyUndo: ToolDef<Record<string, never>, void> = {
  name: 'history_undo',
  description: '撤销活动页面的上一次修改（基于 schema 快照）。',
  paramsSchema: { type: 'object', properties: {}, additionalProperties: false },
  execute: () => ({
    ok: true,
    effects: [{ kind: 'history_undo' }],
    summary: 'undo',
  }),
}

const historyRedo: ToolDef<Record<string, never>, void> = {
  name: 'history_redo',
  description: '重做上次撤销的操作。',
  paramsSchema: { type: 'object', properties: {}, additionalProperties: false },
  execute: () => ({
    ok: true,
    effects: [{ kind: 'history_redo' }],
    summary: 'redo',
  }),
}

export const miscTools: ToolDef[] = [
  selectionSet as ToolDef,
  selectionHover as ToolDef,
  historyUndo as ToolDef,
  historyRedo as ToolDef,
]

miscTools.forEach(registerTool)
