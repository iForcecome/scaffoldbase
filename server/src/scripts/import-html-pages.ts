import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { projects, specs } from '../db/schema.js'

type Page = { id: string; title: string; html: string; schema?: unknown }

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')

const imports = [
  { id: 'page-canvas', title: '画布设计稿', filename: '画布设计稿.html' },
  { id: 'page-product', title: '产品设计稿', filename: '产品设计稿.html' },
  { id: 'page-prd', title: 'SpecFlow PRD', filename: 'SpecFlow-PRD.html' },
]

function usage() {
  console.log(`Usage:
  pnpm --filter server import:html -- <project-id> [--write]

Examples:
  pnpm --filter server import:html -- dad81863-483b-431b-aff0-69fb78dda3dd
  pnpm --filter server import:html -- dad81863-483b-431b-aff0-69fb78dda3dd --write
`)
}

function readPages(): Page[] {
  return imports.map(item => {
    const path = resolve(repoRoot, item.filename)
    if (!existsSync(path)) {
      throw new Error(`Missing HTML file: ${path}`)
    }
    return {
      id: item.id,
      title: item.title,
      html: readFileSync(path, 'utf8'),
    }
  })
}

async function main() {
  const args = process.argv.slice(2).filter(arg => arg !== '--')
  const projectId = args.find(arg => !arg.startsWith('--'))
  const write = args.includes('--write')

  if (!projectId) {
    usage()
    process.exit(1)
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })

  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const latestSpec = await db.query.specs.findFirst({
    where: eq(specs.projectId, projectId),
    orderBy: desc(specs.version),
  })

  if (!latestSpec) {
    throw new Error(`Project spec not found: ${projectId}`)
  }

  const pages = readPages()

  console.log(`${write ? 'Replacing' : 'Dry run for'} project: ${project.name} (${projectId})`)
  console.log(`Spec version: ${latestSpec.version}`)
  console.log('Pages:')
  for (const page of pages) {
    console.log(`- ${page.id}: ${page.title} (${Math.round(page.html.length / 1024)} KB)`)
  }

  if (!write) {
    console.log('\nNo database changes were made. Re-run with --write to replace pages.')
    process.exit(0)
  }

  await db.update(specs)
    .set({
      pages,
      snapshotHtml: pages[0]?.html ?? null,
    })
    .where(eq(specs.id, latestSpec.id))

  await db.update(projects)
    .set({
      status: 'draft',
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))

  console.log('\nDone. The project pages were replaced.')
  process.exit(0)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
