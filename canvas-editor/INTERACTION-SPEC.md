# SpecFlow Canvas Editor 交互规格文档（v1, schema-as-truth）

v1 把编辑器锚定到 **schema 是唯一真相** 这条线：

```
用户意图 ──► dispatch(SchemaOperation)
         │
         ▼
   page.schema 变更
         │
         ▼
   page.html = renderPageSchemaToHtml(schema)
         │
         ▼
   iframe.srcDoc（视图，单向）
```

iframe 是视图层，DOM 不参与状态，bridge 只回传"选中/悬停/链接/文本编辑结束"四类轻量事件。所有交互通过 SchemaOperation 推动状态。

## 目录

- [1. 模式系统](#1-模式系统)
- [2. 画布操作](#2-画布操作)
- [3. 元素选择与多选](#3-元素选择与多选)
- [4. 多页面管理](#4-多页面管理)
- [5. 状态分层与保存](#5-状态分层与保存)
- [6. 编辑通道](#6-编辑通道)
- [7. AI 对话](#7-ai-对话)
- [8. iframe 与 Bridge 协议](#8-iframe-与-bridge-协议)
- [9. 快捷键](#9-快捷键)
- [10. 文件索引](#10-文件索引)

---

## 1. 模式系统

编辑器有两种核心模式：**设计模式** 和 **预览模式**，通过 TopBar 的 Play 按钮、快捷键 `P` / `Esc` 切换。

| 模式 | iframe 指针事件 | overlay | 选中/Hover UI | bridge `mode` |
|------|----------------|---------|----------------|---------------|
| 设计 | `none`，由覆盖层接管 | 透明 div 拦截 | 显示选中框 / Hover 高亮 / 左右面板 / ChatBar | `design`，所有点击/双击 `preventDefault` |
| 预览 | `auto`，原生交互 | 移除 | 隐藏左右面板与选择 UI | `preview`，仅拦截非 `#page:` 链接 |

模式切换由 `tool-store.setTool` 触发。它本身仅更新 `activeTool` 并发 `set-mode` 给 bridge；**清空选中状态的副作用挂在 `stores/coordinate.ts` 的订阅里**，避免 store 之间互相 import。

---

## 2. 画布操作

| 操作 | 行为 | 实现 |
|------|------|------|
| 触摸板双指缩放 | 画布缩放（0.1× ~ 3×），不影响浏览器缩放 | `CanvasArea` 监听原生 `wheel`，命中 ctrl/meta 时 `preventDefault` + `viewport-store.zoomTo` |
| iframe 内 ctrl/meta + 滚轮 | 转发到画布缩放 | bridge-script `wheel` handler → `iframe-wheel` 消息 → `viewport-store.zoomTo` |
| ZoomControls 按钮 | +/-、重置 | `viewport-store.zoomTo` / `setViewport({ x: 0, y: 0 })` |
| 触摸板双指滑动 | 画布平移 | `viewport-store.setViewport` |
| iframe 内普通滚动 | iframe 内自然滚动，不影响画布 | bridge 仅在 ctrl/meta 时上抛 |

ChatBar / ZoomControls / MiniMap 等 UI 标记 `data-no-canvas-wheel`，画布 wheel handler 命中即跳过，避免在控件上滚动也把画布甩飞。

---

## 3. 元素选择与多选

| 操作 | 行为 |
|------|------|
| 单击元素 | `selection-store.selectElement`，bridge 异步回传 `computed-style` 填 `selectedStyles` |
| Shift / Cmd / Ctrl + 单击 | 追加 / 取消选中 |
| 单击画布空白 | `selectElement(null)`，清空选中 |
| LayerTree 单击 | 等价单击，并标记 `setPendingReveal` → 下一次 `computed-style` 命中时调 `viewport-store.panToElement` 把元素带入视口 |
| 选中元素 | ChatInput textarea 自动 focus |

`selection-store` 的字段：

```ts
selectedIds: string[]                                       // 多选 ID 列表
selectedElements: Record<string, { label, rect, sfId, component, role, variant, specPath }>
selectedStyles: Record<string, string> | null               // bridge get-computed-style 回传
hoveredId / hoveredRect                                      // 鼠标悬停
```

`getPrimarySelectedId()` 返回最后一个 ID，作为右面板的主选中。

---

## 4. 多页面管理

| Action（editor-store） | 行为 | 协调副作用 |
|-----------------------|------|-----------|
| `loadProject(projectId, name, pages)` | 加载项目数据并归一化 schema | 重置 history / 重置选中 / 重置 viewport |
| `setActivePage(id)` | 切页 | 重置选中 / 重置 viewport |
| `addPage()` | 默认 schema 新建页 | 清空选中 |
| `deletePage(id)` | 至少保留 1 页 | 切页 + 清空选中 |
| `duplicatePage(id)` | 用 `clonePageSchema` 复制 | 清空选中 |
| `renamePage(id, title)` | 仅改 title，标记 dirty | — |

页面间跳转通过链接 `<a href="#page:pageId">`：bridge 检测前缀 → 上抛 `navigate-page` → use-bridge → `setActivePage`。其他链接在预览模式一律 `preventDefault`。

---

## 5. 状态分层与保存

### 5.1 五个 store（加 chat 共六个）

```
editor-store    项目级状态（projectId, projectName, pages, activePageId, dirtyPageIds, saving）
                + SchemaOperation 应用 + undo/redo 协调 + save。是唯一允许 import 其他 store 的"协调者"。

viewport-store  viewport / device / customWidth / iframeHeight / panToElement
selection-store selectedIds / selectedElements / selectedStyles / hoveredId / hoveredRect
tool-store      activeTool / leftPanelOpen / rightPanelOpen / editingTextId
history-store   undoStack / redoStack（push/pop 由 editor-store 调用）
chat-store      AI 对话消息流 + dispatch SchemaOperation
```

ESLint 规则禁止 *数据 store* 互相 import。tool-store 切到预览要清选中——通过 `stores/coordinate.ts` 的订阅在 `main.tsx` 引导期注入。

### 5.2 SchemaOperation = 唯一写入入口

所有改 schema 的入口（右面板、AI、未来的物料抽屉）都走 `editor-store.applySchemaOperations(pageId, ops)`。它做四件事：

1. 取当前页快照 (`createPageSnapshot`)
2. `applySchemaOperations(schema, ops)` → 新 schema
3. `validatePageSchema` 校验失败抛出
4. 写回 `page.schema` + 重新 `renderPageSchemaToHtml(schema)` 写到 `page.html`
5. snapshot push 进 `history-store.undoStack`，redo 栈清空，dirty 标记

SchemaOperation 七种类型：`replaceText` / `setVariant` / `updateProps` / `updateStyle` / `insertComponent` / `removeNode` / `moveNode`。`updateStyle` 走 camelCase 安全白名单（见 `schema-operations/validate-schema-operation.ts`）。

### 5.3 撤销 / 重做

| 操作 | 快捷键 | 行为 |
|------|--------|------|
| 撤销 | `Cmd+Z` | `editor-store.undo` → history pop → 把当前 snapshot push 到 redo → restore |
| 重做 | `Cmd+Shift+Z` | `editor-store.redo` → 镜像逻辑 |

栈条目就是 `{ html, schema }` 全量快照，撤销原子且与 schema 完全对齐。

### 5.4 Dirty / Save

| 触发 | 行为 |
|------|------|
| 任何 SchemaOperation / 页面 CRUD / 文本编辑 / AI 应用 | 把 `pageId` 加进 `dirtyPageIds` |
| TopBar「保存」/ `Cmd+S` | 遍历 `dirtyPageIds`，对每一页 `renderPageSchemaToHtml(schema)` 重渲并 `PUT /projects/:id/pages/:pageId`，最后清空 `dirtyPageIds` |
| `beforeunload` / 返回项目列表 | `isDirty()` 为真时弹原生 / `window.confirm` 阻止离开 |

注意：v1 起 schema 是必备字段，save 只写 `{ html, title, schema }`，**不再有 `source` / `renderMode`**。

---

## 6. 编辑通道

### 6.1 右面板（设计稿样式调整）

`Layout` / `Display` / `Appearance` / `Typography` / `PageProperties` 五个 section：

- 用 `selection-store.selectedStyles` 做 UI 初值（首次选中时 bridge 异步返回的计算样式）
- onBlur / 滑块变化时调 `editor-store.applySchemaOperations(pageId, [{ type: 'updateStyle', target, styles }])`
- `updateStyle` 的 `target` 是 schema 节点 id，匹配不到时回落到最近的祖先节点（`resolveSchemaNodeId`）；编辑页面级背景/边距时 `target = activePageId`，写到 `schema.page.style`，渲染器把它输出到 `<main.sf-page-shell>`

iframe 重建后，use-bridge 的 `ready` handler 会重发 `get-computed-style` 给当前选中，保证右面板回填值同步。

### 6.2 LayerTree（左面板）

LayerTree 渲染的是 `schema.page.sections` 的 ComponentNode 树（不再读 bridge dom-tree）。

- 单击：和画布选中等价，并预约 `panToElement` 把节点带回视野
- 拖拽：dispatch `applySchemaOperations(pageId, [{ type: 'moveNode', target, reference, position }])`，不再走 bridge `reorder-element`

### 6.3 文本原位编辑

| 步骤 | 触发 | 行为 |
|------|------|------|
| 双击文本节点 | overlay 命中可编辑 tag 列表 | `tool-store.setEditingText(id)` + `start-edit` 消息 |
| iframe 端 | bridge | 设置 `contentEditable=true`、focus、select-all |
| 失焦 / Esc | bridge | 关闭 contentEditable，发 `edit-done`（带 `_rid`） |
| 父级 | use-bridge 收到 `edit-done` | `setEditingText(null)`；下一步把文本回写 schema 应改成 `replaceText` SchemaOperation（v1 末期 TODO） |

> 注：v1 stage 3 删掉了 `syncHTMLFromIframe` 反向回收。文本编辑当前的失焦回写还要落地到 `replaceText` SchemaOp 才能闭环，留待后续小修。

---

## 7. AI 对话

`chat-store.sendMessage`：

1. 读 `selection-store.selectedIds` 拿主选中
2. 通过 bridge RPC `get-element-html` 取选中元素的 outerHTML + 语义信息
3. POST `/projects/:id/chat`，body 含 `pageSchema`（schema 页面才发）+ `elementHtml` / `selectedNode`
4. SSE 流：
   - `chunk`：累加 `streamingContent`
   - `applied`：根据 `event.schemaOperations` 调 `editor-store.applySchemaOperations`；或 legacy `event.html` 路径走 fragment/diff（仅对没有 schema 的兜底页面）
   - `error` / `done`
5. 应用成功时在消息上加 `htmlApplied + appliedMode`，ChatHistory 显示"已应用到画布 · Schema/HTML 片段/HTML Diff"

服务端的 system prompt 已收敛到 SchemaOperation（含 `updateStyle`）。`updateStyle` 时 `target` 可以是 `selectedNode.id` 也可以是 `page.id`（页面背景/边距等）。

---

## 8. iframe 与 Bridge 协议

### 8.1 渲染来源

`page.html` 始终来自 `renderPageSchemaToHtml(schema)`；`ContentIFrame` 把它注入 `srcDoc`，`injectBridge` 在 `</head>` 前插入 bridge 脚本。除了切页强制重载之外，渲染走 `consumeSuppressReload()` 闸门避免冗余重渲。

### 8.2 Bridge 消息（精简）

iframe → 父：

| 类型 | 数据 | 时机 |
|------|------|------|
| `ready` | — | iframe 加载完成 |
| `element-click` | `{ id, rect, label, sfId, component, role, variant, specPath, shiftKey, metaKey, ctrlKey }` | 设计模式点击 |
| `element-hover` | `{ id, rect }` | 设计模式悬停 |
| `element-rect-update` | `{ id, rect }` | 元素位置变化（如 contentEditable 撑大） |
| `edit-done` | `{ id, _rid }` | contentEditable 失焦 |
| `navigate-page` | `{ pageId }` | 预览模式点击 `#page:` 链接 |
| `iframe-wheel` | `{ deltaX, deltaY, ctrlKey, metaKey }` | ctrl/meta + 滚轮 |
| `computed-style` / `element-rect` / `element-html` / `element-replaced` / `operation-result` | RPC 响应 | 含 `_rid` 与发起方匹配 |

父 → iframe：

| 类型 | 说明 |
|------|------|
| `set-mode` | `design` / `preview` |
| `get-rect` / `get-computed-style` / `get-element-html` | RPC 请求，父端用 `requestFromBridge` 包装，自动加 `_rid` 并按 rid 匹配返回 |
| `replace-element-html` | 当前仅 AI fragment 路径使用 |
| `execute-operations` | 旧 DOM-mode 残留，stage 6 后无人调用，待清理 |
| `start-edit` | 进入文本编辑 |
| `update-text` | 写入文本（与 `replaceText` 并存的转场实现） |

**不再存在**：`dom-tree` 推送 / `request-tree` / `get-page-html` / `update-style` / `reorder-element`。

### 8.3 requestId

`bridge/host.ts` 的 `requestFromBridge` 为每次 RPC 生成 `_rid`，并维护一个 `pendingRpc: Map<rid, …>`。iframe 端 `respond(reqData, payload)` 自动把 `_rid` 回带，父端单一 `message` 监听根据 rid 派发到对应 promise。这样同一 `responseType` 的并发调用不会再串味。

---

## 9. 快捷键

| 快捷键 | 行为 | 限制 |
|--------|------|------|
| `Cmd+S` / `Ctrl+S` | 保存所有 dirty 页 | dirty 时生效 |
| `Cmd+Z` | 撤销 | undo 栈非空 |
| `Cmd+Shift+Z` | 重做 | redo 栈非空 |
| `P` | 进入预览模式 | input/textarea 内不触发 |
| `Esc` | 退出预览 / 退出文本编辑 | 上下文相关 |
| 双击文本元素 | 进入原位编辑 | 仅设计模式 + 文本类标签 |

`V` / `Z` / `M` / `T` / `I` 等工具快捷键 TopBar 已标注，但实现仍在 v2 待办。

---

## 10. 文件索引

路径相对 `canvas-editor/src/`。

| 文件 | 职责 |
|------|------|
| `stores/editor-store.ts` | 项目状态 + SchemaOp 派发 + undo/redo 协调 + save。允许 import 其他 store。 |
| `stores/viewport-store.ts` | viewport / device / iframeHeight / panToElement |
| `stores/selection-store.ts` | selectedIds / selectedElements / hovered* / selectedStyles |
| `stores/tool-store.ts` | activeTool / 面板开合 / editingTextId |
| `stores/history-store.ts` | undoStack / redoStack（push/pop 由 editor-store 协调） |
| `stores/coordinate.ts` | 跨 store 订阅：切到 preview 清空选中 |
| `stores/chat-store.ts` | AI 对话 SSE，applied 时调 SchemaOp |
| `bridge/host.ts` | sendBridgeMessage / requestFromBridge（_rid 匹配）/ setPendingReveal / suppressNextIframeReload |
| `bridge/bridge-script.ts` | iframe 内运行时：data-sf-id 标注、语义推断、点击/hover/wheel、文本编辑、execute-operations 应用 |
| `page-schema/render.ts` | renderPageSchemaToHtml + theme + 页面 style 内联 |
| `page-schema/component-registry.ts` | ComponentNode → HTML，含 inline `style` 输出 |
| `page-schema/types.ts` | `PageSchema` / `ComponentNode`，`page.style?: Record<string, string>` |
| `schema-operations/types.ts` | 7 种 SchemaOperation |
| `schema-operations/apply-schema-operation.ts` | 操作的纯函数实现，含 page-level updateStyle |
| `schema-operations/validate-schema-operation.ts` | 校验 + camelCase 安全样式白名单 |
| `hooks/use-bridge.ts` | bridge 消息路由 → store action |
| `components/Canvas/ContentIFrame.tsx` | iframe srcDoc 渲染、overlay、双击文本进入编辑 |
| `components/Canvas/CanvasArea.tsx` | wheel 缩放/平移、UI 条件渲染 |
| `components/Canvas/SelectionOverlay.tsx` | 选中框 + resize 手柄 |
| `components/Canvas/HoverHighlight.tsx` | Hover 高亮 |
| `components/Canvas/BrowserFrame.tsx` | 浏览器外壳、底部高度拖拽 |
| `components/TopBar/TopBar.tsx` | 工具按钮、设备切换、undo/redo、保存（dirty 指示） |
| `components/LeftPanel/PageList.tsx` | 页面 CRUD / 重命名 |
| `components/LeftPanel/LayerTree.tsx` | 从 `schema.page.sections` 渲染图层树，拖拽 → moveNode SchemaOp |
| `components/LeftPanel/SpecStatus.tsx` | 页数 / 节点数 / Token 数（节点从 schema 递归计数） |
| `components/RightPanel/*.tsx` | 5 个 section，全部 dispatch updateStyle SchemaOp |
| `components/ChatBar/*.tsx` | 对话输入 / 历史 |
| `pages/EditorPage.tsx` | 加载项目、快捷键、beforeunload |
| `main.tsx` | BrowserRouter + `installStoreCoordinators()` |
