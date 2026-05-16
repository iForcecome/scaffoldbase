import { env } from '../env.js'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const apiKey = env.AI_API_KEY
  if (!apiKey) throw new Error('AI_API_KEY not configured')

  const res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages,
      stream: true,
      temperature: 0.3,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API error (${res.status}): ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('Cannot read response stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') return

      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export interface DiffBlock {
  search: string
  replace: string
}

export function buildDiffSystemPrompt(): string {
  return `你是 SpecFlow 画布编辑器的 AI 助手。
用户会给你页面的【<head> 完整代码 + <body> 结构骨架】和修改指令。
body 中每个区块只显示了开始标签（含 class/id），内容用 … 代替。
<style> 和 tailwind.config 是完整的。

用搜索替换输出修改：
<<<SEARCH>>>
原始文本
<<<REPLACE>>>
新文本
<<<END>>>

规则：
- SEARCH 必须与原 HTML 中的文本完全一致
- 全局样式（背景、字体、颜色）→ 改 <style> 中的 CSS 属性值
- 区块样式 → 改对应开始标签的 class 属性（用 id 区分同类标签）
- 只返回搜索替换块，不要解释
- 改动尽量少，越精确越好`
}

export function compressHTMLForModel(html: string): string {
  let result = html
    .replace(/<style>[\s\S]*?<\/style>/gi, (m) =>
      m.includes('tailwindcss v') || m.includes('--tw-border-spacing') ? '' : m)
    .replace(/<svg[\s\S]*?<\/svg>/gi, '<svg>…</svg>')
    .replace(/<!--[\s\S]*?-->/g, '')

  result = result.replace(
    /<(nav|section|footer|header|main|article)\b([^>]*)>[\s\S]*?<\/\1>/gi,
    (_, tag, attrs) => `<${tag}${attrs}>…</${tag}>`,
  )

  result = result.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (full, inner) => {
    if (!inner.trim()) return full
    if (inner.includes('tailwind.config')) return full
    return ''
  })

  return result.replace(/\n{3,}/g, '\n').trim()
}

export function buildFullPageUserPrompt(html: string, userMessage: string): string {
  const cleanHtml = compressHTMLForModel(html)
  return `当前页面 HTML:
\`\`\`html
${cleanHtml}
\`\`\`

修改指令: ${userMessage}`
}

export function extractDiffs(text: string): DiffBlock[] {
  const blocks: DiffBlock[] = []
  const regex = /<<<SEARCH>>>\n([\s\S]*?)\n<<<REPLACE>>>\n([\s\S]*?)\n<<<END>>>/g
  let match
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ search: match[1], replace: match[2] })
  }
  return blocks
}

export function applyDiffs(html: string, diffs: DiffBlock[]): string | null {
  let result = html
  let applied = 0
  for (const diff of diffs) {
    if (result.includes(diff.search)) {
      result = result.replace(diff.search, diff.replace)
      applied++
    }
  }
  return applied > 0 ? result : null
}

export function extractHTML(text: string): string | null {
  const fenceMatch = text.match(/```html\s*\n([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  const htmlMatch = text.match(/<(!doctype|html)[^>]*>[\s\S]*<\/html>/i)
  if (htmlMatch) return htmlMatch[0].trim()

  return null
}

export function extractAllHTML(text: string): string[] {
  const results: string[] = []
  const regex = /```html\s*\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim())
  }
  return results
}

export function buildFragmentSystemPrompt(multiCount?: number): string {
  if (multiCount && multiCount > 1) {
    return `你是 SpecFlow 画布编辑器的 AI 助手。用户会给你 ${multiCount} 段 HTML 元素片段和修改指令。
请按照指令分别修改每个元素片段，并返回修改后的 HTML 片段。

规则：
- 按顺序为每个元素返回修改后的 HTML，每段用 \`\`\`html 代码块包裹
- 保持 Tailwind CSS 类名风格
- 只返回修改后的元素片段（不要返回完整页面）
- 保持每个元素的根标签不变
- 不要解释，只返回代码
- 一共返回 ${multiCount} 段代码块，顺序和输入一致`
  }
  return `你是 SpecFlow 画布编辑器的 AI 助手。用户会给你一段 HTML 元素片段和修改指令。
请按照指令修改这个元素片段，并返回修改后的 HTML 片段。

规则：
- 用 \`\`\`html 代码块包裹返回的 HTML
- 保持 Tailwind CSS 类名风格
- 只返回修改后的元素片段（不要返回完整页面）
- 保持元素的根标签不变
- 不要解释，只返回代码`
}
