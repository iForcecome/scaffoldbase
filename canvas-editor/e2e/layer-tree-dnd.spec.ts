import { test, expect } from './fixtures'
import type { Page, APIRequestContext } from '@playwright/test'

const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><title>dnd-test</title></head>
<body data-sf-id="sf-0">
  <header data-sf-id="sf-1">
    <h1 data-sf-id="sf-2">Title</h1>
    <button data-sf-id="sf-3">Action</button>
  </header>
  <main data-sf-id="sf-4">
    <p data-sf-id="sf-5">P1</p>
    <p data-sf-id="sf-6">P2</p>
  </main>
</body>
</html>`

async function loadEditor(page: Page, projectId: string, request: APIRequestContext) {
  const pageId = 'page-dnd'
  await request.put(`/api/projects/${projectId}/pages/${pageId}`, {
    data: { title: 'DnD', contentHtml: INITIAL_HTML, layoutId: null },
  })
  await page.goto(`/editor/${projectId}`)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__sfTest__?.dispatchTools === 'function', null, { timeout: 10_000 })
  await page.waitForFunction(() => window.__sfTest__!.getActivePageId() !== '', null, { timeout: 5_000 })
}

/**
 * 把源节点拖到目标节点的指定位置：
 * - position='before' → 鼠标落在目标行顶 (10%)
 * - position='after'  → 落在底部 (90%)
 * - position='append' → 落在中部 (50%)
 *
 * Playwright 没暴露 dispatchEvent 的便利 API，这里用 page.evaluate 手动构造
 * DragEvent 串：dragstart on source → dragover on target (带坐标) → drop on target → dragend
 */
async function dragNode(
  page: Page,
  sourceSfId: string,
  targetSfId: string,
  position: 'before' | 'after' | 'append',
) {
  await page.evaluate(({ sourceSfId, targetSfId, position }) => {
    const tree = document.querySelector('[data-testid="layer-tree"]')!
    const source = tree.querySelector(`[data-tree-sfid="${sourceSfId}"]`) as HTMLElement
    const target = tree.querySelector(`[data-tree-sfid="${targetSfId}"]`) as HTMLElement
    if (!source || !target) throw new Error('source/target row not found')
    const rect = target.getBoundingClientRect()
    const ratio = position === 'before' ? 0.1 : position === 'after' ? 0.9 : 0.5
    const clientY = rect.top + rect.height * ratio
    const clientX = rect.left + rect.width / 2

    const dt = new DataTransfer()
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt, clientX, clientY }))
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX, clientY }))
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX, clientY }))
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, { sourceSfId, targetSfId, position })
  await page.waitForTimeout(150)
}

test.describe('β8 LayerTree DnD', () => {
  test('工具层：dom_move sf-5 after sf-6 → P1 在 P2 之后', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await page.evaluate(() => window.__sfTest__!.dispatchTools([
      { name: 'dom_move', params: { sourceSfId: 'sf-5', targetSfId: 'sf-6', position: 'after' } },
    ]))
    await page.waitForTimeout(100)
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    // sf-5 现在出现在 sf-6 之后
    const i5 = html!.indexOf('data-sf-id="sf-5"')
    const i6 = html!.indexOf('data-sf-id="sf-6"')
    expect(i6).toBeGreaterThan(0)
    expect(i5).toBeGreaterThan(i6)
  })

  test('工具层：dom_move 到自身后代 → 报错且 contentHtml 不变', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const before = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    // header (sf-1) 移到自己的子 h1 (sf-2) 里 → 应被拒
    const result = await page.evaluate(() => window.__sfTest__!.dispatchTools([
      { name: 'dom_move', params: { sourceSfId: 'sf-1', targetSfId: 'sf-2', position: 'append' } },
    ]))
    await page.waitForTimeout(100)
    const after = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(after).toBe(before)
    expect(JSON.stringify(result)).toMatch(/target_is_descendant|same_node/)
  })

  test('工具层：dom_move body → 报错', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const result = await page.evaluate(() => window.__sfTest__!.dispatchTools([
      { name: 'dom_move', params: { sourceSfId: 'sf-0', targetSfId: 'sf-4', position: 'after' } },
    ]))
    expect(JSON.stringify(result)).toMatch(/cannot_move_root/)
  })

  test('工具层：dom_move 进入 undo 栈，Cmd+Z 复原', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await page.evaluate(() => window.__sfTest__!.dispatchTools([
      { name: 'dom_move', params: { sourceSfId: 'sf-5', targetSfId: 'sf-3', position: 'after' } },
    ]))
    await page.waitForTimeout(100)
    let html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html!.indexOf('data-sf-id="sf-5"')).toBeGreaterThan(html!.indexOf('data-sf-id="sf-3"'))
    // 撤销
    await page.evaluate(() => window.__sfTest__!.dispatchTools([{ name: 'history_undo', params: {} }]))
    await page.waitForTimeout(100)
    html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    const i3 = html!.indexOf('data-sf-id="sf-3"')
    const i5 = html!.indexOf('data-sf-id="sf-5"')
    const i6 = html!.indexOf('data-sf-id="sf-6"')
    // 原序：sf-3 在 header 里，sf-5/6 在 main 里，文档顺序 sf-3 < sf-5 < sf-6
    expect(i3).toBeLessThan(i5)
    expect(i5).toBeLessThan(i6)
  })

  test('UI 拖拽：sf-5 拖到 sf-6 之后', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await dragNode(page, 'sf-5', 'sf-6', 'after')
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html!.indexOf('data-sf-id="sf-5"')).toBeGreaterThan(html!.indexOf('data-sf-id="sf-6"'))
  })

  test('UI 拖拽：sf-3 拖到 sf-4（main）内末 → 跨父移动', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await dragNode(page, 'sf-3', 'sf-4', 'append')
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    // button(sf-3) 现在在 main 内最后
    // 验证：sf-3 出现在 sf-4 之后（即 main 开标签之后）+ 在 main 闭标签之前
    // 简化：sf-3 出现位置在 sf-6 之后（main 里 sf-5, sf-6 是 main 原有的两个 p，sf-3 append 进去在它们之后）
    const i3 = html!.indexOf('data-sf-id="sf-3"')
    const i6 = html!.indexOf('data-sf-id="sf-6"')
    expect(i3).toBeGreaterThan(i6)
    // header 里不再有 sf-3
    const headerSection = html!.slice(html!.indexOf('data-sf-id="sf-1"'), html!.indexOf('</header>'))
    expect(headerSection).not.toContain('data-sf-id="sf-3"')
  })

  test('UI 拖拽：拖自己 → 不变', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const before = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    await dragNode(page, 'sf-5', 'sf-5', 'after')
    const after = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(after).toBe(before)
  })

  test('UI 拖拽：拖到自身后代 → onDragOver preventDefault 被跳过，drop 也不触发 dom_move', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const before = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    await dragNode(page, 'sf-1', 'sf-2', 'append')
    const after = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(after).toBe(before)
  })
})
