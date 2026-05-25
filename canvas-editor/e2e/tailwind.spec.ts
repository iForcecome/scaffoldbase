import { test, expect } from './fixtures'
import type { Page, APIRequestContext } from '@playwright/test'

const TAILWIND_CDN = 'cdn.tailwindcss.com'

async function loadEditor(page: Page, projectId: string, request: APIRequestContext, contentHtml: string) {
  const pageId = 'page-tw'
  await request.put(`/api/projects/${projectId}/pages/${pageId}`, {
    data: { title: 'TW', contentHtml, layoutId: null },
  })
  await page.goto(`/editor/${projectId}`)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__sfTest__?.dispatchTools === 'function', null, { timeout: 10_000 })
  await page.waitForFunction(() => window.__sfTest__!.getActivePageId() !== '', null, { timeout: 5_000 })
}

test.describe('Tailwind 默认生效（iframe 兜底 + 新项目 sharedHead）', () => {
  test('新建项目：sharedHead 默认含 Tailwind Play CDN', async ({ request }) => {
    const res = await request.post('/api/projects', {
      data: { name: 'tw-default', description: 'default sharedHead test' },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json() as { id: string }
    const getRes = await request.get(`/api/projects/${body.id}`)
    const project = await getRes.json() as { sharedHead: string }
    expect(project.sharedHead).toContain(TAILWIND_CDN)
    await request.delete(`/api/projects/${body.id}`)
  })

  test('显式传 sharedHead=""（空字符串）→ 编辑器 iframe 兜底注入 CDN', async ({ page, project, request }) => {
    // 把当前项目 sharedHead 改成空字符串，模拟"老项目无 tailwind"
    await request.patch(`/api/projects/${project.id}`, { data: { sharedHead: '' } })
    const html = `<!DOCTYPE html><html><head></head><body><h1>x</h1></body></html>`
    await loadEditor(page, project.id, request, html)
    // iframe srcDoc 内应能查到 cdn script
    const srcDoc = await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      return iframe.srcdoc
    })
    expect(srcDoc).toContain(TAILWIND_CDN)
  })

  test('iframe 实际渲染：text-3xl 真的应用了 font-size', async ({ page, project, request }) => {
    // 用空 sharedHead 也行——iframe 兜底
    await request.patch(`/api/projects/${project.id}`, { data: { sharedHead: '' } })
    const html = `<!DOCTYPE html><html><head></head><body><h1 class="text-3xl font-bold">Hello</h1></body></html>`
    await loadEditor(page, project.id, request, html)
    // 等 Play CDN 执行完（注入 <style>）
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      const h1 = iframe.contentDocument?.querySelector('h1')
      if (!h1) return false
      const fs = iframe.contentWindow?.getComputedStyle(h1).fontSize
      // text-3xl ≈ 30px。无样式时 h1 浏览器默认约 32px（2em）；
      // tailwind 生效时正好 30px。我们检测 fontSize 等于精确 30px。
      return fs === '30px'
    }, null, { timeout: 10_000 })
  })

  test('sharedHead 自带 tailwind 引用时不重复注入', async ({ page, project, request }) => {
    await request.patch(`/api/projects/${project.id}`, {
      data: { sharedHead: '<script src="https://cdn.tailwindcss.com"></script>' },
    })
    const html = `<!DOCTYPE html><html><head></head><body><h1 class="text-3xl">x</h1></body></html>`
    await loadEditor(page, project.id, request, html)
    const srcDoc = await page.evaluate(() => (document.querySelector('iframe') as HTMLIFrameElement).srcdoc)
    // 只应出现 1 次 cdn.tailwindcss.com
    const occurrences = (srcDoc.match(/cdn\.tailwindcss\.com/g) ?? []).length
    expect(occurrences).toBe(1)
  })
})
