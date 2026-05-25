import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { useSelectionStore } from '../../stores/selection-store'
import { useHtmlTree } from '../../hooks/use-html-tree'
import { dispatchTools } from '../../tools'
import { collectSfIds, type TreeNode } from '../../utils/parse-html-tree'

type DropPosition = 'before' | 'after' | 'append'
interface DropIndicator {
  sfId: string
  position: DropPosition
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  sfId: string
  tag: string
}

const INITIAL_MENU: ContextMenuState = { visible: false, x: 0, y: 0, sfId: '', tag: '' }

/** 从 contentHtml 里取目标元素的 outerHTML（递归清除 sf-id，避免插入时 ID 冲突） */
function getStrippedOuterHtml(contentHtml: string, sfId: string): string | null {
  const doc = new DOMParser().parseFromString(contentHtml, 'text/html')
  const el = doc.querySelector(`[data-sf-id="${CSS.escape(sfId)}"]`)
  if (!el) return null
  const clone = el.cloneNode(true) as Element
  clone.removeAttribute('data-sf-id')
  clone.querySelectorAll('[data-sf-id]').forEach(e => e.removeAttribute('data-sf-id'))
  return clone.outerHTML
}

export function LayerTree() {
  const tree = useHtmlTree()
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const primaryId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [menu, setMenu] = useState<ContextMenuState>(INITIAL_MENU)
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  // ref 跟 state 同步——drag 事件可能在 React commit 之前连续触发（含 e2e 测试
  // 中一次性 dispatch 多个事件），handler 读 ref 拿到最新值，state 仅用于视觉。
  const dragSourceIdRef = useRef<string | null>(null)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)
  const scrollRootRef = useRef<HTMLDivElement>(null)

  // 收集每个 sfId 的后代集合，dragOver 时 O(1) 判断"是否落到自身/后代里"。
  // 树变化时（contentHtml 变）重算；不大，几百节点级别。
  const descendantMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    const walk = (node: TreeNode) => {
      const set = new Set(collectSfIds(node.children))
      map.set(node.sfId, set)
      for (const c of node.children) walk(c)
    }
    for (const n of tree) walk(n)
    return map
  }, [tree])

  const handleToggle = useCallback((sfId: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(sfId)) next.delete(sfId)
      else next.add(sfId)
      return next
    })
  }, [])

  const handleSelect = useCallback((sfId: string, multi: boolean) => {
    // 把焦点接管到 tree 容器：
    // 1) 让面板里的 input/textarea blur → onBlur=commit 触发，用户编辑不丢
    // 2) Delete 等快捷键的 onKeyDown 监听在 tree 容器上才能拿到事件
    scrollRootRef.current?.focus({ preventScroll: true })
    void dispatchTools([
      multi
        ? { name: 'selection_set', params: { nodeIds: Array.from(new Set([...selectedIds, sfId])) } }
        : { name: 'selection_set', params: { nodeIds: [sfId] } },
    ])
  }, [selectedIds])

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    setMenu({ visible: true, x: e.clientX, y: e.clientY, sfId: node.sfId, tag: node.tag })
  }, [])

  // 外部点击关闭菜单
  useEffect(() => {
    if (!menu.visible) return
    const onDoc = () => setMenu(INITIAL_MENU)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menu.visible])

  // 选中变化 → 滚到节点
  useEffect(() => {
    if (!primaryId || !scrollRootRef.current) return
    const target = scrollRootRef.current.querySelector(`[data-tree-sfid="${CSS.escape(primaryId)}"]`)
    if (target && 'scrollIntoView' in target) {
      ;(target as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [primaryId])

  // Delete 键：tree 容器拿到焦点时才触发，避免在 input/textarea 上误删元素
  const handleTreeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    if (!primaryId || primaryId === 'sf-0') return
    e.preventDefault()
    void dispatchTools([{ name: 'dom_delete', params: { sfId: primaryId } }])
  }, [primaryId])

  const doDelete = useCallback((sfId: string) => {
    void dispatchTools([{ name: 'dom_delete', params: { sfId } }])
    setMenu(INITIAL_MENU)
  }, [])

  // ── 拖拽 ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, sfId: string) => {
    if (sfId === 'sf-0') { e.preventDefault(); return }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', sfId)
    }
    dragSourceIdRef.current = sfId
    setDragSourceId(sfId)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragSourceIdRef.current = null
    dropIndicatorRef.current = null
    setDragSourceId(null)
    setDropIndicator(null)
  }, [])

  const handleRowDragOver = useCallback((e: React.DragEvent, node: TreeNode) => {
    const src = dragSourceIdRef.current
    if (!src) return
    if (node.sfId === src) return
    const desc = descendantMap.get(src)
    if (desc?.has(node.sfId)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const ratio = (e.clientY - rect.top) / rect.height
    let position: DropPosition
    if (ratio < 0.25) position = 'before'
    else if (ratio > 0.75) position = 'after'
    else position = 'append'
    if (node.sfId === 'sf-0' && position !== 'append') position = 'append'
    const next: DropIndicator = { sfId: node.sfId, position }
    dropIndicatorRef.current = next
    setDropIndicator(prev =>
      prev && prev.sfId === next.sfId && prev.position === next.position ? prev : next
    )
  }, [descendantMap])

  const handleRowDrop = useCallback((e: React.DragEvent, node: TreeNode) => {
    const src = dragSourceIdRef.current
    if (!src) return
    if (node.sfId === src) { handleDragEnd(); return }
    const desc = descendantMap.get(src)
    if (desc?.has(node.sfId)) { handleDragEnd(); return }
    e.preventDefault()
    const ind = dropIndicatorRef.current
    const position: DropPosition = ind && ind.sfId === node.sfId ? ind.position : 'append'
    void dispatchTools([{
      name: 'dom_move',
      params: { sourceSfId: src, targetSfId: node.sfId, position },
    }])
    handleDragEnd()
  }, [descendantMap, handleDragEnd])

  const doDuplicate = useCallback((sfId: string) => {
    const state = useEditorStore.getState()
    const page = state.pages.find(p => p.id === state.activePageId)
    if (!page) return setMenu(INITIAL_MENU)
    const html = getStrippedOuterHtml(page.contentHtml, sfId)
    if (!html) return setMenu(INITIAL_MENU)
    void dispatchTools([{
      name: 'dom_insert_html',
      params: { targetSfId: sfId, position: 'after', html },
    }])
    setMenu(INITIAL_MENU)
  }, [])

  if (tree.length === 0) {
    return <div className="p-3 text-[11px] text-ink-3">页面尚无内容。</div>
  }

  return (
    <div
      className="relative h-full outline-none"
      ref={scrollRootRef}
      data-testid="layer-tree"
      tabIndex={-1}
      onKeyDown={handleTreeKeyDown}
    >
      <ul className="text-[11px] py-1 select-none">
        {tree.map(node => (
          <LayerTreeNode
            key={node.sfId}
            node={node}
            selectedId={primaryId}
            collapsed={collapsed}
            onToggle={handleToggle}
            onSelect={handleSelect}
            onContextMenu={handleContextMenu}
            dragSourceId={dragSourceId}
            dropIndicator={dropIndicator}
            onDragStart={handleDragStart}
            onDragOver={handleRowDragOver}
            onDrop={handleRowDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </ul>
      {menu.visible && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          tag={menu.tag}
          canDelete={menu.sfId !== 'sf-0'}
          onDelete={() => doDelete(menu.sfId)}
          onDuplicate={() => doDuplicate(menu.sfId)}
        />
      )}
    </div>
  )
}

interface NodeProps {
  node: TreeNode
  selectedId: string | null
  collapsed: Set<string>
  onToggle: (sfId: string) => void
  onSelect: (sfId: string, multi: boolean) => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  dragSourceId: string | null
  dropIndicator: DropIndicator | null
  onDragStart: (e: React.DragEvent, sfId: string) => void
  onDragOver: (e: React.DragEvent, node: TreeNode) => void
  onDrop: (e: React.DragEvent, node: TreeNode) => void
  onDragEnd: () => void
}

function LayerTreeNode({
  node, selectedId, collapsed, onToggle, onSelect, onContextMenu,
  dragSourceId, dropIndicator, onDragStart, onDragOver, onDrop, onDragEnd,
}: NodeProps) {
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.sfId)
  const isSelected = selectedId === node.sfId
  const isDragSource = dragSourceId === node.sfId
  const isDropTarget = dropIndicator?.sfId === node.sfId
  const dropPos = isDropTarget ? dropIndicator!.position : null

  return (
    <li>
      <div
        draggable={node.sfId !== 'sf-0'}
        className={`group relative flex items-center gap-1 px-1.5 py-0.5 cursor-pointer rounded-sm leading-relaxed ${
          isSelected ? 'bg-brand-100 text-brand-700' : 'hover:bg-surface-1 text-ink-1'
        } ${isDragSource ? 'opacity-50' : ''} ${dropPos === 'append' ? 'ring-1 ring-brand-500 ring-inset' : ''}`}
        style={{ paddingLeft: 8 + node.depth * 10 }}
        onClick={(e) => onSelect(node.sfId, e.shiftKey || e.metaKey || e.ctrlKey)}
        onContextMenu={(e) => onContextMenu(e, node)}
        onDragStart={(e) => onDragStart(e, node.sfId)}
        onDragOver={(e) => onDragOver(e, node)}
        onDrop={(e) => onDrop(e, node)}
        onDragEnd={onDragEnd}
        data-tree-sfid={node.sfId}
      >
        {dropPos === 'before' && (
          <span className="absolute top-0 left-0 right-0 h-0.5 bg-brand-500 pointer-events-none" />
        )}
        {dropPos === 'after' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 pointer-events-none" />
        )}
        {hasChildren ? (
          <button
            type="button"
            className="w-3 h-3 flex items-center justify-center text-ink-3 hover:text-ink-1 shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggle(node.sfId) }}
            aria-label={isCollapsed ? '展开' : '折叠'}
          >
            <span className={`inline-block transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>▸</span>
          </button>
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}
        <span className="font-mono text-brand-600 shrink-0">{node.tag}</span>
        {node.label !== node.tag && (
          <span className="text-ink-3 truncate text-[10px]">{node.label.slice(node.tag.length + 3)}</span>
        )}
      </div>
      {hasChildren && !isCollapsed && (
        <ul>
          {node.children.map(child => (
            <LayerTreeNode
              key={child.sfId}
              node={child}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              dragSourceId={dragSourceId}
              dropIndicator={dropIndicator}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

interface ContextMenuProps {
  x: number
  y: number
  tag: string
  canDelete: boolean
  onDelete: () => void
  onDuplicate: () => void
}

function ContextMenu({ x, y, tag, canDelete, onDelete, onDuplicate }: ContextMenuProps) {
  return (
    <div
      role="menu"
      data-testid="layer-tree-context-menu"
      className="fixed z-50 min-w-[120px] bg-white rounded-md border border-surface-3 py-1 text-[12px]"
      style={{ left: x, top: y, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="px-2.5 py-1 text-[10px] text-ink-3 font-mono">{tag}</div>
      <button
        type="button"
        className="w-full text-left px-2.5 py-1 hover:bg-surface-1 text-ink-1"
        onClick={onDuplicate}
      >
        复制
      </button>
      <button
        type="button"
        className={`w-full text-left px-2.5 py-1 ${canDelete ? 'hover:bg-red-50 text-red-600' : 'text-ink-3 cursor-not-allowed'}`}
        onClick={canDelete ? onDelete : undefined}
        disabled={!canDelete}
      >
        删除
      </button>
    </div>
  )
}
