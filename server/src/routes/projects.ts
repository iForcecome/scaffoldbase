import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/client.js'
import { projects, specs } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.post('/projects', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          qualityPreset: { type: 'string', enum: ['mvp', 'production', 'enterprise'] },
          baasProvider: { type: 'string', enum: ['supabase', 'pocketbase', 'none'] },
          designTokenId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      description?: string
      qualityPreset?: 'mvp' | 'production' | 'enterprise'
      baasProvider?: 'supabase' | 'pocketbase' | 'none'
      designTokenId?: string
    }

    const [project] = await db.insert(projects).values({
      name: body.name,
      description: body.description ?? '',
      qualityPreset: body.qualityPreset ?? 'mvp',
      baasProvider: body.baasProvider ?? 'none',
      designTokenId: body.designTokenId,
    }).returning()

    await db.insert(specs).values({
      projectId: project.id,
      version: 1,
      pages: [],
    })

    reply.status(201)
    return project
  })

  app.get('/projects', async () => {
    return db.select().from(projects).orderBy(desc(projects.updatedAt))
  })

  app.get('/projects/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })
    if (!project) {
      reply.status(404)
      return { error: 'Project not found' }
    }

    const latestSpec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })

    return { ...project, spec: latestSpec ?? null }
  })

  app.delete('/projects/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const [deleted] = await db.delete(projects)
      .where(eq(projects.id, id))
      .returning()

    if (!deleted) {
      reply.status(404)
      return { error: 'Project not found' }
    }

    return { success: true }
  })

  app.patch('/projects/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          qualityPreset: { type: 'string', enum: ['mvp', 'production', 'enterprise'] },
          baasProvider: { type: 'string', enum: ['supabase', 'pocketbase', 'none'] },
          status: { type: 'string', enum: ['draft', 'ready', 'exported', 'synced'] },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Record<string, unknown>

    const [updated] = await db.update(projects)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning()

    if (!updated) {
      reply.status(404)
      return { error: 'Project not found' }
    }

    return updated
  })
}
