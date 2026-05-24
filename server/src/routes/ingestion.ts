import type { FastifyPluginAsync } from 'fastify'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { specs, type PageData } from '../db/schema.js'
import { ingestMaterials, type IngestionMaterialInput } from '../services/ingestion.js'

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
    const existingPages = (spec.pages ?? []) as PageData[]
    const pages: PageData[] = body.appendPages === false
      ? existingPages
      : [...existingPages, ...ingestion.pages]

    const [updated] = await db.update(specs)
      .set({ pages })
      .where(eq(specs.id, spec.id))
      .returning()

    return { pages: updated.pages }
  })
}
