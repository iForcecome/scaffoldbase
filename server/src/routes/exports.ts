import type { FastifyPluginAsync } from 'fastify'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { exports as projectExports, projects, specs, designTokens } from '../db/schema.js'
import { buildHtmlPrdExport, buildSpecJsonExport, type ExportType } from '../services/export.js'

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects/:id/exports/:type', {
    schema: {
      params: {
        type: 'object',
        required: ['id', 'type'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          type: { type: 'string', enum: ['spec_json', 'html_prd'] },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['page', 'project'] },
          pageId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id, type } = request.params as { id: string; type: ExportType }
    const query = request.query as { scope?: 'page' | 'project'; pageId?: string }
    const scope = query.scope ?? 'project'
    const pageId = query.pageId ?? null

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })
    if (!project) {
      reply.status(404)
      return { error: 'Project not found' }
    }

    const spec = await db.query.specs.findFirst({
      where: eq(specs.projectId, id),
      orderBy: desc(specs.version),
    })
    if (!spec) {
      reply.status(404)
      return { error: 'Project spec not found' }
    }

    const tokens = await db.select().from(designTokens).orderBy(designTokens.category)
    const generatedAt = new Date().toISOString()

    await db.insert(projectExports).values({
      projectId: id,
      type,
      specVersion: spec.version,
      fileUrl: null,
    })

    if (type === 'spec_json') {
      reply.header('content-disposition', `attachment; filename="${project.name}-spec.json"`)
      reply.type('application/json; charset=utf-8')
      return buildSpecJsonExport(project, spec, tokens, generatedAt, scope, pageId)
    }

    reply.header('content-disposition', `attachment; filename="${project.name}-html-prd.html"`)
    reply.type('text/html; charset=utf-8')
    return buildHtmlPrdExport(project, spec, tokens, generatedAt, scope, pageId)
  })
}
