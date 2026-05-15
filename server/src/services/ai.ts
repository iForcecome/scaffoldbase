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

export function buildFullPageSystemPrompt(): string {
  return `你是 SpecFlow 画布编辑器的 AI 助手。用户会给你一段 HTML 页面代码和修改指令。
请按照指令修改 HTML，并返回完整的修改后 HTML 代码。

规则：
- 用 \`\`\`html 代码块包裹返回的 HTML
- 保持 Tailwind CSS 类名风格
- 不要删除 <script> 标签（包括 tailwindcss CDN 和 tailwind.config）
- 保持页面整体结构完整
- 只返回修改后的完整 HTML，不要解释`
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
