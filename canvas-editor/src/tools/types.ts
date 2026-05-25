// Tool surface — AI First 定位的基础抽象。
//
// 设计原则：
// 1. Tool 是 product 的真正 API：UI 按钮和 AI agent 都通过 tool 调用产生改动
// 2. Tool 不直接 mutate store，而是返回 effects（声明性结果）；dispatcher 决定是否 apply
// 3. dry_run 是一等公民：所有 write tool 在 dry_run 下计算 effects 但不落地
// 4. 失败逐条报告，不让一个错挡住整批
//
// v2 β3：dom_* tools 通过 html_apply_ops effect 修改 contentHtml。

/** 选区元数据，用于 tool 上下文 */
export interface SelectionSnapshot {
  selectedIds: string[]
  hoveredId: string | null
  activePageId: string
}

/**
 * Tool 执行结果。所有 tool 都返回此结构；effects 数组按顺序 apply。
 * 读 tool effects 通常为空，data 承载结果；写 tool data 通常为空，effects 承载副作用。
 */
export interface ToolResult<TData = unknown> {
  ok: boolean
  data?: TData
  effects?: ToolEffect[]
  /** 失败时填充；不抛异常，让 dispatcher 收集 */
  error?: { code: string; message: string; details?: unknown }
  /** 描述这次 tool 调用的意图，写入 Agent 轨迹 */
  summary?: string
}

/**
 * Tool effect — 声明性副作用，最终由 dispatcher 调用对应 store action。
 *
 * 拆这一层而不是直接调 store：
 * - dry_run 可以只算 effects 不 apply
 * - Agent / Draft 层可以拦截后审核
 * - 测试 tool 不依赖 store mock
 *
 * html_apply_ops：tool 已经把目标页 contentHtml 计算成 nextHtml；dispatcher
 * 直接 set。ops 保留作为元信息（让 history / agent 知道做了什么）。
 */
export type ToolEffect =
  | { kind: 'page_create'; page: { id: string; title: string } }
  | { kind: 'page_delete'; pageId: string }
  | { kind: 'page_duplicate'; sourcePageId: string; newPageId: string; newTitle: string }
  | { kind: 'page_rename'; pageId: string; title: string }
  | { kind: 'page_set_active'; pageId: string }
  | { kind: 'selection_set'; nodeIds: string[]; meta?: Record<string, unknown> }
  | { kind: 'selection_hover'; nodeId: string | null }
  | { kind: 'history_undo' }
  | { kind: 'history_redo' }
  | { kind: 'html_apply_ops'; pageId: string; nextHtml: string; opsMeta: HtmlOpMeta[] }

/** 元信息（agent 看的"做了什么"），与 utils/html-ops.HtmlOp 同构 */
export type HtmlOpMeta =
  | { type: 'set_text'; sfId: string }
  | { type: 'set_attr'; sfId: string; name: string }
  | { type: 'remove_attr'; sfId: string; name: string }
  | { type: 'set_style'; sfId: string; property: string }
  | { type: 'add_class'; sfId: string }
  | { type: 'remove_class'; sfId: string }
  | { type: 'delete'; sfId: string }
  | { type: 'insert_html'; targetSfId: string; position: string }
  | { type: 'replace_html'; sfId: string }
  | { type: 'move'; sourceSfId: string; targetSfId: string; position: string }

/** 上下文：tool execute 时能拿到的"当前状态"快照 + 配置 */
export interface ToolContext {
  /** 当前活动页的 id，可能为空（项目未选页） */
  activePageId: string | null
  /** 读取某页 contentHtml，返回原值（字符串不可变，无需深拷贝） */
  getPageContentHtml: (pageId: string) => string | null
  /** 列出所有页面的元数据 */
  listPages: () => Array<{ id: string; title: string }>
  /** 当前选区（如果有） */
  selection: SelectionSnapshot
  /** dry_run 模式下，tool execute 仍然跑、effects 仍然返回，但 dispatcher 不会 apply */
  dryRun: boolean
}

/**
 * Tool 定义。paramsSchema 是 JSON Schema 格式 —— 直接喂给 AI provider 的 tool API。
 */
export interface ToolDef<Params = Record<string, unknown>, Data = unknown> {
  name: string
  description: string
  paramsSchema: object
  execute: (params: Params, ctx: ToolContext) => Promise<ToolResult<Data>> | ToolResult<Data>
}

/** dispatcher 调用 tool 时的入参 */
export interface ToolCall {
  /** 调用 id，方便 Agent / UI 关联 result */
  callId?: string
  name: string
  params: Record<string, unknown>
}

/** dispatcher 批量执行的输出 */
export interface DispatchResult {
  /** 与入参对齐顺序的 tool 结果 */
  results: Array<ToolResult & { callId?: string; toolName: string }>
  /** 实际应用的 effects 数；dry_run 时为 0 */
  appliedEffects: number
  /** 因失败被跳过的 tool 数 */
  failedCalls: number
}
