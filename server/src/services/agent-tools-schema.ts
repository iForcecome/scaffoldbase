// Tool 定义镜像 —— 与 canvas-editor/src/tools/*.ts 中的 paramsSchema 对齐。
//
// 为什么这里手写一份？
// server 跟 canvas-editor 是两个 workspace，目前没共享包。tool 执行逻辑只
// 在客户端跑（server 不写 store），但 server 调 AI 时要把 tool 定义喂给
// AI provider。最简方案是镜像。
//
// 同步纪律：改 canvas-editor/src/tools/*.ts 的 paramsSchema 时**同步改这里**。
//
// v2 Day 0 状态：node_* 工具组已删除（v1 schema 残留）。html_* 工具将在 β3 / β4
// 阶段加入。当前 server 给 AI 的工具集只剩 page_* + selection_* + history_*。

export interface OpenAIToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

const tools: Array<{ name: string; description: string; parameters: object }> = [
  // ─── page ───────────────────────────────────────────────────
  {
    name: 'page_list',
    description: '列出当前项目所有页面的 id 和 title。只读，不产生 effects。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'page_read',
    description: '读取指定页面的 contentHtml（v2：完整 HTML 文档或内容片段）。',
    parameters: {
      type: 'object',
      required: ['pageId'],
      properties: { pageId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'page_create',
    description: '创建一个新页面（默认 HTML 模板）。返回新建页面的 id。',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string', maxLength: 80 } },
      additionalProperties: false,
    },
  },
  {
    name: 'page_delete',
    description: '删除指定页面。只剩一个页面时拒绝。',
    parameters: {
      type: 'object',
      required: ['pageId'],
      properties: { pageId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'page_duplicate',
    description: '复制指定页面的 contentHtml，自动切到副本。',
    parameters: {
      type: 'object',
      required: ['pageId'],
      properties: { pageId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'page_rename',
    description: '重命名页面。title 必须非空、长度 ≤ 80。',
    parameters: {
      type: 'object',
      required: ['pageId', 'title'],
      properties: {
        pageId: { type: 'string' },
        title: { type: 'string', minLength: 1, maxLength: 80 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'page_set_active',
    description: '切换当前活动页面。会清空选区。',
    parameters: {
      type: 'object',
      required: ['pageId'],
      properties: { pageId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  // ─── selection / history ───────────────────────────────────
  {
    name: 'selection_set',
    description: '设置当前选区（多选时多个 id）。空数组等价于清空。',
    parameters: {
      type: 'object',
      required: ['nodeIds'],
      properties: { nodeIds: { type: 'array', items: { type: 'string' }, maxItems: 50 } },
      additionalProperties: false,
    },
  },
  {
    name: 'selection_hover',
    description: '设置悬停节点（用于 AI 提示用户关注哪一块）。null 取消悬停。',
    parameters: {
      type: 'object',
      required: ['nodeId'],
      properties: { nodeId: { type: ['string', 'null'] } },
      additionalProperties: false,
    },
  },
  {
    name: 'history_undo',
    description: '撤销活动页面的上一次修改。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'history_redo',
    description: '重做上次撤销的操作。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
]

export const TOOL_DEFS: OpenAIToolDef[] = tools.map(t => ({
  type: 'function',
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  },
}))

export const TOOL_NAMES = new Set(tools.map(t => t.name))
