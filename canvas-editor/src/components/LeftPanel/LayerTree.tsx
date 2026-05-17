import { useState, useRef } from 'react'
import { useEditorStore, sendBridgeMessage, type DOMNode } from '../../stores/editor-store'

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

function GridIcon({ isSelected }: { isSelected: boolean }) {
  return (
    <span className={`w-3 h-3 flex items-center justify-center text-[10px] ${isSelected ? 'text-brand-500' : 'text-ink-3'}`}>
      ⊞
    </span>
  )
}

function getNodeIcon(tag: string, isSelected: boolean, hasChildren: boolean) {
  if (tag === 'thead' || tag === 'tbody') return <GridIcon isSelected={isSelected} />
  if (tag === 'table') return <TableIcon />

  if (!hasChildren) {
    if (['h1', 'h2', 'h3'].includes(tag)) return <TextIcon letter="H" isSelected={isSelected} />
    if (['nav', 'span', 'a', 'label'].includes(tag)) return <TextIcon letter="T" isSelected={isSelected} />
    if (tag === 'button') return <TextIcon letter="B" isSelected={isSelected} />
  }

  return <ContainerIcon className={isSelected ? 'w-3 h-3 text-brand-500' : 'w-3 h-3 text-ink-3'} />
}

function getTagBadge(tag: string, isSelected: boolean, hasChildren: boolean) {
  if (isSelected) {
    return <span className="ml-auto spec-mini-tag bg-brand-50 text-brand-600">选中</span>
  }
  if (!hasChildren) return null

  const data = ['table', 'tbody', 'thead', 'ul', 'ol']
  if (data.includes(tag)) {
    return <span className="ml-auto spec-mini-tag bg-emerald-50 text-emerald-600">数据</span>
  }

  const containers = ['div', 'section', 'main', 'header', 'footer', 'aside', 'nav', 'article']
  if (containers.includes(tag)) {
    return <span className="ml-auto spec-mini-tag bg-surface-2 text-ink-3">容器</span>
  }
  return null
}

function LayerNode({ node, depth, parentId, siblingIds }: { node: DOMNode; depth: number; parentId: string | null; siblingIds: string[] }) {
  const [expanded, setExpanded] = useState(depth < 3)
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null)
  const selectedIds = useEditorStore(s => s.selectedIds)
  const selectElement = useEditorStore(s => s.selectElement)
  const panToElement = useEditorStore(s => s.panToElement)
  const hoverElement = useEditorStore(s => s.hoverElement)
  const rowRef = useRef<HTMLDivElement>(null)

  const hasChildren = node.children.length > 0
  const isSelected = selectedIds.includes(node.id)

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
    setDropPosition(null)
    try {
      const source = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (source.id === node.id) return
      if (source.parentId !== parentId) return

      const myIndex = siblingIds.indexOf(node.id)
      const insertIndex = dropPosition === 'below' ? myIndex + 1 : myIndex
      const insertBeforeId = siblingIds[insertIndex] === source.id
        ? siblingIds[insertIndex + 1] || null
        : siblingIds[insertIndex] || null

      if (insertBeforeId === source.id) return

      sendBridgeMessage({ type: 'reorder-element', id: source.id, parentId, insertBeforeId })
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
          selectElement(node.id, node.rect, node.label, e.shiftKey || e.metaKey || e.ctrlKey)
          if (!e.shiftKey && !e.metaKey && !e.ctrlKey && node.rect) panToElement(node.rect)
        }}
        onMouseEnter={() => hoverElement(node.id, node.rect)}
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

        {getNodeIcon(node.tag, isSelected, hasChildren)}

        <span className={
          isSelected ? 'text-brand-600 font-medium' :
          hasChildren ? 'text-ink-1' : 'text-ink-2'
        }>
          {node.label}
        </span>

        {getTagBadge(node.tag, isSelected, hasChildren)}
      </div>

      {expanded && hasChildren && node.children.map(child => (
        <LayerNode key={child.id} node={child} depth={depth + 1} parentId={node.id} siblingIds={node.children.map(c => c.id)} />
      ))}
    </>
  )
}

export function LayerTree() {
  const domTree = useEditorStore(s => s.domTree)
  const activePage = useEditorStore(s => s.pages.find(p => p.id === s.activePageId))

  return (
    <div>
      <div className="px-2 py-1.5 flex items-center gap-1.5 text-ink-3 font-medium">
        <FileIcon />
        {activePage?.title ? activePage.title + '页' : '页面'}
      </div>

      {domTree.length === 0 ? (
        <div className="px-4 py-6 text-center text-ink-3 text-[11px]">
          加载中...
        </div>
      ) : (
        domTree.map(node => (
          <LayerNode key={node.id} node={node} depth={1} parentId={null} siblingIds={domTree.map(n => n.id)} />
        ))
      )}
    </div>
  )
}
