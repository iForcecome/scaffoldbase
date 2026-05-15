import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Project } from '../services/api'
import {
  Plus, Folder, Trash2, Clock, ChevronRight,
  Sparkles, Search, LayoutGrid, List,
} from 'lucide-react'

type ViewMode = 'grid' | 'list'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'bg-amber-50 text-amber-700' },
  ready: { label: '就绪', color: 'bg-green-50 text-green-700' },
  exported: { label: '已导出', color: 'bg-blue-50 text-blue-700' },
  synced: { label: '已同步', color: 'bg-purple-50 text-purple-700' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

export default function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.projects.list()
      setProjects(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      setCreating(true)
      const p = await api.projects.create({ name: newName.trim(), description: newDesc.trim() })
      setShowCreate(false)
      setNewName('')
      setNewDesc('')
      navigate(`/editor/${p.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此项目？所有页面数据将被清除。')) return
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch {
      setError('删除失败')
    }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-linear-to-br from-surface-1 via-white to-brand-50/30">
      {/* Header */}
      <header className="border-b border-surface-3/60 glass sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md shadow-brand-500/20">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink-0 tracking-tight">SpecFlow</h1>
              <p className="text-[11px] text-ink-3 -mt-0.5">可视化产品原型工作台</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-brand-700 transition-colors shadow-sm shadow-brand-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新建项目
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="flex-1 flex items-center gap-2 bg-white border border-surface-3 rounded-lg px-3 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
              <Search className="w-4 h-4 text-ink-3" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索项目..."
                className="flex-1 text-sm outline-none bg-transparent placeholder:text-ink-3"
              />
            </div>
          </div>
          <div className="flex items-center gap-1 bg-surface-1 rounded-lg p-0.5 border border-surface-3">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-sm text-brand-600' : 'text-ink-3 hover:text-ink-1'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-600' : 'text-ink-3 hover:text-ink-1'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 cursor-pointer">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-ink-3">
            <div className="w-8 h-8 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin mb-4" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-ink-3">
            <Folder className="w-16 h-16 text-surface-4 mb-4" />
            <p className="text-lg font-medium text-ink-2 mb-1">
              {search ? '没有匹配的项目' : '还没有项目'}
            </p>
            <p className="text-sm text-ink-3 mb-6">
              {search ? '试试其他关键词' : '创建你的第一个项目开始设计'}
            </p>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className="h-10 px-5 rounded-lg bg-brand-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-brand-700 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                新建项目
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/editor/${p.id}`)}
                className="group bg-white rounded-xl border border-surface-3 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-100/40 transition-all cursor-pointer overflow-hidden"
              >
                <div className="h-36 bg-linear-to-br from-surface-1 to-surface-2 flex items-center justify-center relative">
                  <div className="grid grid-cols-2 gap-2 opacity-40 group-hover:opacity-60 transition-opacity">
                    <div className="w-16 h-10 rounded bg-brand-200/50" />
                    <div className="w-16 h-10 rounded bg-surface-4/60" />
                    <div className="w-16 h-6 rounded bg-surface-4/60" />
                    <div className="w-16 h-6 rounded bg-brand-100/50" />
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      className="p-1.5 rounded-lg bg-white/90 shadow-sm text-ink-3 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold text-ink-0 truncate">{p.name}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_MAP[p.status]?.color ?? 'bg-surface-2 text-ink-2'}`}>
                      {STATUS_MAP[p.status]?.label ?? p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-ink-3 line-clamp-2 mb-2">{p.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-3">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo(p.updatedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-surface-3 overflow-hidden">
            {filtered.map((p, i) => (
              <div
                key={p.id}
                onClick={() => navigate(`/editor/${p.id}`)}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-brand-50/30 transition-colors cursor-pointer ${i < filtered.length - 1 ? 'border-b border-surface-3/60' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-linear-to-br from-brand-50 to-brand-100 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-ink-0 truncate">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-ink-3 truncate">{p.description}</p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_MAP[p.status]?.color ?? 'bg-surface-2 text-ink-2'}`}>
                  {STATUS_MAP[p.status]?.label ?? p.status}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-ink-3 w-24 shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{timeAgo(p.updatedAt)}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-4 group-hover:text-brand-500" />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 slide-up"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-ink-0 mb-4">新建项目</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-1 mb-1.5">项目名称</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="例如：电商后台管理系统"
                  autoFocus
                  className="w-full h-10 px-3 rounded-lg border border-surface-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-1 mb-1.5">描述（可选）</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="简单描述项目目标..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-surface-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="h-9 px-4 rounded-lg border border-surface-3 text-sm font-medium text-ink-1 hover:bg-surface-1 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
                className="h-9 px-5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {creating ? '创建中...' : '创建并编辑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
