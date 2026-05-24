import { test, expect } from './fixtures'

type ApiPage = { id: string; title: string; layoutId: string | null; contentHtml: string }

test.describe('Editor E2E (browser)', () => {
  test('ProjectList 渲染、能看到测试项目', async ({ page, project }) => {
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 页面 hero 出现
    await expect(page.locator('text=SpecFlow').first()).toBeVisible()
    // 我们刚创建的项目应在列表里
    await expect(page.locator(`text=${project.name}`)).toBeVisible({ timeout: 10_000 })

    expect(errors, `pageerror: ${errors.join(' | ')}`).toEqual([])
  })

  test('打开 EditorPage：TopBar/LeftPanel/Canvas iframe/RightPanel 都渲染', async ({ page, project, request }) => {
    // 先给项目创建一页
    await request.put(`/api/projects/${project.id}/pages/page-e2e`, {
      data: {
        title: 'E2E First',
        contentHtml: '<!DOCTYPE html><html><head><title>E2E</title></head><body data-sf-test="root"><h1>hello E2E</h1></body></html>',
        layoutId: null,
      },
    })

    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))

    await page.goto(`/editor/${project.id}`)
    await expect(page.locator('iframe[title="Page Preview"]')).toBeVisible({ timeout: 15_000 })

    // LeftPanel 里页面标题
    await expect(page.locator('text=E2E First').first()).toBeVisible()

    // RightPanel 唯一可见 input 必然是「页面标题」（无选中时只渲染 PagePropertiesSection）
    const rightPanel = page.locator('aside').last()
    const titleInput = rightPanel.locator('input:visible').first()
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toHaveValue('E2E First')

    // iframe 内 h1 应出现
    const iframe = page.frameLocator('iframe[title="Page Preview"]')
    await expect(iframe.locator('h1')).toContainText('hello E2E')

    expect(errors, `pageerror: ${errors.join(' | ')}`).toEqual([])
  })

  test('编辑器：改 sharedHead 后 iframe 内能看到注入内容', async ({ page, project, request }) => {
    // 必须包含 </head> 让 sharedHead 注入能命中替换点
    await request.put(`/api/projects/${project.id}/pages/page-sh`, {
      data: {
        title: 'SH',
        contentHtml: '<!DOCTYPE html><html><head></head><body><h2>sh-body</h2></body></html>',
        layoutId: null,
      },
    })

    await page.goto(`/editor/${project.id}`)
    await page.waitForLoadState('networkidle')

    const rightPanel = page.locator('aside').last()
    const textarea = rightPanel.locator('textarea[placeholder*="tailwindcss"]')
    await expect(textarea).toBeVisible({ timeout: 10_000 })

    const marker = `e2e-mark-${Date.now()}`
    await textarea.fill(`<meta name="${marker}" content="ok">`)
    await textarea.blur()

    // sharedHead 改完会触发 effect 重 inject srcDoc
    const iframe = page.frameLocator('iframe[title="Page Preview"]')
    await expect(iframe.locator(`meta[name="${marker}"]`)).toBeAttached({ timeout: 5_000 })
  })

  test('编辑器：改页面标题后 PUT 持久化 + 字段纯 v2', async ({ page, project, request }) => {
    const pageId = `page-rename-${Date.now()}`
    await request.put(`/api/projects/${project.id}/pages/${pageId}`, {
      data: {
        title: 'before',
        contentHtml: '<!DOCTYPE html><html><head></head><body></body></html>',
        layoutId: null,
      },
    })

    await page.goto(`/editor/${project.id}`)
    await page.waitForLoadState('networkidle')

    const rightPanel = page.locator('aside').last()
    const titleInput = rightPanel.locator('input:visible').first()
    await expect(titleInput).toBeVisible({ timeout: 10_000 })

    const newTitle = `after-${Date.now()}`
    await titleInput.fill(newTitle)
    await titleInput.blur()

    // 等待自动保存（editor-store 中 renamePage 后 debounced save）；
    // 兜底点 TopBar 的「保存」按钮
    const saveBtn = page.locator('button:has-text("保存")').first()
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click()
    }
    await page.waitForTimeout(1500)

    // 通过 API 验证持久化 + v2 字段纯净
    await expect.poll(async () => {
      const res = await request.get(`/api/projects/${project.id}/pages`)
      const pages = (await res.json()) as ApiPage[]
      return pages.find(p => p.id === pageId)?.title
    }, { timeout: 8_000 }).toBe(newTitle)

    const final = (await (await request.get(`/api/projects/${project.id}/pages`)).json()) as ApiPage[]
    const target = final.find(p => p.id === pageId) as ApiPage & Record<string, unknown>
    const v1Keys = ['html', 'origin', 'schema', 'source'].filter(k => k in target)
    expect(v1Keys).toEqual([])
  })
})
