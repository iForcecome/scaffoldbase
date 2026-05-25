import { test, expect } from './fixtures'

// dom_* tools 是 β3 的核心：在浏览器内通过 window.__sfTest__.dispatchTools 直接调
// （main.tsx 在 DEV 下注入）。Tool 改 store.contentHtml；iframe 通过 srcDoc 重渲染。

type ApiPage = { id: string; title: string; layoutId: string | null; contentHtml: string }
type DispatchResult = {
  results: Array<{ ok: boolean; toolName: string; data?: unknown; error?: { code: string; message: string } }>
  appliedEffects: number
  failedCalls: number
}

// 一个含 sf-id 的初始 HTML，让 dom_set_text 能定位
const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><title>dom-test</title></head>
<body data-sf-id="sf-0" data-sf-test="root">
  <h1 data-sf-id="sf-1">原标题</h1>
  <p data-sf-id="sf-2">原段落</p>
  <button data-sf-id="sf-3" class="btn">点我</button>
</body>
</html>`

async function loadEditor(page: import('@playwright/test').Page, projectId: string, request: import('@playwright/test').APIRequestContext, pageId = 'page-dom') {
  await request.put(`/api/projects/${projectId}/pages/${pageId}`, {
    data: { title: 'DOM Test', contentHtml: INITIAL_HTML, layoutId: null },
  })
  await page.goto(`/editor/${projectId}`)
  await page.waitForLoadState('networkidle')
  // 等 window.__sfTest__ 注入
  await page.waitForFunction(() => typeof window.__sfTest__?.dispatchTools === 'function', null, { timeout: 10_000 })
  // 等 store 加载完
  await page.waitForFunction(() => window.__sfTest__!.getActivePageId() !== '', null, { timeout: 5_000 })
  return pageId
}

test.describe('dom_* tools (β3)', () => {
  test('dom_set_text 改 h1 文字 → store + iframe 同步更新', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)

    const result = await page.evaluate<DispatchResult>(async () => {
      return await window.__sfTest__!.dispatchTools([{
        name: 'dom_set_text',
        params: { sfId: 'sf-1', text: 'AI 改过的标题' },
      }])
    })
    expect(result.failedCalls).toBe(0)
    expect(result.appliedEffects).toBe(1)
    expect(result.results[0].ok).toBe(true)

    // store 已变
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('AI 改过的标题')
    expect(html).not.toContain('原标题')

    // iframe 已重渲染（srcDoc 重新合成）
    const iframe = page.frameLocator('iframe[title="Page Preview"]')
    await expect(iframe.locator('h1')).toContainText('AI 改过的标题')
  })

  test('dom_set_attr 改按钮属性', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const result = await page.evaluate<DispatchResult>(async () => {
      return await window.__sfTest__!.dispatchTools([{
        name: 'dom_set_attr',
        params: { sfId: 'sf-3', name: 'aria-label', value: '提交按钮' },
      }])
    })
    expect(result.failedCalls).toBe(0)
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('aria-label="提交按钮"')
  })

  test('dom_add_class + dom_remove_class', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const r1 = await page.evaluate<DispatchResult>(async () => {
      return await window.__sfTest__!.dispatchTools([{
        name: 'dom_add_class',
        params: { sfId: 'sf-3', classNames: ['bg-blue-500', 'text-white'] },
      }])
    })
    expect(r1.failedCalls).toBe(0)
    let html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toMatch(/class="btn bg-blue-500 text-white"/)

    const r2 = await page.evaluate<DispatchResult>(async () => {
      return await window.__sfTest__!.dispatchTools([{
        name: 'dom_remove_class',
        params: { sfId: 'sf-3', classNames: ['btn'] },
      }])
    })
    expect(r2.failedCalls).toBe(0)
    html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toMatch(/class="bg-blue-500 text-white"/)
  })

  test('dom_set_style 改 inline style + 空值删除', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await page.evaluate(async () => {
      await window.__sfTest__!.dispatchTools([
        { name: 'dom_set_style', params: { sfId: 'sf-1', property: 'color', value: 'red' } },
        { name: 'dom_set_style', params: { sfId: 'sf-1', property: 'font-size', value: '32px' } },
      ])
    })
    let html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toMatch(/<h1[^>]*style="[^"]*color:\s*red[^"]*"/)
    expect(html).toMatch(/font-size:\s*32px/)

    // 删 color
    await page.evaluate(async () => {
      await window.__sfTest__!.dispatchTools([
        { name: 'dom_set_style', params: { sfId: 'sf-1', property: 'color', value: '' } },
      ])
    })
    html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).not.toContain('color: red')
    expect(html).toMatch(/font-size:\s*32px/)
  })

  test('dom_insert_html 新元素自动分配 sf-id', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const result = await page.evaluate<DispatchResult>(async () => {
      return await window.__sfTest__!.dispatchTools([{
        name: 'dom_insert_html',
        params: {
          targetSfId: 'sf-3',
          position: 'after',
          html: '<a href="/login" class="btn-link">登录</a>',
        },
      }])
    })
    expect(result.failedCalls).toBe(0)
    const data = result.results[0].data as { affectedIds: string[] }
    expect(data.affectedIds.length).toBeGreaterThan(0)
    // 新 id 不应是 sf-0..sf-3（已有的）
    const newId = data.affectedIds[0]
    expect(['sf-0', 'sf-1', 'sf-2', 'sf-3']).not.toContain(newId)

    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('href="/login"')
    // 新分配的 sf-id 应出现在 contentHtml 中（具体 attr 顺序由 serializer 决定）
    expect(html).toContain(`data-sf-id="${newId}"`)
  })

  test('dom_delete 移除元素', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await page.evaluate(async () => {
      await window.__sfTest__!.dispatchTools([
        { name: 'dom_delete', params: { sfId: 'sf-2' } },
      ])
    })
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).not.toContain('原段落')
    expect(html).not.toContain('data-sf-id="sf-2"')
  })

  test('dom_delete body 被拒绝（保护根元素）', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const result = await page.evaluate<DispatchResult>(async () => {
      return await window.__sfTest__!.dispatchTools([
        { name: 'dom_delete', params: { sfId: 'sf-0' } }, // body
      ])
    })
    expect(result.failedCalls).toBe(1)
    expect(result.results[0].error?.code).toBe('cannot_delete_root')
  })

  test('dom_set_text on 不存在的 sfId 失败 + 不污染 contentHtml', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const result = await page.evaluate<DispatchResult>(async () => {
      return await window.__sfTest__!.dispatchTools([
        { name: 'dom_set_text', params: { sfId: 'sf-9999', text: 'x' } },
      ])
    })
    expect(result.failedCalls).toBe(1)
    expect(result.results[0].error?.code).toBe('target_not_found')

    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    // 没误伤
    expect(html).toContain('原标题')
  })

  test('改了内容后 PUT 保存：纯 v2 字段、sf-id 持久化', async ({ page, project, request }) => {
    const pageId = await loadEditor(page, project.id, request, `page-save-${Date.now()}`)

    await page.evaluate(async () => {
      await window.__sfTest__!.dispatchTools([
        { name: 'dom_set_text', params: { sfId: 'sf-1', text: '保存验证' } },
      ])
    })

    // 触发 store.save
    const saveBtn = page.locator('button:has-text("保存")').first()
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click()
    }
    await page.waitForTimeout(1200)

    const list = (await (await request.get(`/api/projects/${project.id}/pages`)).json()) as ApiPage[]
    const saved = list.find(p => p.id === pageId)
    expect(saved).toBeDefined()
    expect(saved!.contentHtml).toContain('保存验证')
    expect(saved!.contentHtml).toContain('data-sf-id="sf-1"')
    // 字段纯 v2
    const v1Keys = ['html', 'origin', 'schema', 'source'].filter(k => k in (saved as unknown as Record<string, unknown>))
    expect(v1Keys).toEqual([])
  })

  test('改完可 undo 还原', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)

    await page.evaluate(async () => {
      await window.__sfTest__!.dispatchTools([
        { name: 'dom_set_text', params: { sfId: 'sf-1', text: '改了' } },
      ])
    })
    let html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('改了')

    await page.evaluate(async () => {
      await window.__sfTest__!.dispatchTools([{ name: 'history_undo', params: {} }])
    })
    html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('原标题')
    expect(html).not.toContain('改了')
  })
})
