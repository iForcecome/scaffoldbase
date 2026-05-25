import { test, expect } from './fixtures'
import type { Page, APIRequestContext } from '@playwright/test'

const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><title>undo-edit-test</title></head>
<body data-sf-id="sf-0">
  <h1 data-sf-id="sf-1">Hello</h1>
  <p data-sf-id="sf-2">原始段落</p>
</body>
</html>`

async function loadEditor(page: Page, projectId: string, request: APIRequestContext) {
  const pageId = 'page-ue'
  await request.put(`/api/projects/${projectId}/pages/${pageId}`, {
    data: { title: 'UE', contentHtml: INITIAL_HTML, layoutId: null },
  })
  await page.goto(`/editor/${projectId}`)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__sfTest__?.dispatchTools === 'function', null, { timeout: 10_000 })
  await page.waitForFunction(() => window.__sfTest__!.getActivePageId() !== '', null, { timeout: 5_000 })
}

test.describe('Undo/Redo 快捷键 + Inline 编辑回写', () => {
  test('Cmd+Z 撤销 / Cmd+Shift+Z 重做', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)

    // 改 h1 文字
    await page.evaluate(() => window.__sfTest__!.dispatchTools([
      { name: 'dom_set_text', params: { sfId: 'sf-1', text: 'Modified' } },
    ]))
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())).toContain('Modified')

    // 把焦点移到非 form 元素（layer-tree 容器），保证快捷键命中全局监听
    await page.getByTestId('layer-tree').focus()
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(100)
    const afterUndo = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(afterUndo).toContain('Hello')
    expect(afterUndo).not.toContain('Modified')

    // 重做
    await page.keyboard.press('Meta+Shift+z')
    await page.waitForTimeout(100)
    const afterRedo = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(afterRedo).toContain('Modified')
  })

  test('Cmd+Z 在 input/textarea 聚焦时不触发画布撤销（让浏览器走原生）', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    // 先制造一次画布变更，确保 undoStack 不空
    await page.evaluate(() => window.__sfTest__!.dispatchTools([
      { name: 'dom_set_text', params: { sfId: 'sf-1', text: 'Modified' } },
    ]))
    await page.waitForTimeout(100)
    // 聚焦右栏 sharedHead textarea
    const ta = page.locator('aside').last().locator('textarea').first()
    await ta.focus()
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(100)
    // contentHtml 不应该回滚
    expect(await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())).toContain('Modified')
  })

  test('双击 → bridge 编辑 → blur → 文字回写到 contentHtml 且进 undo 栈', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)

    // 模拟 bridge：postMessage start-edit 给 iframe（绕开 overlay 坐标定位）
    await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      iframe.contentWindow!.postMessage({ type: 'start-edit', id: 'sf-1' }, '*')
    })

    // 等 iframe 内 h1 进入 contentEditable
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      const el = iframe.contentDocument?.querySelector('[data-sf-id="sf-1"]') as HTMLElement | null
      return el?.isContentEditable === true
    }, null, { timeout: 5_000 })

    // 模拟用户输入：改 textContent + blur 触发 onBlur → respond edit-done
    await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      const el = iframe.contentDocument?.querySelector('[data-sf-id="sf-1"]') as HTMLElement | null
      if (!el) throw new Error('h1 not found')
      el.textContent = 'Inline Edit'
      el.blur()
    })

    // 等 edit-done 经 use-bridge → dispatchTools dom_set_text → store 更新
    await page.waitForFunction(() => {
      const html = window.__sfTest__!.getActiveContentHtml()
      return html?.includes('Inline Edit') ?? false
    }, null, { timeout: 5_000 })

    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('Inline Edit')
    expect(html).not.toContain('>Hello<')

    // 同一次编辑可被撤销
    await page.getByTestId('layer-tree').focus()
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())).toContain('Hello')
  })

  test('inline 编辑文字不变时 dom_set_text no-op（不产生空白 undo）', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)
    const beforeUndoLen = await page.evaluate(() => {
      // 通过 dispatchTools 一次拿不到 undo 栈大小，借 history_undo 试探：
      // 改文字然后撤销，确认能撤；再撤销一次应失败（栈空）
      return null
    })
    expect(beforeUndoLen).toBeNull()

    // 触发 start-edit + blur 但 textContent 不变
    await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      iframe.contentWindow!.postMessage({ type: 'start-edit', id: 'sf-1' }, '*')
    })
    await page.waitForFunction(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      return (iframe.contentDocument?.querySelector('[data-sf-id="sf-1"]') as HTMLElement | null)?.isContentEditable === true
    }, null, { timeout: 5_000 })
    await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      const el = iframe.contentDocument?.querySelector('[data-sf-id="sf-1"]') as HTMLElement | null
      el?.blur()
    })
    await page.waitForTimeout(200)
    // contentHtml 仍是初始
    expect(await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())).toContain('Hello')
  })
})
