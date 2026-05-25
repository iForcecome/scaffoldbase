// Tool 定义镜像 —— 与 canvas-editor/src/tools/*.ts 中的 paramsSchema 对齐。
//
// 为什么这里手写一份？
// server 跟 canvas-editor 是两个 workspace，目前没共享包。tool 执行逻辑只
// 在客户端跑（server 不写 store），但 server 调 AI 时要把 tool 定义喂给
// AI provider。最简方案是镜像。
//
// 同步纪律：改 canvas-editor/src/tools/*.ts 的 paramsSchema 时**同步改这里**。
//
// v2 β3 / β4 状态：dom_* 工具集已上线，AI 可以直接改 contentHtml。
// 元素用 data-sf-id 定位（形如 sf-12），先用 page_read 拿 HTML、解析后找 sf-id 再调用。

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
  // ─── dom (β3 / β4：content-html 元素级编辑) ───────────────────
  {
    name: 'dom_set_text',
    description: '把元素 textContent 替换成新文本（会清空内部 HTML 子节点）。改标题、按钮文字、段落等纯文本场景用这个。',
    parameters: {
      type: 'object',
      required: ['sfId', 'text'],
      properties: {
        pageId: { type: 'string', description: '可选，默认当前活动页' },
        sfId: { type: 'string', description: 'data-sf-id（形如 sf-12）' },
        text: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dom_set_attr',
    description: '设置或更新元素属性（src/href/alt/placeholder/aria-* 等）。data-sf-id 受保护、不可改。',
    parameters: {
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
  },
  {
    name: 'dom_remove_attr',
    description: '移除元素属性。',
    parameters: {
      type: 'object',
      required: ['sfId', 'name'],
      properties: {
        pageId: { type: 'string' },
        sfId: { type: 'string' },
        name: { type: 'string', minLength: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dom_set_style',
    description: '设置 inline style 单条规则。property 用 CSS 名（background-color、margin-top 等）。value 传空字符串等同于删除。',
    parameters: {
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
  },
  {
    name: 'dom_add_class',
    description: '给元素加 class（支持多个，Tailwind 工具类直接传）。',
    parameters: {
      type: 'object',
      required: ['sfId', 'classNames'],
      properties: {
        pageId: { type: 'string' },
        sfId: { type: 'string' },
        classNames: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dom_remove_class',
    description: '从元素移除 class（支持多个）。',
    parameters: {
      type: 'object',
      required: ['sfId', 'classNames'],
      properties: {
        pageId: { type: 'string' },
        sfId: { type: 'string' },
        classNames: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dom_delete',
    description: '删除元素。不允许删 body / html。',
    parameters: {
      type: 'object',
      required: ['sfId'],
      properties: {
        pageId: { type: 'string' },
        sfId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dom_insert_html',
    description: '在目标元素的前/后/内首/内末插入 HTML 片段。position: before | prepend | append | after。新元素自动获得 sf-id。',
    parameters: {
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
  },
  {
    name: 'dom_move',
    description: '把元素移动到目标位置（保留原 sf-id）。常用于调整图层顺序。target 不能是 source 自身或其后代；body / html 不可移动。',
    parameters: {
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
  },
  {
    name: 'dom_replace_html',
    description: '把元素整体替换为新的 HTML 片段（首个顶层元素继承原 sf-id）。改 hero / 区块结构整体重写时用。',
    parameters: {
      type: 'object',
      required: ['sfId', 'html'],
      properties: {
        pageId: { type: 'string' },
        sfId: { type: 'string' },
        html: { type: 'string', minLength: 1 },
      },
      additionalProperties: false,
    },
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
