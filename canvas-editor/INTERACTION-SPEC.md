# SpecFlow Canvas Editor 交互规格文档

## 目录

- [1. 模式系统](#1-模式系统)
- [2. 画布操作](#2-画布操作)
- [3. 元素选择与多选](#3-元素选择与多选)
- [4. 多页面管理](#4-多页面管理)
- [5. AI 对话](#5-ai-对话)
- [6. iframe 内容架构](#6-iframe-内容架构)
- [7. 快捷键](#7-快捷键)
- [8. 文件索引](#8-文件索引)

---

## 1. 模式系统

编辑器有两种核心模式：**设计模式**和**预览模式**，采用 Framer 风格的 Play 按钮切换。

### 1.1 设计模式（默认）

| 维度 | 说明 |
|------|------|
| iframe 交互 | iframe 设为 `pointerEvents: none`，上方覆盖透明 overlay div 拦截所有鼠标事件 |
| 元素选择 | overlay 通过 `elementFromPoint` 查找 iframe 内元素，实现选择和 hover |
| CSS :hover | 完全阻止——鼠标从未真正进入 iframe，所以不会触发任何 CSS :hover 效果 |
| bridge 模式 | `mode = 'design'`，click / mousemove / dblclick 均被 `preventDefault + stopPropagation` |
| 可见 UI | 左面板（页面列表 + 图层树）、右面板（属性）、选中框、Hover 高亮、ChatBar、尺寸指示器、MiniMap |

### 1.2 预览模式

| 维度 | 说明 |
|------|------|
| iframe 交互 | overlay 移除，iframe `pointerEvents: auto`，用户可直接操作页面内所有元素 |
| 链接处理 | `#page:xxx` 格式触发页面间跳转；所有其他链接（含 `href="#"`）被 `preventDefault` 防止 iframe 导航 |
| bridge 模式 | `mode = 'preview'`，click / mousemove / dblclick 不拦截 |
| 隐藏 UI | 左面板、右面板、选中框、Hover 高亮、ChatBar、尺寸指示器全部隐藏，画布全屏沉浸 |
| 保留 UI | TopBar（含 Play 按钮用于退出）、ZoomControls、MiniMap |

### 1.3 模式切换方式

| 方式 | 操作 | 效果 |
|------|------|------|
| TopBar Play 按钮 | 点击 | 设计 → 预览（绿色高亮）；再次点击 → 回到选择工具 |
| 快捷键 `P` | 按下 | 进入预览模式（输入框内不触发） |
| 快捷键 `Esc` | 按下 | 退出预览模式，回到选择工具 |

### 1.4 模式同步机制

当切换模式时，`setTool` action 执行以下操作：

1. 进入预览：清空 `selectedIds`、`selectedElements`、`selectedStyles`、`hoveredId`、`hoveredRect`
2. 通过 `sendBridgeMessage({ type: 'set-mode', mode })` 通知 iframe
3. iframe 重载后（如切页），bridge `ready` 消息触发时重新同步当前 mode

---

## 2. 画布操作

### 2.1 缩放

| 操作 | 行为 | 实现 |
|------|------|------|
| 触摸板双指缩放 | 画布缩放（0.1x ~ 3x），不影响浏览器页面缩放 | CanvasArea 原生 `wheel` 监听，检测 `ctrlKey/metaKey` |
| iframe 内 Ctrl/Meta + 滚轮 | bridge 转发 `iframe-wheel` 消息到父级处理 | bridge-script wheel handler |
| ZoomControls 按钮 | +/- 按钮调整缩放，重置到 100% | ZoomControls 组件 |

**浏览器缩放防护：**
- `document` 级 `wheel` 事件监听，`Ctrl/Meta + scroll` 时 `preventDefault`（`main.tsx`）
- `index.html` viewport meta 设置 `maximum-scale=1.0, user-scalable=no`

### 2.2 平移

| 操作 | 行为 | 实现 |
|------|------|------|
| 触摸板双指滑动 | 画布平移（deltaX, deltaY 直接映射） | CanvasArea wheel 事件更新 `viewport.x/y` |
| iframe 内普通滚动 | 内容区自然滚动，**不**平移画布 | bridge 仅在 `ctrlKey/metaKey` 时转发 |

### 2.3 事件穿透防护

ChatBar、ZoomControls、MiniMap 添加 `data-no-canvas-wheel` 属性。CanvasArea 原生 wheel handler 检测到该属性时跳过画布平移/缩放，确保在这些 UI 上滚动不会移动画布。

---

## 3. 元素选择与多选

### 3.1 选择操作

| 操作 | 行为 |
|------|------|
| 单击元素 | 选中该元素（替换之前的选中） |
| Shift / Cmd / Ctrl + 单击 | 多选——累加到选中列表；如果已选中则取消选中 |
| 单击画布空白区 | 清空所有选中 |
| 图层树单击 | 选中对应元素，支持修饰键多选 |
| 选中元素后 | ChatInput textarea 自动获得焦点 |

### 3.2 选中状态数据结构

```
selectedIds: string[]                        // 所有选中元素 ID
selectedElements: Record<string, {           // 每个选中元素的元数据
  label: string | null
  rect: { x, y, width, height } | null
}>
```

- `getPrimarySelectedId()` 返回最后一个选中的元素（主选中）
- 主选中元素在 SelectionOverlay 中显示虚线边框 + resize 手柄
- 其他选中元素显示实线边框

### 3.3 选中元素在 ChatInput 的展示

- 选中元素显示为独立行的标签 chips，超出区域水平滚动
- 每个 chip 显示元素标签（truncate 省略），右侧 × 按钮可移除
- 多选时显示"清除"按钮一键清空
- 滚动 chips 行不会触发画布平移（`no-scrollbar` CSS 类 + `data-no-canvas-wheel`）

---

## 4. 多页面管理

### 4.1 页面列表（左面板）

位于左面板最上方，可折叠，显示所有页面和页面数量。

| 操作 | 行为 |
|------|------|
| 单击页面 | 切换到该页面（清空选中状态，重置视口） |
| 双击页面 | 进入重命名（内联 input，自动 focus 并全选） |
| Enter / 失焦 | 确认重命名 |
| Escape | 取消重命名 |
| `...` 按钮 | 弹出上下文菜单（重命名 / 复制 / 删除） |
| `+` 按钮 | 新建空白页面，自动切换 |
| 点击"页面"标题 | 折叠/展开页面列表 |

### 4.2 页面 CRUD

| Action | 行为 | 约束 |
|--------|------|------|
| `addPage()` | 创建空白页，自动切换 | ID = `page-{timestamp}` |
| `deletePage(id)` | 删除指定页面，切换到相邻页面 | 至少保留 1 个页面 |
| `duplicatePage(id)` | 复制页面（标题 + "副本"），插入到原页面之后 | 自动切换到副本 |
| `renamePage(id, title)` | 更新页面标题 | `title.trim()` 非空时生效 |

### 4.3 页面间导航（预览模式）

页面内 HTML 中的链接使用 `<a href="#page:pageId">` 格式：

1. bridge 检测到 `#page:` 前缀 → `preventDefault` → 发送 `navigate-page` 消息
2. 父级 `use-bridge` 收到消息 → 调用 `setActivePage(pageId)` 切换页面
3. iframe 重载 → bridge `ready` → 重新同步 mode

其他所有链接（包括 `href="#"`、普通 URL）在预览模式下均被 `preventDefault`，防止 iframe 导航到不存在的地址导致内容丢失。

---

## 5. AI 对话

### 5.1 对话流程

**单元素修改：**

1. 用户选中 1 个元素 → 发送消息
2. 通过 bridge `get-element-html` 获取元素 outerHTML
3. `buildFragmentSystemPrompt` 构建 prompt → `streamChat` 流式调用 AI
4. `extractHTML` 提取返回的 HTML 代码块
5. 通过 bridge `replace-element-html` 替换元素

**多元素修改：**

1. 用户选中多个元素 → 发送消息
2. 并行请求所有选中元素的 HTML
3. `buildMultiFragmentUserPrompt` 构建多片段 prompt（`multiCount` 参数）
4. `extractAllHTML` 提取多个 HTML 代码块
5. 逐个 `replace-element-html` 应用到各元素

### 5.2 对话历史

| 行为 | 触发条件 |
|------|----------|
| 自动显示 | 新消息发送/接收时，历史面板自动弹出 |
| 手动切换 | ChatInput 中的历史按钮 toggle 显示/隐藏 |
| 关闭后可恢复 | 关闭面板后可通过按钮重新打开 |

---

## 6. iframe 内容架构

### 6.1 渲染方式

使用 `iframe.srcDoc` 注入 HTML 内容，配合 `sandbox="allow-scripts allow-same-origin"` 实现同源访问。`injectBridge` 函数在注入前会：

1. 清理已有的 `data-sf-id` 属性（正则替换）
2. 清理已有的 bridge script 块
3. 注入最新版 bridge 脚本到 `</head>` 前

### 6.2 尺寸控制

| 属性 | 值 | 说明 |
|------|-----|------|
| 桌面宽度 | 1080px | `DEVICE_WIDTHS.desktop` |
| 移动端宽度 | 375px | `DEVICE_WIDTHS.mobile` |
| 最小高度 | 768px | `setIframeHeight` 中 `Math.max(768, h)` |
| 自动高度 | `body.scrollHeight` | iframe `onLoad` 后读取 |
| 手动调整 | 底部拖拽手柄 | BrowserFrame 中 Pointer Events 实现 |

### 6.3 Bridge 消息协议

**iframe → 父级：**

| 消息类型 | 触发时机 | 关键数据 |
|----------|----------|----------|
| `ready` | bridge 初始化完成 | — |
| `dom-tree` | DOM 变化 / 初始化 | `{ tree: DOMNode[] }` |
| `element-click` | 设计模式点击元素 | `{ id, rect, label, shiftKey, metaKey, ctrlKey }` |
| `element-hover` | 设计模式 hover | `{ id, rect }` |
| `computed-style` | 响应样式请求 | `{ id, styles, rect, label }` |
| `element-html` | 响应 HTML 请求 | `{ id, html, tag, label }` |
| `element-replaced` | HTML 替换完成 | `{ id, rect }` |
| `element-rect-update` | 样式更新后 | `{ id, rect }` |
| `navigate-page` | 预览模式点击 `#page:` 链接 | `{ pageId }` |
| `iframe-wheel` | Ctrl/Meta + 滚轮 | `{ deltaX, deltaY, ctrlKey, metaKey }` |
| `page-html` | 响应整页 HTML 请求 | `{ html }` |

**父级 → iframe：**

| 消息类型 | 说明 |
|----------|------|
| `request-tree` | 请求重新发送 DOM 树 |
| `set-mode` | 切换 `design` / `preview` 模式 |
| `update-style` | 更新元素行内样式 |
| `update-text` | 更新元素文本内容 |
| `get-rect` | 请求元素位置 |
| `get-computed-style` | 请求计算后样式 |
| `get-element-html` | 请求元素 outerHTML |
| `replace-element-html` | 替换元素 HTML |
| `get-page-html` | 请求整页干净 HTML（去除 bridge 标记） |

---

## 7. 快捷键

| 快捷键 | 行为 | 限制 |
|--------|------|------|
| `P` | 进入预览模式 | 输入框 / 文本域中不触发 |
| `Esc` | 退出预览模式 | 仅在预览模式下 |
| `V` | 选择工具 | TopBar 标注，待实现 |
| `Z` | 缩放工具 | TopBar 标注，待实现 |
| `M` | 框选工具 | TopBar 标注，待实现 |
| `T` | 文本工具 | TopBar 标注，待实现 |
| `I` | 插入工具 | TopBar 标注，待实现 |

---

## 8. 文件索引

所有路径相对于 `canvas-editor/src/`。

| 文件 | 职责 |
|------|------|
| `stores/editor-store.ts` | 全局状态：Tool 类型（含 preview）、选中、视口、页面 CRUD、设备、undo/redo、bridge 消息 |
| `stores/chat-store.ts` | 对话状态：消息列表、AI 流式调用、多元素 prompt 构建与应用 |
| `bridge/bridge-script.ts` | iframe 注入脚本：事件拦截、DOM 树解析、20 种消息协议、design/preview 模式切换 |
| `hooks/use-bridge.ts` | 父级消息路由：分发 bridge 消息到 store action、ready 时同步 mode、navigate-page 处理 |
| `components/Canvas/ContentIFrame.tsx` | iframe 渲染：srcDoc 管理、overlay 覆盖层（设计模式）、elementFromPoint 元素选取 |
| `components/Canvas/CanvasArea.tsx` | 画布容器：原生 wheel 事件（缩放/平移）、data-no-canvas-wheel 检测、条件渲染 UI |
| `components/Canvas/SelectionOverlay.tsx` | 选中框：多选中框渲染、主选中虚线边框 + resize 手柄 |
| `components/Canvas/HoverHighlight.tsx` | Hover 高亮：排除已选中元素 |
| `components/Canvas/BrowserFrame.tsx` | 浏览器外壳：URL 栏模拟、底部拖拽调整 iframe 高度 |
| `components/Canvas/ZoomControls.tsx` | 缩放控件：+/- 按钮、百分比显示 |
| `components/Canvas/MiniMap.tsx` | 小地图：画布缩略视图 |
| `components/TopBar/TopBar.tsx` | 顶部工具栏：6 种工具按钮（含 Play 预览）、设备切换、undo/redo、导出 |
| `components/LeftPanel/LeftPanel.tsx` | 左面板布局：PageList + 图层标题 + LayerTree + SpecStatus |
| `components/LeftPanel/PageList.tsx` | 页面列表：折叠/展开、新增、重命名（双击/菜单）、复制、删除 |
| `components/LeftPanel/LayerTree.tsx` | 图层树：DOM 可视化、点击选中（支持修饰键多选） |
| `components/RightPanel/RightPanel.tsx` | 右面板：主选中元素属性、多选计数 |
| `components/ChatBar/ChatInput.tsx` | 对话输入：元素 chips（水平滚动/truncate/移除）、自动 focus、历史切换 |
| `components/ChatBar/ChatBar.tsx` | 对话栏容器：消息到达自动弹出历史、data-no-canvas-wheel |
| `services/ai-service.ts` | AI 服务：单/多元素 prompt 构建、HTML 提取（extractHTML / extractAllHTML） |
| `utils/inject-bridge.ts` | Bridge 注入：去重清理（data-sf-id + 旧 bridge script）→ 注入最新脚本 |
| `data/mock-pages.ts` | Mock 数据：4 页面（首页/订单列表/订单详情/导出配置），含 `#page:` 导航链接 |
| `App.tsx` | 应用根：预览模式面板显隐、P / Esc 快捷键监听 |
| `main.tsx` | 入口：全局 wheel preventDefault 禁止浏览器缩放 |
| `index.html` | 根 HTML：viewport meta `maximum-scale=1.0, user-scalable=no` |
| `index.css` | 全局样式：`no-scrollbar` 工具类 |
