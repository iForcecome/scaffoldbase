export interface AIConfig {
  apiKey: string
  baseUrl: string
  model: string
}

const STORAGE_PREFIX = 'sf-ai-'

export function getAIConfig(): AIConfig {
  return {
    apiKey: localStorage.getItem(STORAGE_PREFIX + 'key') || '',
    baseUrl: localStorage.getItem(STORAGE_PREFIX + 'base') || 'https://api.deepseek.com',
    model: localStorage.getItem(STORAGE_PREFIX + 'model') || 'deepseek-chat',
  }
}

export function setAIConfig(patch: Partial<AIConfig>) {
  if (patch.apiKey !== undefined) localStorage.setItem(STORAGE_PREFIX + 'key', patch.apiKey)
  if (patch.baseUrl !== undefined) localStorage.setItem(STORAGE_PREFIX + 'base', patch.baseUrl)
  if (patch.model !== undefined) localStorage.setItem(STORAGE_PREFIX + 'model', patch.model)
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function* streamChat(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const config = getAIConfig()
  if (!config.apiKey) throw new Error('请先在设置中配置 API Key')

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
      temperature: 0.3,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API 请求失败 (${res.status}): ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取响应流')

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

export function extractHTML(text: string): string | null {
  const fenceMatch = text.match(/```html\s*\n([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  const htmlMatch = text.match(/<(!doctype|html)[^>]*>[\s\S]*<\/html>/i)
  if (htmlMatch) return htmlMatch[0].trim()

  const tagMatch = text.match(/<[a-z][^>]*>[\s\S]*<\/[a-z]+>/i)
  if (tagMatch) return tagMatch[0].trim()

  return null
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

export function buildFragmentUserPrompt(
  elementHtml: string,
  userMessage: string,
  elementInfo: { tag: string; label: string },
): string {
  return `当前选中元素 (<${elementInfo.tag}>, 名称: "${elementInfo.label}") 的 HTML:
\`\`\`html
${elementHtml}
\`\`\`

修改指令: ${userMessage}`
}

export function buildMultiFragmentUserPrompt(
  elements: { html: string; tag: string; label: string }[],
  userMessage: string,
): string {
  const parts = elements.map((el, i) =>
    `元素 ${i + 1} (<${el.tag}>, 名称: "${el.label}"):
\`\`\`html
${el.html}
\`\`\``
  )
  return `当前选中了 ${elements.length} 个元素，请对每个元素应用同样的修改指令。

${parts.join('\n\n')}

修改指令: ${userMessage}`
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

export function buildFullPageUserPrompt(
  html: string,
  userMessage: string,
): string {
  return `当前页面 HTML:
\`\`\`html
${html}
\`\`\`

修改指令: ${userMessage}`
}
