import { test, expect } from './fixtures'
import type { Locator, Page, APIRequestContext } from '@playwright/test'

const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><title>tree-test</title></head>
<body data-sf-id="sf-0">
  <header data-sf-id="sf-1">
    <h1 data-sf-id="sf-2">Hello</h1>
    <button data-sf-id="sf-3">Action</button>
  </header>
  <main data-sf-id="sf-4">
    <p data-sf-id="sf-5">段落 A</p>
    <p data-sf-id="sf-6">段落 B</p>
  </main>
</body>
</html>`

async function loadEditor(page: Page, projectId: string, request: APIRequestContext) {
  const pageId = 'page-tree'
  await request.put(`/api/projects/${projectId}/pages/${pageId}`, {
    data: { title: 'Tree', contentHtml: INITIAL_HTML, layoutId: null },
  })
  await page.goto(`/editor/${projectId}`)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__sfTest__?.dispatchTools === 'function', null, { timeout: 10_000 })
  await page.waitForFunction(() => window.__sfTest__!.getActivePageId() !== '', null, { timeout: 5_000 })
  await expect(page.getByTestId('layer-tree')).toBeVisible({ timeout: 5_000 })
  return pageId
}

function treeNode(page: Page, sfId: string): Locator {
  return page.getByTestId('layer-tree').locator(`[data-tree-sfid="${sfId}"]`)
}

test.describe('β5 LayerTree', () => {
  test('树渲染：body + 内嵌结构', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const tree = page.getByTestId('layer-tree')
    // 主要 tag 都应出现
    await expect(tree).toContainText('body')
    await expect(tree).toContainText('header')
    await expect(tree).toContainText('h1')
    await expect(tree).toContainText('button')
    await expect(tree).toContainText('main')
    // label 用 textContent 预览
    await expect(tree).toContainText('Hello')
    await expect(tree).toContainText('Action')
  })

  test('点击树节点 → 全局选中（联动 RightPanel）', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await treeNode(page, 'sf-2').click()
    // RightPanel Inspector 应出现并显示 h1 + sf-2
    const insp = page.getByTestId('element-inspector')
    await expect(insp).toBeVisible({ timeout: 5_000 })
    await expect(insp).toContainText('<h1>')
    await expect(insp).toContainText('sf-2')
  })

  test('外部选中（dispatchTools selection_set） → 树节点高亮', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await page.evaluate(() => window.__sfTest__!.dispatchTools([{ name: 'selection_set', params: { nodeIds: ['sf-5'] } }]))
    const node = treeNode(page, 'sf-5')
    // 高亮 class 含 bg-brand-100
    await expect(node).toHaveClass(/bg-brand-100/)
  })

  test('折叠 chevron：点击后子节点消失，再点恢复', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    // header 的折叠按钮
    const headerRow = treeNode(page, 'sf-1')
    await expect(treeNode(page, 'sf-2')).toBeVisible()
    await headerRow.locator('button[aria-label="折叠"]').click()
    await expect(treeNode(page, 'sf-2')).toHaveCount(0)
    // 再点
    await headerRow.locator('button[aria-label="展开"]').click()
    await expect(treeNode(page, 'sf-2')).toBeVisible()
  })

  test('右键 → 删除', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await treeNode(page, 'sf-5').click({ button: 'right' })
    const menu = page.getByTestId('layer-tree-context-menu')
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: '删除' }).click()
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).not.toContain('段落 A')
    expect(html).toContain('段落 B')
  })

  test('右键 → 复制（生成新 sf-id 的孪生兄弟）', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await treeNode(page, 'sf-5').click({ button: 'right' })
    await page.getByTestId('layer-tree-context-menu').getByRole('button', { name: '复制' }).click()
    await page.waitForTimeout(200)
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    // 应出现两个「段落 A」
    const occurrences = (html?.match(/段落 A/g) ?? []).length
    expect(occurrences).toBe(2)
  })

  test('右键 body：删除被禁用', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await treeNode(page, 'sf-0').click({ button: 'right' })
    const deleteBtn = page.getByTestId('layer-tree-context-menu').getByRole('button', { name: '删除' })
    await expect(deleteBtn).toBeDisabled()
  })

  test('Delete 键删选中元素', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await treeNode(page, 'sf-3').click()
    await expect(page.getByTestId('element-inspector')).toContainText('sf-3', { timeout: 5_000 })
    // 把 keydown 派到 tree 容器（React onKeyDown 处理冒泡到容器的事件）
    await page.evaluate(() => {
      const root = document.querySelector('[data-testid="layer-tree"]')
      root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(200)
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).not.toContain('<button')
    expect(html).toContain('<h1')
  })

  test('Delete 键在 input 聚焦时不触发删元素', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await treeNode(page, 'sf-2').click()
    // 把 keydown 派到 textarea（在容器外）—— LayerTree onKeyDown 监听容器内，所以不会触发
    await page.evaluate(() => {
      const ta = document.querySelector('aside textarea')
      ta?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(150)
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('<h1')
    expect(html).toContain('Hello')
  })

  test('Shift+点击 多选', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    await treeNode(page, 'sf-5').click()
    await treeNode(page, 'sf-6').click({ modifiers: ['Shift'] })
    // 两个都高亮（primary 是 sf-6，但 sf-5 也在 selectedIds 里）
    // 验证：dispatch state
    const ids = await page.evaluate(() => {
      // useSelectionStore 没直接暴露；通过 inspector header 看 +1 计数
      return null
    })
    expect(ids).toBeNull()
    // 通过 RightPanel header "+1" 验证多选
    const header = page.locator('aside').last().locator('text=+1')
    await expect(header).toBeVisible()
  })
})
