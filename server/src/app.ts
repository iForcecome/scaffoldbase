import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { projectRoutes } from './routes/projects.js'
import { pageRoutes } from './routes/pages.js'
import { agentRoutes } from './routes/agent.js'
import { ingestionRoutes } from './routes/ingestion.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: true })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'SpecFlow API',
        version: '0.2.0',
        description: 'SpecFlow backend API (v2 HTML-as-truth)',
      },
    },
  })

  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(projectRoutes, { prefix: '/api' })
  await app.register(pageRoutes, { prefix: '/api' })
  await app.register(agentRoutes, { prefix: '/api' })
  await app.register(ingestionRoutes, { prefix: '/api' })

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  return app
}
