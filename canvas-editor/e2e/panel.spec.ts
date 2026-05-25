import { test, expect } from './fixtures'
import type { Locator, Page, APIRequestContext } from '@playwright/test'

// β6 右栏属性面板：点选元素 → ElementInspector 出现 → 通过 UI（不通过 chat）
// 直接改文字/class/style/attr → contentHtml 同步、iframe 重渲染。

const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><title>panel-test</title></head>
<body data-sf-id="sf-0">
  <h1 data-sf-id="sf-1" class="title">原标题</h1>
  <p data-sf-id="sf-2">段落</p>
  <button data-sf-id="sf-3" class="btn primary">点我</button>
</body>
</html>`

async function loadEditor(page: Page, projectId: string, request: APIRequestContext) {
  const pageId = 'page-panel'
  await request.put(`/api/projects/${projectId}/pages/${pageId}`, {
    data: { title: 'Panel', contentHtml: INITIAL_HTML, layoutId: null },
  })
  await page.goto(`/editor/${projectId}`)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__sfTest__?.dispatchTools === 'function', null, { timeout: 10_000 })
  await page.waitForFunction(() => window.__sfTest__!.getActivePageId() !== '', null, { timeout: 5_000 })
  return pageId
}

// 通过 selection_set tool 选中元素 —— 比 hover+click iframe 稳定得多
async function selectElement(page: Page, sfId: string) {
  await page.evaluate(async (id) => {
    await window.__sfTest__!.dispatchTools([{ name: 'selection_set', params: { nodeIds: [id] } }])
  }, sfId)
  // 等右栏 Inspector 出现
  await expect(page.getByTestId('element-inspector')).toBeVisible({ timeout: 5_000 })
}

function inspector(page: Page): Locator {
  return page.getByTestId('element-inspector')
}

test.describe('β6 ElementInspector', () => {
  test('选中元素后顶部显示 tag + sfId', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-1')
    const i = inspector(page)
    await expect(i).toContainText('<h1>')
    await expect(i).toContainText('sf-1')
  })

  test('Content：纯文本元素能改 textContent', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-1')
    const textarea = inspector(page).locator('textarea')
    await expect(textarea).toHaveValue('原标题')
    await textarea.fill('改过的标题')
    await textarea.blur()
    await page.waitForTimeout(200)
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('改过的标题')
    expect(html).not.toContain('原标题')
  })

  test('Content：非叶子元素提示不可编辑', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-0') // body
    const i = inspector(page)
    await expect(i).toContainText('非纯文本元素')
    await expect(i.locator('textarea')).toHaveCount(0)
  })

  test('Class：删 chip 后 contentHtml 同步', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-3')
    // 初始 class chip：btn + primary
    await expect(inspector(page).getByText('btn', { exact: true })).toBeVisible()
    await expect(inspector(page).getByText('primary', { exact: true })).toBeVisible()

    // 点 btn 后的 × 删
    const btnChip = inspector(page).locator('span:has-text("btn") button[aria-label*="btn"]').first()
    await btnChip.click()
    await page.waitForTimeout(200)

    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toMatch(/data-sf-id="sf-3"[^>]*class="primary"/)
  })

  test('Class：输入框加 class', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-1')
    const input = inspector(page).locator('input[placeholder*="class"]')
    await input.fill('text-2xl font-bold')
    await input.press('Enter')
    await page.waitForTimeout(200)
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toMatch(/data-sf-id="sf-1"[^>]*class="title text-2xl font-bold"/)
    // 输入框 reset
    await expect(input).toHaveValue('')
  })

  test('Style：改 color + 留空删 color', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-1')
    const colorInput = inspector(page).locator('input[placeholder*="#222"]')
    await colorInput.fill('red')
    await colorInput.blur()
    await page.waitForTimeout(200)
    let html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toMatch(/<h1[^>]*style="[^"]*color:\s*red/)

    // 留空 → 删
    await colorInput.fill('')
    await colorInput.blur()
    await page.waitForTimeout(200)
    html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).not.toMatch(/color:\s*red/)
  })

  test('Attr：展开后改 class 之外的属性 + 添加新 attr', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-3')
    // 默认折叠，点开
    const i = inspector(page)
    await i.getByRole('button', { name: /属性/ }).click()

    // 添加 type=button
    const nameInput = i.locator('input[placeholder="name"]')
    const valueInput = i.locator('input[placeholder="value"]')
    await nameInput.fill('type')
    await valueInput.fill('button')
    await i.getByRole('button', { name: '加' }).click()
    await page.waitForTimeout(200)

    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toMatch(/<button[^>]*type="button"/)
  })

  test('iframe 同步：UI 改完文字后 iframe 内 h1 内容更新', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await selectElement(page, 'sf-1')
    const textarea = inspector(page).locator('textarea')
    await textarea.fill('从面板改的')
    await textarea.blur()

    const frame = page.frameLocator('iframe[title="Page Preview"]')
    await expect(frame.locator('h1')).toContainText('从面板改的')
  })

  test('未选中时显示 PagePropertiesSection（页面标题输入框）', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    // 不调 selection_set
    const rightPanel = page.locator('aside').last()
    await expect(rightPanel.locator('input').first()).toHaveValue('Panel')
    // Inspector 不应出现
    await expect(page.getByTestId('element-inspector')).toHaveCount(0)
  })
})
