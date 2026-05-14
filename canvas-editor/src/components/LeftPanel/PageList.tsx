import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown, ChevronRight, Plus, File, MoreHorizontal,
  Copy, Trash2, Pencil,
} from 'lucide-react'
import { useEditorStore } from '../../stores/editor-store'

export function PageList() {
  const pages = useEditorStore(s => s.pages)
  const activePageId = useEditorStore(s => s.activePageId)
  const setActivePage = useEditorStore(s => s.setActivePage)
  const addPage = useEditorStore(s => s.addPage)
  const deletePage = useEditorStore(s => s.deletePage)
  const duplicatePage = useEditorStore(s => s.duplicatePage)
  const renamePage = useEditorStore(s => s.renamePage)

  const [collapsed, setCollapsed] = useState(false)
  const [menuPageId, setMenuPageId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renamingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renamingId])

  useEffect(() => {
    if (!menuPageId) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPageId(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuPageId])

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renamePage(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  return (
    <div className="border-b border-surface-3">
      {/* Header */}
      <button
        className="w-full h-8 px-3 flex items-center justify-between hover:bg-surface-1 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-2 uppercase tracking-wider">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          页面
          <span className="text-ink-3 font-normal normal-case tracking-normal">({pages.length})</span>
        </div>
        <div
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-surface-2 text-ink-3"
          onClick={(e) => { e.stopPropagation(); addPage() }}
        >
          <Plus className="w-3 h-3" />
        </div>
      </button>

      {/* Page list */}
      {!collapsed && (
        <div className="pb-1">
          {pages.map(p => (
            <div key={p.id} className="relative group">
              <div
                className={`mx-1 h-7 px-2 flex items-center gap-1.5 rounded cursor-pointer text-xs transition-colors ${
                  activePageId === p.id
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-1 hover:bg-surface-1'
                }`}
                onClick={() => setActivePage(p.id)}
                onDoubleClick={() => {
                  setRenamingId(p.id)
                  setRenameValue(p.title)
                }}
              >
                <File className="w-3 h-3 shrink-0 opacity-60" />

                {renamingId === p.id ? (
                  <input
                    ref={inputRef}
                    className="flex-1 min-w-0 bg-white border border-brand-300 rounded px-1 py-0 text-xs outline-none"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate">{p.title}</span>
                )}

                {renamingId !== p.id && (
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-surface-2 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuPageId(menuPageId === p.id ? null : p.id)
                    }}
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Context menu */}
              {menuPageId === p.id && (
                <div
                  ref={menuRef}
                  className="absolute right-1 top-7 z-50 bg-white border border-surface-3 rounded-lg shadow-lg py-1 w-32"
                >
                  <button
                    className="w-full h-7 px-3 flex items-center gap-2 text-xs text-ink-1 hover:bg-surface-1"
                    onClick={() => {
                      setRenamingId(p.id)
                      setRenameValue(p.title)
                      setMenuPageId(null)
                    }}
                  >
                    <Pencil className="w-3 h-3" /> 重命名
                  </button>
                  <button
                    className="w-full h-7 px-3 flex items-center gap-2 text-xs text-ink-1 hover:bg-surface-1"
                    onClick={() => {
                      duplicatePage(p.id)
                      setMenuPageId(null)
                    }}
                  >
                    <Copy className="w-3 h-3" /> 复制页面
                  </button>
                  {pages.length > 1 && (
                    <button
                      className="w-full h-7 px-3 flex items-center gap-2 text-xs text-red-500 hover:bg-red-50"
                      onClick={() => {
                        deletePage(p.id)
                        setMenuPageId(null)
                      }}
                    >
                      <Trash2 className="w-3 h-3" /> 删除页面
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
