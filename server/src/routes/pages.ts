import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/client.js'
import { specs } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

type Page = {
  id: string
  title: string
  html: string
  schema?: unknown
  source?: 'schema' | 'legacy-html'
  renderMode?: 'source-html' | 'schema'
  origin?: unknown
}

export const pageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects/:id/pages', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const spec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })

    if (!spec) {
      reply.status(404)
      return { error: 'Project spec not found' }
    }

    return (spec.pages ?? []) as Page[]
  })

  app.put('/projects/:id/pages/:pageId', {
    schema: {
      params: {
        type: 'object',
        required: ['id', 'pageId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          pageId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['html'],
        properties: {
          title: { type: 'string' },
          html: { type: 'string' },
          schema: { type: 'object', additionalProperties: true },
          source: { type: 'string', enum: ['schema', 'legacy-html'] },
          renderMode: { type: 'string', enum: ['source-html', 'schema'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id, pageId } = request.params as { id: string; pageId: string }
    const body = request.body as {
      title?: string
      html: string
      schema?: unknown
      source?: 'schema' | 'legacy-html'
      renderMode?: 'source-html' | 'schema'
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
    const pageIndex = pages.findIndex((p) => p.id === pageId)

    if (pageIndex === -1) {
      pages.push({
        id: pageId,
        title: body.title ?? 'Untitled',
        html: body.html,
        schema: body.schema,
        source: body.source ?? 'legacy-html',
        renderMode: body.renderMode,
      })
    } else {
      if (body.title) pages[pageIndex].title = body.title
      pages[pageIndex].html = body.html
      if ('schema' in body) pages[pageIndex].schema = body.schema
      if (body.source) pages[pageIndex].source = body.source
      if (body.renderMode) pages[pageIndex].renderMode = body.renderMode
    }

    const [updated] = await db.update(specs)
      .set({ pages })
      .where(eq(specs.id, spec.id))
      .returning()

    return updated.pages as Page[]
  })

  app.delete('/projects/:id/pages/:pageId', {
    schema: {
      params: {
        type: 'object',
        required: ['id', 'pageId'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          pageId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id, pageId } = request.params as { id: string; pageId: string }

    const spec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })

    if (!spec) {
      reply.status(404)
      return { error: 'Project spec not found' }
    }

    const pages = (spec.pages ?? []) as Page[]
    const pageIndex = pages.findIndex((p) => p.id === pageId)

    if (pageIndex === -1) {
      return pages
    }

    if (pages.length <= 1) {
      reply.status(400)
      return { error: 'Cannot delete the last page' }
    }

    const nextPages = pages.filter((p) => p.id !== pageId)
    const [updated] = await db.update(specs)
      .set({ pages: nextPages })
      .where(eq(specs.id, spec.id))
      .returning()

    return updated.pages as Page[]
  })
}
