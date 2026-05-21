import type { ToolDef } from './types'

// 简单的全局注册表。tool 模块在 import 时调用 register。
// 不用单例 class，因为没有多 registry 的需要。

const registry = new Map<string, ToolDef>()

export function registerTool(tool: ToolDef): void {
  if (registry.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`)
  }
  registry.set(tool.name, tool)
}

export function getTool(name: string): ToolDef | undefined {
  return registry.get(name)
}

export function listTools(): ToolDef[] {
  return Array.from(registry.values())
}

/** P2 给 Anthropic tool_use 用：导出 JSON Schema 形式 */
export function exportToolsForAI(): Array<{
  name: string
  description: string
  input_schema: object
}> {
  return listTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.paramsSchema,
  }))
}
