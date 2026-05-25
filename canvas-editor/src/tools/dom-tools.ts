// dom_* tools — content-html 内的元素级编辑。
//
// 设计：
// - 每个 tool 接受一个 pageId（默认活动页）+ sfId 定位元素
// - tool execute 时调 applyHtmlOps 计算 nextHtml，把"做了什么"和"结果"
//   一起放进 effect。dispatcher apply 时直接 set，无需再次解析。
// - dry_run 也能完整跑（计算 nextHtml 但 dispatcher 不 apply）。

import { registerTool } from './registry'
import type { ToolDef, ToolResult, HtmlOpMeta, ToolContext } from './types'
import { applyHtmlOps, type HtmlOp, type OpError } from '../utils/html-ops'

type DomToolData = {
  affectedIds: string[]
  errors: OpError[]
}

interface CommonParams {
  pageId?: string
}

function resolvePageId(params: CommonParams, ctx: ToolContext): { pageId: string } | { error: ToolResult } {
  const pageId = params.pageId ?? ctx.activePageId
  if (!pageId) {
    return { error: { ok: false, error: { code: 'no_active_page', message: '没有指定 pageId 且没有活动页' } } }
  }
  if (!ctx.listPages().some(p => p.id === pageId)) {
    return { error: { ok: false, error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` } } }
  }
  return { pageId }
}

function runOp(
  params: CommonParams,
  ctx: ToolContext,
  op: HtmlOp,
  summary: string,
  meta: HtmlOpMeta,
): ToolResult<DomToolData> {
  const resolved = resolvePageId(params, ctx)
  if ('error' in resolved) return resolved.error as ToolResult<DomToolData>
  const { pageId } = resolved
  const html = ctx.getPageContentHtml(pageId)
  if (html === null) {
    return { ok: false, error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` } }
  }
  const result = applyHtmlOps(html, [op])
  if (result.errors.length > 0) {
    const first = result.errors[0]
    return {
      ok: false,
      data: { affectedIds: result.affectedIds, errors: result.errors },
      error: { code: first.code, message: first.message, details: result.errors },
    }
  }
  return {
    ok: true,
    data: { affectedIds: result.affectedIds, errors: [] },
    effects: [{ kind: 'html_apply_ops', pageId, nextHtml: result.html, opsMeta: [meta] }],
    summary,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const domSetText: ToolDef<{ pageId?: string; sfId: string; text: string }, DomToolData> = {
  name: 'dom_set_text',
  description: '把元素的 textContent 替换为新文本（会清空内部 HTML 子节点）。',
  paramsSchema: {
    type: 'object',
    required: ['sfId', 'text'],
    properties: {
      pageId: { type: 'string', description: '可选，默认当前活动页' },
      sfId: { type: 'string', description: 'data-sf-id（形如 sf-12）' },
      text: { type: 'string' },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'set_text', sfId: params.sfId, text: params.text },
      `set text on ${params.sfId}`,
      { type: 'set_text', sfId: params.sfId },
    ),
}

const domSetAttr: ToolDef<{ pageId?: string; sfId: string; name: string; value: string }, DomToolData> = {
  name: 'dom_set_attr',
  description: '设置或更新元素属性。data-sf-id 等内部属性受保护、不可改。',
  paramsSchema: {
    type: 'object',
    required: ['sfId', 'name', 'value'],
    properties: {
      pageId: { type: 'string' },
      sfId: { type: 'string' },
      name: { type: 'string', minLength: 1 },
      value: { type: 'string' },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'set_attr', sfId: params.sfId, name: params.name, value: params.value },
      `set attr ${params.name} on ${params.sfId}`,
      { type: 'set_attr', sfId: params.sfId, name: params.name },
    ),
}

const domRemoveAttr: ToolDef<{ pageId?: string; sfId: string; name: string }, DomToolData> = {
  name: 'dom_remove_attr',
  description: '移除元素属性。',
  paramsSchema: {
    type: 'object',
    required: ['sfId', 'name'],
    properties: {
      pageId: { type: 'string' },
      sfId: { type: 'string' },
      name: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'remove_attr', sfId: params.sfId, name: params.name },
      `remove attr ${params.name} on ${params.sfId}`,
      { type: 'remove_attr', sfId: params.sfId, name: params.name },
    ),
}

const domSetStyle: ToolDef<{ pageId?: string; sfId: string; property: string; value: string }, DomToolData> = {
  name: 'dom_set_style',
  description: '设置 inline style 单个属性。value 传空字符串等同于删除此属性。property 用 CSS 名（如 background-color、margin-top）。',
  paramsSchema: {
    type: 'object',
    required: ['sfId', 'property', 'value'],
    properties: {
      pageId: { type: 'string' },
      sfId: { type: 'string' },
      property: { type: 'string', minLength: 1 },
      value: { type: 'string' },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'set_style', sfId: params.sfId, property: params.property, value: params.value },
      `set style ${params.property} on ${params.sfId}`,
      { type: 'set_style', sfId: params.sfId, property: params.property },
    ),
}

const domAddClass: ToolDef<{ pageId?: string; sfId: string; classNames: string[] }, DomToolData> = {
  name: 'dom_add_class',
  description: '给元素加 class（支持多个）。已存在的会忽略。',
  paramsSchema: {
    type: 'object',
    required: ['sfId', 'classNames'],
    properties: {
      pageId: { type: 'string' },
      sfId: { type: 'string' },
      classNames: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'add_class', sfId: params.sfId, classNames: params.classNames },
      `add ${params.classNames.length} class(es) on ${params.sfId}`,
      { type: 'add_class', sfId: params.sfId },
    ),
}

const domRemoveClass: ToolDef<{ pageId?: string; sfId: string; classNames: string[] }, DomToolData> = {
  name: 'dom_remove_class',
  description: '从元素移除 class（支持多个）。不存在的会忽略。',
  paramsSchema: {
    type: 'object',
    required: ['sfId', 'classNames'],
    properties: {
      pageId: { type: 'string' },
      sfId: { type: 'string' },
      classNames: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'remove_class', sfId: params.sfId, classNames: params.classNames },
      `remove ${params.classNames.length} class(es) on ${params.sfId}`,
      { type: 'remove_class', sfId: params.sfId },
    ),
}

const domDelete: ToolDef<{ pageId?: string; sfId: string }, DomToolData> = {
  name: 'dom_delete',
  description: '删除元素。不允许删 body 或 html。',
  paramsSchema: {
    type: 'object',
    required: ['sfId'],
    properties: {
      pageId: { type: 'string' },
      sfId: { type: 'string' },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'delete', sfId: params.sfId },
      `delete ${params.sfId}`,
      { type: 'delete', sfId: params.sfId },
    ),
}

const domInsertHtml: ToolDef<{
  pageId?: string
  targetSfId: string
  position: 'before' | 'prepend' | 'append' | 'after'
  html: string
}, DomToolData> = {
  name: 'dom_insert_html',
  description: '在目标元素的前/后/内首/内末插入 HTML 片段。新元素自动分配 sf-id（在返回的 affectedIds 里）。',
  paramsSchema: {
    type: 'object',
    required: ['targetSfId', 'position', 'html'],
    properties: {
      pageId: { type: 'string' },
      targetSfId: { type: 'string' },
      position: { type: 'string', enum: ['before', 'prepend', 'append', 'after'] },
      html: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'insert_html', targetSfId: params.targetSfId, position: params.position, html: params.html },
      `insert html ${params.position} ${params.targetSfId}`,
      { type: 'insert_html', targetSfId: params.targetSfId, position: params.position },
    ),
}

const domReplaceHtml: ToolDef<{ pageId?: string; sfId: string; html: string }, DomToolData> = {
  name: 'dom_replace_html',
  description: '把元素整体替换为新的 HTML 片段（首个顶层元素接管原 sf-id，其余作为兄弟插入）。',
  paramsSchema: {
    type: 'object',
    required: ['sfId', 'html'],
    properties: {
      pageId: { type: 'string' },
      sfId: { type: 'string' },
      html: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'replace_html', sfId: params.sfId, html: params.html },
      `replace ${params.sfId}`,
      { type: 'replace_html', sfId: params.sfId },
    ),
}

const domMove: ToolDef<{
  pageId?: string
  sourceSfId: string
  targetSfId: string
  position: 'before' | 'prepend' | 'append' | 'after'
}, DomToolData> = {
  name: 'dom_move',
  description: '把元素移动到目标位置（保留原 sf-id，不分配新 id）。图层拖拽重排走这个；AI 改顺序时也用这个。target 不能是 source 自身或后代。',
  paramsSchema: {
    type: 'object',
    required: ['sourceSfId', 'targetSfId', 'position'],
    properties: {
      pageId: { type: 'string' },
      sourceSfId: { type: 'string' },
      targetSfId: { type: 'string' },
      position: { type: 'string', enum: ['before', 'prepend', 'append', 'after'] },
    },
    additionalProperties: false,
  },
  execute: (params, ctx) =>
    runOp(params, ctx,
      { type: 'move', sourceSfId: params.sourceSfId, targetSfId: params.targetSfId, position: params.position },
      `move ${params.sourceSfId} ${params.position} ${params.targetSfId}`,
      { type: 'move', sourceSfId: params.sourceSfId, targetSfId: params.targetSfId, position: params.position },
    ),
}

export const domTools: ToolDef[] = [
  domSetText as ToolDef,
  domSetAttr as ToolDef,
  domRemoveAttr as ToolDef,
  domSetStyle as ToolDef,
  domAddClass as ToolDef,
  domRemoveClass as ToolDef,
  domDelete as ToolDef,
  domInsertHtml as ToolDef,
  domReplaceHtml as ToolDef,
  domMove as ToolDef,
]

domTools.forEach(registerTool)
