import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/client.js'
import { specs, conversations } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'
import {
  streamChat,
  buildDiffSystemPrompt,
  buildFullPageUserPrompt,
  buildFragmentSystemPrompt,
  buildSchemaOperationSystemPrompt,
  buildSchemaOperationUserPrompt,
  extractDiffs,
  applyDiffs,
  extractHTML,
  extractSchemaOperationResponse,
  type ChatMessage,
} from '../services/ai.js'

type Page = { id: string; title: string; html: string; schema?: unknown; source?: 'schema' | 'legacy-html'; origin?: unknown }
type ChatBody = {
  message: string
  pageId?: string
  pageSource?: 'schema' | 'legacy-html'
  pageSchema?: unknown
  elementId?: string
  elementHtml?: string
  selectedNode?: unknown
}
type ChatMode = {
  isSchemaMode: boolean
  isFragmentMode: boolean
  wantsLayoutRewrite: boolean
}

function sendSSE(reply: { raw: { write: (data: string) => void } }, data: unknown) {
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
}

function appendClasses(className: string, classes: string[]) {
  const current = new Set(className.split(/\s+/).filter(Boolean))
  for (const cls of classes) current.add(cls)
  return Array.from(current).join(' ')
}

function optimizeLayoutFallbackFragment(html: string): string | null {
  let result = html
  let changed = false

  result = result.replace(/<section\b([^>]*)class="([^"]*)"([^>]*)>/i, (full, before, className, after) => {
    let next = className
      .replace(/\bpt-\S+/g, '')
      .replace(/\bpb-\S+/g, '')
      .replace(/\bpx-\S+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    next = appendClasses(next, ['py-24', 'md:py-28', 'px-6'])
    changed = changed || next !== className
    return `<section${before}class="${next}"${after}>`
  })

  const replacements: Array<[RegExp, string]> = [
    [/\bmax-w-5xl mx-auto px-6 relative\b/g, 'max-w-6xl mx-auto px-6 relative'],
    [/\btext-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6\b/g, 'text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-5 max-w-4xl'],
    [/\btext-lg md:text-xl text-white\/70 max-w-3xl leading-relaxed mb-8\b/g, 'text-lg md:text-xl text-white/72 max-w-2xl leading-relaxed mb-10'],
    [/\bgrid grid-cols-2 md:grid-cols-4 gap-4 mt-8\b/g, 'grid grid-cols-2 md:grid-cols-4 gap-5 mt-10'],
    [/\bgrid md:grid-cols-2 gap-4 mt-10\b/g, 'grid md:grid-cols-2 gap-5 mt-12'],
    [/\brounded-xl p-4 text-center\b/g, 'rounded-2xl p-5 text-center'],
    [/\brounded-xl p-5 backdrop-blur\b/g, 'rounded-2xl p-6 backdrop-blur'],
  ]

  for (const [pattern, replacement] of replacements) {
    const next = result.replace(pattern, replacement)
    if (next !== result) changed = true
    result = next
  }

  return changed ? result : null
}

function resolveChatMode(body: ChatBody, page?: Page): ChatMode {
  const pageSource = body.pageSource ?? page?.source
  const pageSchema = body.pageSchema ?? page?.schema
  const isSchemaMode = pageSource === 'schema' && !!pageSchema
  const isFragmentMode = !!body.elementHtml
  const wantsLayoutRewrite = !!body.elementHtml &&
    body.elementHtml.length > 800 &&
    /布局|排版|优化|美化|重构|整体|间距|对齐|层次|视觉/.test(body.message)
  return { isSchemaMode, isFragmentMode, wantsLayoutRewrite }
}

function buildChatMessages(body: ChatBody, pageHtml: string, mode: ChatMode, page?: Page): ChatMessage[] {
  if (mode.isSchemaMode) {
    return [
      { role: 'system', content: buildSchemaOperationSystemPrompt() },
      {
        role: 'user',
        content: buildSchemaOperationUserPrompt({
          message: body.message,
          pageSchema: body.pageSchema ?? page?.schema,
          selectedNode: body.selectedNode ?? { id: page?.id, label: page?.title, component: 'Page' },
        }),
      },
    ]
  }

  if (mode.isFragmentMode) {
    return [
      { role: 'system', content: buildFragmentSystemPrompt() },
      {
        role: 'user',
        content: `当前选中元素的 HTML:\n\`\`\`html\n${body.elementHtml}\n\`\`\`\n\n修改指令: ${body.message}\n\n要求：返回修改后的完整选中元素 HTML 片段，根标签必须保持不变。`,
      },
    ]
  }

  return [
    { role: 'system', content: buildDiffSystemPrompt() },
    { role: 'user', content: buildFullPageUserPrompt(pageHtml, body.message) },
  ]
}

function resolveAppliedResult(fullContent: string, body: ChatBody, pageHtml: string, mode: ChatMode) {
  if (mode.isSchemaMode) {
    const operationResponse = extractSchemaOperationResponse(fullContent)
    if (operationResponse) {
      return { didApply: true, event: { type: 'applied', schemaOperations: operationResponse.operations, mode: 'schema-operations' } }
    }
    return { didApply: false, event: null }
  }

  if (mode.isFragmentMode) {
    const appliedHtml = extractHTML(fullContent) ||
      (mode.wantsLayoutRewrite && body.elementHtml ? optimizeLayoutFallbackFragment(body.elementHtml) : null)
    if (appliedHtml) {
      return { didApply: true, event: { type: 'applied', html: appliedHtml, mode: 'fragment' } }
    }
    return { didApply: false, event: null }
  }

  const diffs = extractDiffs(fullContent)
  let appliedHtml: string | null = diffs.length > 0 ? applyDiffs(pageHtml, diffs) : null
  if (!appliedHtml) {
    const extracted = extractHTML(fullContent)
    if (extracted) appliedHtml = extracted
  }
  if (appliedHtml) {
    return { didApply: true, event: { type: 'applied', html: appliedHtml, mode: 'diff' } }
  }
  return { didApply: false, event: null }
}

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post('/projects/:id/chat', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
          pageId: { type: 'string' },
          pageSource: { type: 'string', enum: ['schema', 'legacy-html'] },
          pageSchema: { type: 'object', additionalProperties: true },
          elementId: { type: 'string' },
          elementHtml: { type: 'string' },
          selectedNode: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as ChatBody

    const spec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })

    if (!spec) {
      reply.status(404)
      return { error: 'Project spec not found' }
    }

    const pages = (spec.pages ?? []) as Page[]
    const page = body.pageId ? pages.find((p) => p.id === body.pageId) : pages[0]
    const pageHtml = page?.html ?? ''
    const mode = resolveChatMode(body, page)
    const apiMessages = buildChatMessages(body, pageHtml, mode, page)

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    let fullContent = ''
    const ac = new AbortController()
    request.raw.on('close', () => ac.abort())

    try {
      for await (const chunk of streamChat(apiMessages, ac.signal)) {
        fullContent += chunk
        sendSSE(reply, { type: 'chunk', content: chunk })
      }

      const result = resolveAppliedResult(fullContent, body, pageHtml, mode)
      if (result.event) sendSSE(reply, result.event)

      if (!result.didApply) {
        sendSSE(reply, {
          type: 'error',
          message: 'AI 没有返回可应用的修改。请重新选择更明确的区域，或使用更具体的指令。',
        })
      }

      sendSSE(reply, { type: 'done' })

      await db.insert(conversations).values({
        projectId: id,
        messages: [
          { role: 'user', content: body.message, timestamp: Date.now() },
          { role: 'assistant', content: fullContent, timestamp: Date.now() },
        ],
        specVersionAt: spec.version,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      sendSSE(reply, { type: 'error', message })
    }

    reply.raw.end()
  })

  app.post('/projects/:id/chat/dry-run', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
          pageId: { type: 'string' },
          pageSource: { type: 'string', enum: ['schema', 'legacy-html'] },
          pageSchema: { type: 'object', additionalProperties: true },
          elementHtml: { type: 'string' },
          selectedNode: { type: 'object' },
          aiContent: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as ChatBody & { aiContent?: string }

    const spec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })

    if (!spec) {
      reply.status(404)
      return { error: 'Project spec not found' }
    }

    const pages = (spec.pages ?? []) as Page[]
    const page = body.pageId ? pages.find((p) => p.id === body.pageId) : pages[0]
    const pageHtml = page?.html ?? ''
    const mode = resolveChatMode(body, page)
    const fullContent = body.aiContent ?? ''
    const result = resolveAppliedResult(fullContent, body, pageHtml, mode)

    return {
      mode,
      didApply: result.didApply,
      event: result.event,
      message: result.didApply ? null : 'AI 没有返回可应用的修改。',
    }
  })
}
