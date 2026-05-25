import { useEditorStore } from '../stores/editor-store'
import { useSelectionStore } from '../stores/selection-store'
import { getTool } from './registry'
import type {
  DispatchResult,
  ToolCall,
  ToolContext,
  ToolEffect,
  ToolResult,
} from './types'

/**
 * effect apply 后可选地返回数据覆盖（merge 到 ToolResult.data）。
 * 用于让 tool 返回真实 store 生成的 id（page.create 不知道 addPage 会生成什么 pageId）。
 */
type EffectApplyResult = void | { dataPatch: Record<string, unknown> }

function applyEffect(effect: ToolEffect): EffectApplyResult {
  const editor = useEditorStore.getState()
  const selection = useSelectionStore.getState()

  switch (effect.kind) {
    case 'page_create': {
      // editor-store.addPage 生成自己的 id 并设为 active。读 activePageId 拿真实 id。
      editor.addPage()
      const realId = useEditorStore.getState().activePageId
      if (realId && effect.page.title && effect.page.title !== '新页面') {
        editor.renamePage(realId, effect.page.title)
      }
      return { dataPatch: { pageId: realId } }
    }
    case 'page_delete':
      editor.deletePage(effect.pageId)
      return
    case 'page_duplicate': {
      editor.duplicatePage(effect.sourcePageId)
      // duplicatePage 内部把新页面设为 active
      const realId = useEditorStore.getState().activePageId
      return { dataPatch: { newPageId: realId } }
    }
    case 'page_rename':
      editor.renamePage(effect.pageId, effect.title)
      return
    case 'page_set_active':
      editor.setActivePage(effect.pageId)
      return
    case 'selection_set':
      if (effect.nodeIds.length === 0) {
        selection.clearSelection()
        return
      }
      selection.clearSelection()
      for (let i = 0; i < effect.nodeIds.length; i++) {
        selection.selectElement(effect.nodeIds[i], null, null, i > 0, effect.meta as never)
      }
      return
    case 'selection_hover':
      selection.hoverElement(effect.nodeId)
      return
    case 'history_undo':
      editor.undo()
      return
    case 'history_redo':
      editor.redo()
      return
    case 'html_apply_ops':
      // 改前先 pushUndo，保证 dom_* 操作可撤销
      editor.pushUndo()
      editor.updatePageContentHtml(effect.pageId, effect.nextHtml)
      return
    default: {
      const _exhaustive: never = effect
      throw new Error(`Unknown effect: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

/** 从当前 store 状态构建 ToolContext 快照 */
function buildContext(dryRun: boolean): ToolContext {
  const editor = useEditorStore.getState()
  const selection = useSelectionStore.getState()
  return {
    activePageId: editor.activePageId || null,
    getPageContentHtml: (pageId) => {
      const page = editor.pages.find(p => p.id === pageId)
      return page ? page.contentHtml : null
    },
    listPages: () => editor.pages.map(p => ({ id: p.id, title: p.title })),
    selection: {
      selectedIds: [...selection.selectedIds],
      hoveredId: selection.hoveredId,
      activePageId: editor.activePageId || '',
    },
    dryRun,
  }
}

/**
 * 顺序执行一批 tool 调用。effects 在 dryRun=false 时 apply 到 store。
 *
 * 一条 tool 失败不阻断后续。每个调用都产出独立 result，调用方按 callId 关联。
 */
export async function dispatchTools(
  calls: ToolCall[],
  opts: { dryRun?: boolean } = {},
): Promise<DispatchResult> {
  const dryRun = opts.dryRun ?? false
  const results: DispatchResult['results'] = []
  let appliedEffects = 0
  let failedCalls = 0

  for (const call of calls) {
    const tool = getTool(call.name)
    if (!tool) {
      results.push({
        callId: call.callId,
        toolName: call.name,
        ok: false,
        error: { code: 'tool_not_found', message: `Tool "${call.name}" 未注册` },
      })
      failedCalls += 1
      continue
    }

    let result: ToolResult
    try {
      // ctx 每次 tool 调用都重建，反映前一条 effect 已 apply 后的状态
      const ctx = buildContext(dryRun)
      result = await tool.execute(call.params as never, ctx)
    } catch (err) {
      result = {
        ok: false,
        error: {
          code: 'tool_threw',
          message: err instanceof Error ? err.message : String(err),
        },
      }
    }

    if (!result.ok) {
      failedCalls += 1
      results.push({ callId: call.callId, toolName: call.name, ...result })
      continue
    }

    if (!dryRun && result.effects) {
      const enrichedData: Record<string, unknown> = (result.data as Record<string, unknown>) ?? {}
      let aborted = false
      for (const effect of result.effects) {
        try {
          const applyResult = applyEffect(effect)
          if (applyResult?.dataPatch) {
            Object.assign(enrichedData, applyResult.dataPatch)
          }
          appliedEffects += 1
        } catch (err) {
          result = {
            ok: false,
            data: enrichedData,
            effects: result.effects,
            error: {
              code: 'effect_apply_failed',
              message: err instanceof Error ? err.message : String(err),
              details: effect,
            },
          }
          failedCalls += 1
          aborted = true
          break
        }
      }
      if (!aborted && Object.keys(enrichedData).length > 0) {
        result = { ...result, data: enrichedData }
      }
    }

    results.push({ callId: call.callId, toolName: call.name, ...result })
  }

  return { results, appliedEffects, failedCalls }
}
