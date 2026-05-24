import { test, expect } from './fixtures'

type ApiProject = { id: string; name: string; sharedHead: string }
type ApiPage = { id: string; title: string; layoutId: string | null; contentHtml: string }

test.describe('API smoke', () => {
  test('health 200', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('projects list 含 sharedHead 字段', async ({ request, project }) => {
    const res = await request.get('/api/projects')
    expect(res.ok()).toBeTruthy()
    const projects = (await res.json()) as ApiProject[]
    const created = projects.find(p => p.id === project.id)
    expect(created).toBeDefined()
    expect(created.sharedHead).toBeDefined()
    expect(typeof created.sharedHead).toBe('string')
  })

  test('project create 返回 v2 字段', async ({ project }) => {
    expect(project.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(typeof project.sharedHead).toBe('string')
  })

  test('PATCH sharedHead 持久化', async ({ request, project }) => {
    const sharedHead = '<script src="https://cdn.tailwindcss.com"></script>'
    const patch = await request.patch(`/api/projects/${project.id}`, {
      data: { sharedHead },
    })
    expect(patch.ok()).toBeTruthy()
    const after = (await patch.json()).sharedHead
    expect(after).toBe(sharedHead)

    const getRes = await request.get(`/api/projects/${project.id}`)
    expect((await getRes.json()).sharedHead).toBe(sharedHead)
  })

  test('pages list 返回纯 v2 形态', async ({ request, project }) => {
    // 新项目 0 页，先用 PUT 创建一页（pageId 由前端生成约定）
    const pageId = `page-test-${Date.now()}`
    const contentHtml = '<!DOCTYPE html><html><body><h1>created by api test</h1></body></html>'
    const put = await request.put(`/api/projects/${project.id}/pages/${pageId}`, {
      data: { title: 'Test page', contentHtml, layoutId: null },
    })
    expect(put.ok()).toBeTruthy()

    const list = await request.get(`/api/projects/${project.id}/pages`)
    const pages = (await list.json()) as ApiPage[]
    const page = pages.find(p => p.id === pageId) as ApiPage
    expect(page).toBeDefined()
    expect(Object.keys(page).sort()).toEqual(['contentHtml', 'id', 'layoutId', 'title'])
    expect(page.title).toBe('Test page')
    expect(page.contentHtml).toBe(contentHtml)
    expect(page.layoutId).toBe(null)
  })

  test('PUT page 写回后无 v1 残留字段', async ({ request, project }) => {
    const pageId = `page-clean-${Date.now()}`
    // 第一次 PUT 创建
    await request.put(`/api/projects/${project.id}/pages/${pageId}`, {
      data: { title: 'first', contentHtml: '<html></html>', layoutId: null },
    })
    // 第二次 PUT 更新
    const second = await request.put(`/api/projects/${project.id}/pages/${pageId}`, {
      data: { title: 'second', contentHtml: '<html><body>v2</body></html>', layoutId: null },
    })
    const pages = (await second.json()) as ApiPage[]
    const page = pages.find(p => p.id === pageId) as ApiPage & Record<string, unknown>
    expect(page).toBeDefined()
    expect(page.title).toBe('second')
    // 关键：不能有 v1 残留字段
    const v1Keys = ['html', 'origin', 'schema', 'source'].filter(k => k in page)
    expect(v1Keys).toEqual([])
  })

  test('ingestion 上传 HTML 派生页面', async ({ request, project }) => {
    const res = await request.post(`/api/projects/${project.id}/ingest`, {
      data: {
        materials: [
          {
            filename: 'sample.html',
            content: '<!DOCTYPE html><html><head><title>Ingest Sample Page</title></head><body><h1>hi</h1></body></html>',
          },
        ],
      },
    })
    expect(res.ok()).toBeTruthy()
    const { pages } = await res.json()
    expect(pages.length).toBe(1)
    const p = pages[0]
    expect(Object.keys(p).sort()).toEqual(['contentHtml', 'id', 'layoutId', 'title'])
    expect(p.title).toBe('Ingest Sample Page')
    expect(p.contentHtml).toContain('<h1>hi</h1>')
  })

  test('agent SSE：连上后立刻收到 run_started 事件', async ({ project }) => {
    // 直连 fastify（绕 vite 代理，避免 SSE buffer 行为差异），手动读流后 abort
    const ctrl = new AbortController()
    const resp = await fetch(`http://localhost:3001/api/projects/${project.id}/agent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
      signal: ctrl.signal,
    })
    expect(resp.status).toBe(200)
    expect(resp.headers.get('content-type') || '').toContain('text/event-stream')

    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    const deadline = Date.now() + 8_000
    try {
      while (Date.now() < deadline) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        if (buf.includes('run_started')) break
      }
    } finally {
      ctrl.abort()
    }
    expect(buf).toContain('"type":"run_started"')
  })
})
