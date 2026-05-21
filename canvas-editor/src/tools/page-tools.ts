import { registerTool } from './registry'
import type { ToolDef, ToolResult } from './types'
import type { PageSchema } from '../page-schema/types'

const pageList: ToolDef<Record<string, never>, Array<{ id: string; title: string }>> = {
  name: 'page.list',
  description: '列出当前项目所有页面的 id 和 title。只读，不产生 effects。',
  paramsSchema: { type: 'object', properties: {}, additionalProperties: false },
  execute: (_params, ctx) => ({
    ok: true,
    data: ctx.listPages(),
    summary: `listed ${ctx.listPages().length} pages`,
  }),
}

const pageRead: ToolDef<{ pageId: string }, PageSchema | null> = {
  name: 'page.read',
  description: '读取指定页面的完整 PageSchema。返回深拷贝，tool 改动不会影响真 schema。',
  paramsSchema: {
    type: 'object',
    required: ['pageId'],
    properties: {
      pageId: { type: 'string', description: '页面 id' },
    },
    additionalProperties: false,
  },
  execute: ({ pageId }, ctx) => {
    const schema = ctx.getPageSchema(pageId)
    if (!schema) {
      return {
        ok: false,
        error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` },
      }
    }
    return { ok: true, data: schema, summary: `read page ${pageId}` }
  },
}

const pageCreate: ToolDef<{ title?: string }, { pageId: string }> = {
  name: 'page.create',
  description: '创建一个新页面（含默认 schema：PageHeader + FilterBar + DataTable）。可选 title。返回新建页面的 id。',
  paramsSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', maxLength: 80 },
    },
    additionalProperties: false,
  },
  execute: ({ title }) => {
    // pageId 由 editor-store.addPage 生成；dispatcher 会把真实 id patch 到 data
    return {
      ok: true,
      data: { pageId: '' },
      effects: [{
        kind: 'page_create',
        page: { id: '', title: title ?? '新页面' },
      }],
      summary: `create page${title ? ` "${title}"` : ''}`,
    }
  },
}

const pageDelete: ToolDef<{ pageId: string }, void> = {
  name: 'page.delete',
  description: '删除指定页面。如果项目只剩一个页面则拒绝。',
  paramsSchema: {
    type: 'object',
    required: ['pageId'],
    properties: { pageId: { type: 'string' } },
    additionalProperties: false,
  },
  execute: ({ pageId }, ctx) => {
    const pages = ctx.listPages()
    if (!pages.some(p => p.id === pageId)) {
      return {
        ok: false,
        error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` },
      }
    }
    if (pages.length <= 1) {
      return {
        ok: false,
        error: { code: 'last_page', message: '至少保留一个页面' },
      }
    }
    return {
      ok: true,
      effects: [{ kind: 'page_delete', pageId }],
      summary: `delete page ${pageId}`,
    }
  },
}

const pageDuplicate: ToolDef<{ pageId: string }, { newPageId: string }> = {
  name: 'page.duplicate',
  description: '复制指定页面（含完整 schema），title 后缀加 "副本"，自动切到副本。',
  paramsSchema: {
    type: 'object',
    required: ['pageId'],
    properties: { pageId: { type: 'string' } },
    additionalProperties: false,
  },
  execute: ({ pageId }, ctx) => {
    const source = ctx.listPages().find(p => p.id === pageId)
    if (!source) {
      return {
        ok: false,
        error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` },
      }
    }
    // newPageId 由 duplicatePage 内部生成；dispatcher 把真实 id patch 到 data
    return {
      ok: true,
      data: { newPageId: '' },
      effects: [{
        kind: 'page_duplicate',
        sourcePageId: pageId,
        newPageId: '',
        newTitle: `${source.title} 副本`,
      }],
      summary: `duplicate page ${pageId}`,
    }
  },
}

const pageRename: ToolDef<{ pageId: string; title: string }, void> = {
  name: 'page.rename',
  description: '重命名页面。title 必须非空、长度 ≤ 80。',
  paramsSchema: {
    type: 'object',
    required: ['pageId', 'title'],
    properties: {
      pageId: { type: 'string' },
      title: { type: 'string', minLength: 1, maxLength: 80 },
    },
    additionalProperties: false,
  },
  execute: ({ pageId, title }, ctx) => {
    if (!ctx.listPages().some(p => p.id === pageId)) {
      return {
        ok: false,
        error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` },
      }
    }
    const trimmed = title.trim()
    if (!trimmed) {
      return {
        ok: false,
        error: { code: 'invalid_title', message: 'title 不能为空' },
      }
    }
    return {
      ok: true,
      effects: [{ kind: 'page_rename', pageId, title: trimmed }],
      summary: `rename page ${pageId} → "${trimmed}"`,
    }
  },
}

const pageSetActive: ToolDef<{ pageId: string }, void> = {
  name: 'page.set_active',
  description: '切换当前活动页面。会清空选区和视口。',
  paramsSchema: {
    type: 'object',
    required: ['pageId'],
    properties: { pageId: { type: 'string' } },
    additionalProperties: false,
  },
  execute: ({ pageId }, ctx) => {
    if (!ctx.listPages().some(p => p.id === pageId)) {
      return {
        ok: false,
        error: { code: 'page_not_found', message: `页面 ${pageId} 不存在` },
      }
    }
    return {
      ok: true,
      effects: [{ kind: 'page_set_active', pageId }],
      summary: `activate page ${pageId}`,
    }
  },
}

export const pageTools: ToolDef[] = [
  pageList as ToolDef,
  pageRead as ToolDef,
  pageCreate as ToolDef,
  pageDelete as ToolDef,
  pageDuplicate as ToolDef,
  pageRename as ToolDef,
  pageSetActive as ToolDef,
]

// 自注册
pageTools.forEach(registerTool)

export type { ToolResult }
