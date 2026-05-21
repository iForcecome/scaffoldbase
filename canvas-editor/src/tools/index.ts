// 入口：import 这里就把所有 tool 注册进 registry。
// 顺序无关，但保持 page → node → misc 的语义分组方便查阅。

import './page-tools'
import './node-tools'
import './misc-tools'

export { dispatchTools } from './dispatcher'
export { getTool, listTools, exportToolsForAI } from './registry'
export type {
  ToolDef,
  ToolCall,
  ToolResult,
  ToolEffect,
  ToolContext,
  DispatchResult,
  SelectionSnapshot,
} from './types'
