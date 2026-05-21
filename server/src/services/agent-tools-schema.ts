// Tool 定义镜像 —— 与 canvas-editor/src/tools/*.ts 中的 paramsSchema 对齐。
//
// 为什么这里手写一份？
// server 跟 canvas-editor 是两个 workspace，目前没共享包。tool 执行逻辑只
// 在客户端跑（server 不写 store），但 server 调 AI 时要把 tool 定义喂给
// AI provider。最简方案是镜像。
//
// 同步纪律：改 canvas-editor/src/tools/*.ts 的 paramsSchema 时**同步改这里**。
// P4 之后可以考虑放进 workspaces/tools-schemas 共享包，那时不再需要镜像。

export interface OpenAIToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

const POSITION_ENUM = ['before', 'after', 'inside:start', 'inside:end']

const tools: Array<{ name: string; description: string; parameters: object }> = [
  // ─── page ───────────────────────────────────────────────────
  {
    name: 'page_list',
    description: '列出当前项目所有页面的 id 和 title。只读，不产生 effects。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'page_read',
    description: '读取指定页面的完整 PageSchema。返回深拷贝。',
    parameters: {
      type: 'object',
      required: ['pageId'],
      properties: { pageId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'page_create',
    description: '创建一个新页面（含默认 schema）。返回新建页面的 id。',
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
    description: '复制指定页面（含完整 schema），自动切到副本。',
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
  // ─── node ───────────────────────────────────────────────────
  {
    name: 'node_read',
    description: '读取页面中某个节点的完整定义（含 children）。',
    parameters: {
      type: 'object',
      required: ['pageId', 'nodeId'],
      properties: { pageId: { type: 'string' }, nodeId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'node_find',
    description: '按 component / role / 文本 / label 模糊查找节点。多条件 AND。',
    parameters: {
      type: 'object',
      required: ['pageId'],
      properties: {
        pageId: { type: 'string' },
        component: { type: 'string' },
        role: { type: 'string' },
        textContains: { type: 'string' },
        labelContains: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'node_insert',
    description: '在 target 节点周围插入一个 ComponentNode。target 可为 page.id（插到 sections 根）。',
    parameters: {
      type: 'object',
      required: ['pageId', 'target', 'position', 'node'],
      properties: {
        pageId: { type: 'string' },
        target: { type: 'string' },
        position: { type: 'string', enum: POSITION_ENUM },
        node: { type: 'object' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'node_remove',
    description: '从页面中删除节点（连带 children）。',
    parameters: {
      type: 'object',
      required: ['pageId', 'nodeId'],
      properties: { pageId: { type: 'string' }, nodeId: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    name: 'node_move',
    description: '把节点移动到 reference 节点周围。',
    parameters: {
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
  },
  {
    name: 'node_update_props',
    description: '合并更新节点的 props 字段（浅合并）。',
    parameters: {
      type: 'object',
      required: ['pageId', 'nodeId', 'props'],
      properties: {
        pageId: { type: 'string' },
        nodeId: { type: 'string' },
        props: { type: 'object' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'node_update_style',
    description: '合并更新节点的内联样式（camelCase 键，空字符串表示删除）。nodeId 等于 page.id 时改页面级 style。',
    parameters: {
      type: 'object',
      required: ['pageId', 'nodeId', 'styles'],
      properties: {
        pageId: { type: 'string' },
        nodeId: { type: 'string' },
        styles: { type: 'object', additionalProperties: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'node_set_variant',
    description: '设置节点的 variant（如 "compact"、"spacious"）。',
    parameters: {
      type: 'object',
      required: ['pageId', 'nodeId', 'variant'],
      properties: {
        pageId: { type: 'string' },
        nodeId: { type: 'string' },
        variant: { type: 'string', maxLength: 80 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'node_replace_text',
    description: '替换节点的文本内容。targetId 可为子字段如 "nodeId.title"。',
    parameters: {
      type: 'object',
      required: ['pageId', 'targetId', 'text'],
      properties: {
        pageId: { type: 'string' },
        targetId: { type: 'string' },
        text: { type: 'string', maxLength: 2000 },
      },
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
