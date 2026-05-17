import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { db } from '../db/client.js'
import { projects, specs } from '../db/schema.js'
import { eq, desc } from 'drizzle-orm'
import { completeChat } from '../services/ai.js'
import { ingestMaterials, type IngestionMaterialInput } from '../services/ingestion.js'

function fallbackMeta(prompt: string): { name: string; description: string } {
  const trimmed = prompt.trim()
  const firstLine = trimmed.split(/[\n。.!?！？]/)[0]?.trim() ?? trimmed
  const name = firstLine.length > 20 ? firstLine.slice(0, 20) + '...' : firstLine || '未命名项目'
  const description = trimmed.length > 120 ? trimmed.slice(0, 120) + '...' : trimmed
  return { name, description }
}

async function deriveMetaFromPrompt(prompt: string): Promise<{ name: string; description: string }> {
  try {
    const raw = await completeChat([
      {
        role: 'system',
        content: `你是 SpecFlow 的项目命名助手。用户会给你一段产品需求描述。
你要返回一个 JSON：{"name":"...", "description":"..."}
- name: 3-10 字的简短中文项目名，提炼核心产品类型（例："电商后台管理系统"、"健身打卡 App"）
- description: 一句话产品描述，20-40 字，概括产品功能与目标用户
只返回 JSON，不要解释，不要 Markdown。`,
      },
      { role: 'user', content: prompt },
    ], { temperature: 0.4 })

    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('no json')
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { name?: unknown; description?: unknown }
    const name = typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 30) : null
    const description = typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 200) : null
    if (!name) throw new Error('no name')
    return { name, description: description ?? '' }
  } catch {
    return fallbackMeta(prompt)
  }
}

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.post('/projects/derive-meta', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: { prompt: { type: 'string', minLength: 1, maxLength: 4000 } },
      },
    },
  }, async (request) => {
    const { prompt } = request.body as { prompt: string }
    return deriveMetaFromPrompt(prompt)
  })


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
          ingestionMaterials: {
            type: 'array',
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
    const body = request.body as {
      name: string
      description?: string
      qualityPreset?: 'mvp' | 'production' | 'enterprise'
      baasProvider?: 'supabase' | 'pocketbase' | 'none'
      designTokenId?: string
      ingestionMaterials?: IngestionMaterialInput[]
    }

    const [project] = await db.insert(projects).values({
      name: body.name,
      description: body.description ?? '',
      qualityPreset: body.qualityPreset ?? 'mvp',
      baasProvider: body.baasProvider ?? 'none',
      designTokenId: body.designTokenId,
    }).returning()

    const ingestion = body.ingestionMaterials?.length
      ? ingestMaterials({ prompt: body.description, materials: body.ingestionMaterials })
      : null

    await db.insert(specs).values({
      projectId: project.id,
      version: 1,
      pages: ingestion?.pages ?? [],
      rawMaterials: ingestion?.rawMaterials ?? [],
      normalizedMaterials: ingestion?.normalizedMaterials ?? [],
      ingestionJobs: ingestion ? [{
        id: randomUUID(),
        status: 'completed',
        plan: ingestion.ingestionPlan,
        conversionReport: ingestion.conversionReport,
        createdAt: new Date().toISOString(),
      }] : [],
      snapshotHtml: ingestion?.pages[0]?.html,
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
