import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { specs } from '../db/schema.js'
import { ingestMaterials, type IngestionMaterialInput } from '../services/ingestion.js'

type StoredSpecExtras = {
  rawMaterials?: unknown[]
  normalizedMaterials?: unknown[]
  ingestionJobs?: unknown[]
}

type StoredPage = {
  id: string
  title: string
  html: string
  schema?: unknown
  source?: 'schema' | 'legacy-html'
  renderMode?: 'source-html' | 'schema'
  origin?: unknown
}

export const ingestionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/projects/:id/ingest', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['materials'],
        properties: {
          prompt: { type: 'string' },
          appendPages: { type: 'boolean' },
          materials: {
            type: 'array',
            minItems: 1,
            maxItems: 20,
            items: {
              type: 'object',
              required: ['filename', 'content'],
              properties: {
                filename: { type: 'string', minLength: 1 },
                mimeType: { type: 'string' },
                content: { type: 'string', minLength: 1 },
                intendedUse: { type: 'string', enum: ['page', 'reference', 'requirements', 'asset', 'auto'] },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      prompt?: string
      appendPages?: boolean
      materials: IngestionMaterialInput[]
    }

    const spec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })

    if (!spec) {
      reply.status(404)
      return { error: 'Project spec not found' }
    }

    const ingestion = ingestMaterials({ prompt: body.prompt, materials: body.materials })
    const extras = spec as typeof spec & StoredSpecExtras
    const pages: StoredPage[] = body.appendPages === false
      ? ((spec.pages ?? []) as StoredPage[])
      : [...((spec.pages ?? []) as StoredPage[]), ...ingestion.pages]

    const job = {
      id: randomUUID(),
      status: 'completed',
      plan: ingestion.ingestionPlan,
      conversionReport: ingestion.conversionReport,
      createdAt: new Date().toISOString(),
    }

    const [updated] = await db.update(specs)
      .set({
        pages,
        rawMaterials: [...(extras.rawMaterials ?? []), ...ingestion.rawMaterials],
        normalizedMaterials: [...(extras.normalizedMaterials ?? []), ...ingestion.normalizedMaterials],
        ingestionJobs: [...(extras.ingestionJobs ?? []), job],
        snapshotHtml: pages[0] && typeof pages[0] === 'object' && 'html' in pages[0] ? String(pages[0].html) : spec.snapshotHtml,
      })
      .where(eq(specs.id, spec.id))
      .returning()

    return {
      pages: updated.pages,
      rawMaterials: updated.rawMaterials,
      normalizedMaterials: updated.normalizedMaterials,
      ingestionJobs: updated.ingestionJobs,
      ingestionPlan: ingestion.ingestionPlan,
      conversionReport: ingestion.conversionReport,
    }
  })
}
