import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { projectRoutes } from './routes/projects.js'
import { pageRoutes } from './routes/pages.js'
import { chatRoutes } from './routes/chat.js'
import { agentRoutes } from './routes/agent.js'
import { designTokenRoutes } from './routes/design-tokens.js'
import { exportRoutes } from './routes/exports.js'
import { ingestionRoutes } from './routes/ingestion.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SpecFlow API',
        version: '0.1.0',
        description: 'SpecFlow backend API',
      },
    },
  })

  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(projectRoutes, { prefix: '/api' })
  await app.register(pageRoutes, { prefix: '/api' })
  await app.register(chatRoutes, { prefix: '/api' })
  await app.register(agentRoutes, { prefix: '/api' })
  await app.register(designTokenRoutes, { prefix: '/api' })
  await app.register(exportRoutes, { prefix: '/api' })
  await app.register(ingestionRoutes, { prefix: '/api' })

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
