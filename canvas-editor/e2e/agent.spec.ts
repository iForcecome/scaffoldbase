import { test, expect } from './fixtures'

// 真实 AI 端到端：触发 chat-store.sendMessage → server agent → tool_request →
// client dispatchTools → server 进入下一轮 → done。
//
// 这些测试依赖 server `.env` 里 AI_API_KEY/BASE_URL/MODEL 已配置。
// 如未配置 server 会立刻发 error 事件，测试也会失败。
//
// 单 test 给 90s 上限（AI 慢响应 / 多轮）；workers=1 串行避免共享 abort 干扰。

type ChatState = {
  isStreaming: boolean
  error: string | null
  lastAssistant: string | null
  lastTrace: Array<{ turn: number; summary: string; toolCalls?: Array<{ name: string; ok: boolean }> }> | null
}

const INITIAL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><title>agent-test</title></head>
<body data-sf-id="sf-0">
  <h1 data-sf-id="sf-1">原始标题</h1>
  <p data-sf-id="sf-2">原始段落</p>
</body>
</html>`

async function loadEditor(
  page: import('@playwright/test').Page,
  projectId: string,
  request: import('@playwright/test').APIRequestContext,
  pageId = 'page-agent',
) {
  await request.put(`/api/projects/${projectId}/pages/${pageId}`, {
    data: { title: 'Agent Test', contentHtml: INITIAL_HTML, layoutId: null },
  })
  await page.goto(`/editor/${projectId}`)
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => typeof window.__sfTest__?.dispatchTools === 'function', null, { timeout: 10_000 })
  await page.waitForFunction(() => window.__sfTest__!.getActivePageId() !== '', null, { timeout: 5_000 })
  return pageId
}

async function waitForChatDone(page: import('@playwright/test').Page, timeoutMs: number): Promise<ChatState> {
  await page.waitForFunction(
    () => {
      const s = window.__sfTest__!.chat.getState()
      return !s.isStreaming && (s.lastAssistant !== null || s.error !== null)
    },
    null,
    { timeout: timeoutMs },
  )
  return await page.evaluate<ChatState>(() => window.__sfTest__!.chat.getState())
}

test.describe('agent 端到端（真实 AI）', () => {
  test.describe.configure({ timeout: 90_000 })

  test('改 h1 文字：发指令后 contentHtml 真的变了', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)

    await page.evaluate(() => window.__sfTest__!.chat.send('把页面顶部 h1 标题的文字改成「AI 改过的标题」。不要改任何 class 和 style。'))
    const state = await waitForChatDone(page, 75_000)

    expect(state.error, `chat error: ${state.error}`).toBeNull()

    // contentHtml 真改了
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('AI 改过的标题')
    expect(html).not.toContain('原始标题')
    // 段落没动
    expect(html).toContain('原始段落')

    // trace 里至少有 dom_set_text 这一类的工具调用
    const calls = state.lastTrace?.flatMap(t => t.toolCalls ?? []) ?? []
    expect(calls.some(c => c.name === 'dom_set_text' && c.ok)).toBe(true)
  })

  test('改不存在的元素：AI 应承认失败、不胡乱继续', async ({ page, project, request }) => {
    await loadEditor(page, project.id, request)

    // 让 AI 试着改一个不存在的部分；它应当先 page_read 探查、发现没有 button，给出友好答复
    await page.evaluate(() => window.__sfTest__!.chat.send('页面里现在有按钮（button 元素）吗？如果有就把按钮文字改成「确认」；如果没有按钮就什么都别做，告诉我没找到。'))
    const state = await waitForChatDone(page, 75_000)

    expect(state.error).toBeNull()

    // contentHtml 不应被错误地修改
    const html = await page.evaluate(() => window.__sfTest__!.getActiveContentHtml())
    expect(html).toContain('原始标题')
    expect(html).toContain('原始段落')

    // 至少有 page_read 调用
    const calls = state.lastTrace?.flatMap(t => t.toolCalls ?? []) ?? []
    expect(calls.some(c => c.name === 'page_read' && c.ok)).toBe(true)
    // 不应有任何 dom_* 写入（或如果有，也是被 target_not_found 拒掉）
    const writeCalls = calls.filter(c => c.name.startsWith('dom_'))
    for (const c of writeCalls) {
      expect(c.ok).toBe(false)
    }
  })
})
