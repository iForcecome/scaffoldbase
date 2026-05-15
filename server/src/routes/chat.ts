import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/client.js'
import { specs, conversations } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'
import { streamChat, buildFullPageSystemPrompt, type ChatMessage } from '../services/ai.js'

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

    const pages = (spec.pages ?? []) as { id: string; title: string; html: string }[]
    const page = body.pageId ? pages.find((p) => p.id === body.pageId) : pages[0]
    const pageHtml = page?.html ?? ''

    const apiMessages: ChatMessage[] = [
      { role: 'system', content: buildFullPageSystemPrompt() },
      {
        role: 'user',
        content: body.elementHtml
          ? `当前选中元素的 HTML:\n\`\`\`html\n${body.elementHtml}\n\`\`\`\n\n完整页面 HTML:\n\`\`\`html\n${pageHtml}\n\`\`\`\n\n修改指令: ${body.message}`
          : `当前页面 HTML:\n\`\`\`html\n${pageHtml}\n\`\`\`\n\n修改指令: ${body.message}`,
      },
    ]

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    let fullContent = ''

    try {
      for await (const chunk of streamChat(apiMessages, request.raw.signal)) {
        fullContent += chunk
        reply.raw.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
      }

      reply.raw.write(`data: ${JSON.stringify({ type: 'done', fullContent })}\n\n`)

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
      reply.raw.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
    }

    reply.raw.end()
  })
}
