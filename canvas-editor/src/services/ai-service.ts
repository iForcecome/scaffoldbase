export function extractHTML(text: string): string | null {
  const fenceMatch = text.match(/```html\s*\n([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  const htmlMatch = text.match(/<(!doctype|html)[^>]*>[\s\S]*<\/html>/i)
  if (htmlMatch) return htmlMatch[0].trim()

  const tagMatch = text.match(/<[a-z][^>]*>[\s\S]*<\/[a-z]+>/i)
  if (tagMatch) return tagMatch[0].trim()

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
