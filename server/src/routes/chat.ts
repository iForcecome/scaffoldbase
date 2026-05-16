import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/client.js'
import { specs, conversations } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'
import {
  streamChat,
  buildDiffSystemPrompt,
  buildFullPageUserPrompt,
  buildFragmentSystemPrompt,
  extractDiffs,
  applyDiffs,
  extractHTML,
  type ChatMessage,
} from '../services/ai.js'

type Page = { id: string; title: string; html: string }

function sendSSE(reply: { raw: { write: (data: string) => void } }, data: unknown) {
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
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
          elementId: { type: 'string' },
          elementHtml: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      message: string
      pageId?: string
      elementId?: string
      elementHtml?: string
    }

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
    const isFragmentMode = !!body.elementHtml

    let apiMessages: ChatMessage[]

    if (isFragmentMode) {
      apiMessages = [
        { role: 'system', content: buildFragmentSystemPrompt() },
        {
          role: 'user',
          content: `当前选中元素的 HTML:\n\`\`\`html\n${body.elementHtml}\n\`\`\`\n\n修改指令: ${body.message}`,
        },
      ]
    } else {
      apiMessages = [
        { role: 'system', content: buildDiffSystemPrompt() },
        { role: 'user', content: buildFullPageUserPrompt(pageHtml, body.message) },
      ]
    }

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

      let appliedHtml: string | null = null

      if (isFragmentMode) {
        appliedHtml = extractHTML(fullContent)
        if (appliedHtml) {
          sendSSE(reply, { type: 'applied', html: appliedHtml, mode: 'fragment' })
        }
      } else {
        const diffs = extractDiffs(fullContent)
        if (diffs.length > 0) {
          appliedHtml = applyDiffs(pageHtml, diffs)
        }
        if (!appliedHtml) {
          const extracted = extractHTML(fullContent)
          if (extracted) appliedHtml = extracted
        }
        if (appliedHtml) {
          sendSSE(reply, { type: 'applied', html: appliedHtml, mode: 'diff' })
        }
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
}
