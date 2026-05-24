/* eslint-disable react-hooks/rules-of-hooks -- `use` here is playwright fixture API, not a React Hook */
import { test as base, type APIRequestContext } from '@playwright/test'

export type TestProject = {
  id: string
  name: string
  sharedHead: string
}

async function createTestProject(request: APIRequestContext, name: string): Promise<TestProject> {
  const res = await request.post('/api/projects', {
    data: {
      name,
      description: 'created by playwright',
      sharedHead: '',
    },
  })
  if (!res.ok()) throw new Error(`createTestProject failed ${res.status()}: ${await res.text()}`)
  const p = await res.json()
  return { id: p.id, name: p.name, sharedHead: p.sharedHead }
}

async function deleteProject(request: APIRequestContext, id: string) {
  await request.delete(`/api/projects/${id}`)
}

export const test = base.extend<{ project: TestProject }>({
  project: async ({ request }, use) => {
    const name = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const project = await createTestProject(request, name)
    try {
      await use(project)
    } finally {
      await deleteProject(request, project.id)
    }
  },
})

export { expect } from '@playwright/test'
