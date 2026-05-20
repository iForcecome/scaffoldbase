import { useState, useRef } from 'react'
import { sendBridgeMessage, setPendingReveal } from '../../bridge/host'
import { useEditorStore } from '../../stores/editor-store'
import { useSelectionStore } from '../../stores/selection-store'
import type { ComponentNode } from '../../page-schema/types'

function ContainerIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-3 h-3 text-ink-3'} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75Z"/>
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className="w-3 h-3 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      {open
        ? <path strokeLinecap="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/>
        : <path strokeLinecap="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
      }
    </svg>
  )
}

function TableIcon() {
  return (
    <svg className="w-3 h-3 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125"/>
    </svg>
  )
}

function FileIcon() {
  return (
    <svg className="w-3 h-3 text-ink-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
    </svg>
  )
}

function TextIcon({ letter, isSelected }: { letter: string; isSelected: boolean }) {
  return (
    <span className={`w-3 h-3 flex items-center justify-center text-[10px] font-bold ${isSelected ? 'text-brand-500' : 'text-ink-3'}`}>
      {letter}
    </span>
  )
}

function getNodeIcon(component: string, isSelected: boolean, hasChildren: boolean) {
  if (component === 'DataTable') return <TableIcon />
  if (component === 'Button') return <TextIcon letter="B" isSelected={isSelected} />
  if (component === 'Navigation') return <TextIcon letter="N" isSelected={isSelected} />
  if (!hasChildren && (component === 'Text' || component === 'Heading')) {
    return <TextIcon letter="T" isSelected={isSelected} />
  }
  return <ContainerIcon className={isSelected ? 'w-3 h-3 text-brand-500' : 'w-3 h-3 text-ink-3'} />
}

const DATA_COMPONENTS = new Set(['DataTable', 'List'])

function getComponentBadge(node: ComponentNode, isSelected: boolean) {
  if (isSelected) {
    return <span className="ml-auto spec-mini-tag bg-brand-50 text-brand-600">选中</span>
  }
  if (DATA_COMPONENTS.has(node.component)) {
    return <span className="ml-auto spec-mini-tag bg-emerald-50 text-emerald-600">数据</span>
  }
  return <span className="ml-auto spec-mini-tag bg-purple-50 text-purple-600 truncate max-w-16">{node.component}</span>
}

function LayerNode({ node, depth, parentId, siblingIds, pageId }: { node: ComponentNode; depth: number; parentId: string | null; siblingIds: string[]; pageId: string }) {
  const [expanded, setExpanded] = useState(depth < 3)
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null)
  const selectedIds = useSelectionStore(s => s.selectedIds)
  const selectElement = useSelectionStore(s => s.selectElement)
  const hoverElement = useSelectionStore(s => s.hoverElement)
  const applySchemaOperations = useEditorStore(s => s.applySchemaOperations)
  const rowRef = useRef<HTMLDivElement>(null)

  const children = node.children ?? []
  const hasChildren = children.length > 0
  const isSelected = selectedIds.includes(node.id)
  const displayLabel = node.label || node.component

  const indentMap: Record<number, string> = {
    1: 'pl-5',
    2: 'pl-9',
    3: 'pl-12',
    4: 'pl-16',
    5: 'pl-20',
  }
  const plClass = indentMap[depth] || 'pl-24'

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: node.id, parentId }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = rowRef.current?.getBoundingClientRect()
    if (rect) {
      const midY = rect.top + rect.height / 2
      setDropPosition(e.clientY < midY ? 'above' : 'below')
    }
  }

  const handleDragLeave = () => setDropPosition(null)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const pos = dropPosition
    setDropPosition(null)
    try {
      const source = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (source.id === node.id) return
      if (source.parentId !== parentId) return
      if (!siblingIds.includes(source.id)) return

      applySchemaOperations(pageId, [{
        type: 'moveNode',
        target: source.id,
        reference: node.id,
        position: pos === 'below' ? 'after' : 'before',
      }])
    } catch { /* ignore */ }
  }

  return (
    <>
      <div
        ref={rowRef}
        draggable={!!parentId}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`layer-item px-2 py-1.5 ${plClass} flex items-center gap-1.5 cursor-pointer ${
          isSelected ? 'active' : ''
        } ${dropPosition === 'above' ? 'border-t-2 border-brand-400' : ''} ${dropPosition === 'below' ? 'border-b-2 border-brand-400' : ''}`}
        onClick={(e) => {
          const multi = e.shiftKey || e.metaKey || e.ctrlKey
          selectElement(node.id, null, node.label ?? null, multi, {
            sfId: node.id,
            component: node.component,
            role: node.role ?? null,
            variant: node.variant ?? null,
          })
          if (!multi) setPendingReveal(node.id)
          sendBridgeMessage({ type: 'get-computed-style', id: node.id })
        }}
        onMouseEnter={() => {
          hoverElement(node.id, null)
          sendBridgeMessage({ type: 'get-rect', id: node.id })
        }}
        onMouseLeave={() => hoverElement(null)}
      >
        {hasChildren ? (
          <button
            className="shrink-0"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            <ChevronIcon open={expanded} />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {getNodeIcon(node.component, isSelected, hasChildren)}

        <div className="min-w-0 flex flex-col">
          <span className={
            `truncate ${
              isSelected ? 'text-brand-600 font-medium' :
              hasChildren ? 'text-ink-1' : 'text-ink-2'
            }`
          }>
            {displayLabel}
          </span>
          {node.role && (
            <span className="text-[10px] text-ink-4 truncate leading-3">
              {node.role}
            </span>
          )}
        </div>

        {getComponentBadge(node, isSelected)}
      </div>

      {expanded && hasChildren && children.map(child => (
        <LayerNode
          key={child.id}
          node={child}
          depth={depth + 1}
          parentId={node.id}
          siblingIds={children.map(c => c.id)}
          pageId={pageId}
        />
      ))}
    </>
  )
}

export function LayerTree() {
  const activePage = useEditorStore(s => s.pages.find(p => p.id === s.activePageId))
  const sections = activePage?.schema?.page.sections ?? []
  const pageId = activePage?.id ?? ''

  return (
    <div>
      <div className="px-2 py-1.5 flex items-center gap-1.5 text-ink-3 font-medium">
        <FileIcon />
        {activePage?.title ? activePage.title + '页' : '页面'}
      </div>

      {sections.length === 0 ? (
        <div className="px-4 py-6 text-center text-ink-3 text-[11px]">
          页面暂无组件
        </div>
      ) : (
        sections.map(node => (
          <LayerNode
            key={node.id}
            node={node}
            depth={1}
            parentId={null}
            siblingIds={sections.map(n => n.id)}
            pageId={pageId}
          />
        ))
      )}
    </div>
  )
}
