import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/client.js'
import { specs, type PageData } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

/**
 * v1 → v2 page shape 兼容。
 *
 * 老 jsonb 数据形态：{ id, title, html, schema?, origin?, source? }
 * v2 形态：{ id, title, layoutId, contentHtml }
 *
 * 这层只在 GET 时把 html 映射为 contentHtml；下一次 PUT 时 server 会以 v2 字段写回，
 * 数据自然迁移。无需一次性脚本。
 */
function normalizePage(raw: unknown, index: number): PageData {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    id: typeof r.id === 'string' ? r.id : `page-${index}`,
    title: typeof r.title === 'string' ? r.title : 'Untitled',
    layoutId: typeof r.layoutId === 'string' ? r.layoutId : null,
    contentHtml:
      typeof r.contentHtml === 'string' ? r.contentHtml :
      typeof r.html === 'string' ? r.html : '',
  }
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

    return ((spec.pages ?? []) as unknown[]).map(normalizePage)
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
        required: ['contentHtml'],
        properties: {
          title: { type: 'string' },
          contentHtml: { type: 'string' },
          layoutId: { type: ['string', 'null'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id, pageId } = request.params as { id: string; pageId: string }
    const body = request.body as {
      title?: string
      contentHtml: string
      layoutId?: string | null
    }

    const spec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })

    if (!spec) {
      reply.status(404)
      return { error: 'Project spec not found' }
    }

    // 读老 jsonb 但仅用其 v2 字段做基准；写回时整页用纯 v2 形态，丢弃 v1 残留字段（html/origin/schema/source）。
    const rawPages = (spec.pages ?? []) as unknown[]
    const pages = rawPages.map((p, i) => normalizePage(p, i))
    const pageIndex = pages.findIndex((p) => p.id === pageId)

    if (pageIndex === -1) {
      pages.push({
        id: pageId,
        title: body.title ?? 'Untitled',
        layoutId: body.layoutId ?? null,
        contentHtml: body.contentHtml,
      })
    } else {
      pages[pageIndex] = {
        id: pages[pageIndex].id,
        title: body.title ?? pages[pageIndex].title,
        layoutId: 'layoutId' in body ? (body.layoutId ?? null) : pages[pageIndex].layoutId,
        contentHtml: body.contentHtml,
      }
    }

    const [updated] = await db.update(specs)
      .set({ pages })
      .where(eq(specs.id, spec.id))
      .returning()

    return ((updated.pages ?? []) as unknown[]).map(normalizePage)
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

    const rawPages = (spec.pages ?? []) as unknown[]
    const pages = rawPages.map((p, i) => normalizePage(p, i))
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

    return ((updated.pages ?? []) as unknown[]).map(normalizePage)
  })
}
