import type { FastifyPluginAsync } from 'fastify'
import { db } from '../db/client.js'
import { designTokens } from '../db/schema.js'

export const designTokenRoutes: FastifyPluginAsync = async (app) => {
  app.get('/design-tokens', async () => {
    return db.select().from(designTokens)
  })

  app.get('/design-tokens/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const token = await db.query.designTokens.findFirst({
      where: (t, { eq }) => eq(t.id, id),
    })

    if (!token) {
      reply.status(404)
      return { error: 'Design token not found' }
    }

    return token
  })
}
