import { buildApp } from './app.js'
import { env } from './env.js'

async function main() {
  const app = await buildApp()

  await app.listen({ port: env.PORT, host: env.HOST })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
