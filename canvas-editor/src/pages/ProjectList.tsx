import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Project } from '../services/api'
import {
  Sparkles, Plus, Search, LayoutGrid, Paperclip, FolderOpen,
  ArrowRight, RotateCw, Zap, FileText, Image as ImageIcon, Code2,
  Heart, Eye, ChevronDown, Globe, X,
} from 'lucide-react'

type StatusFilter = 'all' | 'draft' | 'ready' | 'exported' | 'synced'
type SourceFilter = 'all' | 'chat' | 'material' | 'prd' | 'template'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:    { label: '草稿',   cls: 'bg-flame-500/15 text-flame-300' },
  ready:    { label: '就绪',   cls: 'bg-emerald-500/15 text-emerald-300' },
  exported: { label: '已导出', cls: 'bg-sky-500/15 text-sky-300' },
  synced:   { label: '已同步', cls: 'bg-violet-500/15 text-violet-300' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h 前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

interface InspirationItem {
  id: string
  title: string
  desc: string
  category: string
  categoryCls: string
  height: number
  gradient: string
  thumb: Array<{ cls: string; col: number; row: number }>
  likes: string
  featured?: boolean
}

const INSPIRATION: InspirationItem[] = [
  {
    id: 'i1', title: '小红书风格社区', desc: '瀑布流 + 沉浸式详情 · 6 页面',
    category: '内容社区', categoryCls: 'bg-pink-500/15 text-pink-300',
    height: 260, gradient: 'from-purple-900/30 via-bg-2 to-pink-900/20',
    thumb: [
      { cls: 'bg-purple-500/40', col: 6, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 3 },
      { cls: 'bg-pink-500/30', col: 4, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
      { cls: 'bg-purple-400/30', col: 2, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 2 },
      { cls: 'bg-bg-3', col: 2, row: 2 },
    ],
    likes: '1.2k',
  },
  {
    id: 'i2', title: '电商后台 v2', desc: '订单 / 商品 / 客户 · 12 页面',
    category: '电商', categoryCls: 'bg-flame-500/15 text-flame-300',
    height: 200, gradient: 'from-flame-900/40 via-bg-2 to-amber-900/30',
    thumb: [
      { cls: 'bg-flame-500/40', col: 6, row: 1 },
      { cls: 'bg-bg-3', col: 1, row: 3 },
      { cls: 'bg-flame-400/30', col: 3, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
      { cls: 'bg-amber-500/30', col: 3, row: 2 },
      { cls: 'bg-bg-3', col: 2, row: 2 },
      { cls: 'bg-bg-3', col: 5, row: 1 },
    ],
    likes: '856',
  },
  {
    id: 'i3', title: 'SaaS 数据看板', desc: '实时仪表盘 + 多租户 · 8 页面',
    category: 'SaaS', categoryCls: 'bg-sky-500/15 text-sky-300',
    height: 300, gradient: 'from-sky-900/40 via-bg-2 to-cyan-900/30',
    thumb: [
      { cls: 'bg-sky-500/40', col: 6, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 3 },
      { cls: 'bg-cyan-400/30', col: 2, row: 2 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 2 },
      { cls: 'bg-sky-400/30', col: 4, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
    ],
    likes: '3.4k', featured: true,
  },
  {
    id: 'i4', title: '健身打卡 App', desc: '移动端原型 · 训练计划 + 数据统计',
    category: '移动端', categoryCls: 'bg-emerald-500/15 text-emerald-300',
    height: 240, gradient: 'from-emerald-900/40 via-bg-2 to-teal-900/30',
    thumb: [
      { cls: 'bg-emerald-500/40', col: 4, row: 2 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
      { cls: 'bg-teal-400/30', col: 2, row: 2 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
      { cls: 'bg-emerald-400/30', col: 4, row: 1 },
    ],
    likes: '412',
  },
  {
    id: 'i5', title: 'CRM 客户管理', desc: '企业级 SaaS · 14 页面',
    category: 'B 端', categoryCls: 'bg-violet-500/15 text-violet-300',
    height: 220, gradient: 'from-violet-900/40 via-bg-2 to-fuchsia-900/30',
    thumb: [
      { cls: 'bg-violet-500/40', col: 6, row: 1 },
      { cls: 'bg-bg-3', col: 3, row: 2 },
      { cls: 'bg-fuchsia-400/30', col: 3, row: 1 },
      { cls: 'bg-bg-3', col: 3, row: 1 },
      { cls: 'bg-violet-400/30', col: 3, row: 1 },
      { cls: 'bg-bg-3', col: 3, row: 1 },
    ],
    likes: '627',
  },
  {
    id: 'i6', title: '教育 SaaS 平台', desc: '课程 / 班级 / 作业 · 由 PRD 反推',
    category: 'SaaS', categoryCls: 'bg-amber-500/15 text-amber-300',
    height: 280, gradient: 'from-amber-900/40 via-bg-2 to-orange-900/30',
    thumb: [
      { cls: 'bg-amber-500/40', col: 4, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 1 },
      { cls: 'bg-bg-3', col: 2, row: 3 },
      { cls: 'bg-orange-400/30', col: 4, row: 2 },
      { cls: 'bg-amber-400/30', col: 3, row: 1 },
      { cls: 'bg-bg-3', col: 3, row: 1 },
    ],
    likes: '289',
  },
  {
    id: 'i7', title: '本地生活下单', desc: '餐饮外卖 H5 · 9 页面',
    category: '移动端', categoryCls: 'bg-rose-500/15 text-rose-300',
    height: 210, gradient: 'from-rose-900/40 via-bg-2 to-red-900/30',
    thumb: [
      { cls: 'bg-rose-500/40', col: 6, row: 2 },
      { cls: 'bg-bg-3', col: 3, row: 2 },
      { cls: 'bg-red-400/30', col: 3, row: 2 },
    ],
    likes: '158',
  },
  {
    id: 'i8', title: '极简 Landing Page', desc: '单页面官网模板 · 文档级排版',
    category: 'Landing', categoryCls: 'bg-warm-3/15 text-warm-1',
    height: 260, gradient: 'from-bg-3 via-bg-2 to-bg-1',
    thumb: [
      { cls: 'bg-warm-4/20', col: 2, row: 4 },
      { cls: 'bg-warm-3/10', col: 4, row: 1 },
      { cls: 'bg-warm-4/20', col: 2, row: 2 },
      { cls: 'bg-warm-4/15', col: 2, row: 2 },
      { cls: 'bg-warm-3/10', col: 4, row: 1 },
    ],
    likes: '942',
  },
]

const STARTERS = [
  '电商后台管理系统',
  'SaaS 数据控制台',
  '内容社区 App',
  '上传 PRD 反推',
  '竞品截图复刻',
]

const FAQS = [
  {
    q: '上传的物料是怎么用的？会泄露吗？',
    a: '物料只用于当次项目的 AI 上下文，存储在你的项目内的 Material Library 里。我们不会用你的数据训练任何模型；项目设为私有时仅你本人可访问。',
  },
  {
    q: '生成的 HTML 能直接上线吗？',
    a: '可以。我们提供三档 Quality Preset：Quick MVP / Production Ready / Enterprise，导出的项目骨架内置测试、CI、安全配置（RLS、XSS、Rate Limiting）。',
  },
  {
    q: '支持哪些后端 / 数据库？',
    a: '默认 Supabase（含 RLS 自动生成），可切换 Convex / Firebase / 自定义 BaaS。Spec 里的数据模型会自动产出迁移脚本与 Zod schema。',
  },
  {
    q: '能跟 Cursor / Claude Code 配合吗？',
    a: '可以。SpecFlow 提供 MCP Server，导出项目时自动生成 .cursorrules 与 spec.json，Cursor 读到即遵守工程规范；Claude Code 可通过 MCP 实时校验代码是否符合 Spec。',
  },
  {
    q: '免费版有什么限制？',
    a: '免费版每月 30 次生成、5 个项目、单文件物料 10MB。付费版无限生成、私有项目、团队协作与高级模型选项。',
  },
]

function getFileStem(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim() || name
}

function isHtmlFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.html') || file.type === 'text/html'
}

function isTextLikeFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return file.type.startsWith('text/') ||
    ['.html', '.htm', '.md', '.txt', '.json', '.csv', '.xml', '.svg'].some(ext => name.endsWith(ext))
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

async function readFileContent(file: File): Promise<string> {
  return isTextLikeFile(file) ? file.text() : readFileAsDataUrl(file)
}

export default function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [openFaq, setOpenFaq] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const data = await api.projects.list()
      setProjects(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleGenerate = async () => {
    const text = prompt.trim()
    if ((!text && files.length === 0) || generating) return
    try {
      setGenerating(true)
      const metaInput = text || `上传物料：${files.map(file => getFileStem(file.name)).join('、')}`
      const meta = await api.projects.deriveMeta(metaInput)
      const ingestionMaterials = await Promise.all(files.map(async (file) => ({
        filename: file.name,
        mimeType: file.type || (isHtmlFile(file) ? 'text/html' : 'application/octet-stream'),
        content: await readFileContent(file),
        intendedUse: isHtmlFile(file) ? 'page' as const : 'auto' as const,
      })))
      const project = await api.projects.create({
        name: meta.name,
        description: meta.description,
        ingestionMaterials,
      })
      if (text) {
        sessionStorage.setItem(`sf:pendingPrompt:${project.id}`, text)
      }
      navigate(`/editor/${project.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败')
      setGenerating(false)
    }
  }

  const handleStarterClick = (s: string) => {
    setPrompt(s)
    promptRef.current?.focus()
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('确定删除此项目？所有页面数据将被清除。')) return
    try {
      await api.projects.delete(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch {
      setError('删除失败')
    }
  }

  const onFilesPicked = (list: FileList | null) => {
    if (!list) return
    setFiles(prev => [...prev, ...Array.from(list)])
  }

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (search && !`${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [projects, statusFilter, search])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length, draft: 0, ready: 0, exported: 0, synced: 0 }
    projects.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1 })
    return counts
  }, [projects])

  const focusPrompt = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => promptRef.current?.focus(), 400)
  }

  const canSend = prompt.trim().length > 0 || files.length > 0

  return (
    <div className="min-h-screen bg-bg-0 text-warm-0 font-sans overflow-x-hidden">
      {/* ============== NAV ============== */}
      <nav className="sticky top-0 z-40 bg-bg-0/85 backdrop-blur-xl border-b border-line-1">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-flame-400 via-flame-500 to-flame-700 flex items-center justify-center shadow-lg shadow-flame-600/30">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-[22px] font-bold gradient-flame leading-none">SpecFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-1 text-[14px]">
            <a className="px-3 py-1.5 rounded-md text-warm-0 hover:text-flame-300 transition-colors font-medium cursor-pointer">首页</a>
            <a className="px-3 py-1.5 rounded-md text-warm-2 hover:text-warm-0 transition-colors relative cursor-pointer">
              新建项目
              <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-gradient-to-r from-flame-400 to-flame-600 text-white rounded-full">NEW</span>
            </a>
            <a className="px-3 py-1.5 rounded-md text-warm-2 hover:text-warm-0 transition-colors cursor-pointer">物料库</a>
            <a className="px-3 py-1.5 rounded-md text-warm-2 hover:text-warm-0 transition-colors cursor-pointer">模板市场</a>
            <a className="px-3 py-1.5 rounded-md text-warm-2 hover:text-warm-0 transition-colors flex items-center gap-1 cursor-pointer">
              定价 <ChevronDown className="w-3 h-3 opacity-60" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden md:flex items-center gap-1.5 h-9 px-3 rounded-md text-[13px] text-warm-2 hover:text-warm-0 hover:bg-bg-2 transition-colors cursor-pointer">
              <Globe className="w-4 h-4" /> 简体中文
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-flame-400 to-flame-700 ring-2 ring-bg-0 text-white text-[12px] font-semibold flex items-center justify-center">KZ</div>
          </div>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <section className="relative overflow-hidden home-grain">
        <div className="absolute inset-0 glow-bg pointer-events-none" />
        <div className="absolute top-40 -left-32 w-[420px] h-[420px] bg-flame-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 -right-32 w-[480px] h-[480px] bg-amber-700/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-12">
          <div className="flex items-center justify-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-flame-400 via-flame-500 to-flame-700 shadow-xl shadow-flame-600/40 flex items-center justify-center ring-4 ring-flame-500/10">
              <Sparkles className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="font-display text-5xl md:text-6xl font-bold gradient-flame tracking-tight leading-none">SpecFlow</h1>
          </div>

          <p className="text-center text-warm-1 text-[18px] md:text-[20px] mb-3 font-medium">
            在几分钟内产出<strong className="text-warm-0">可交付的产品方案</strong>
          </p>
          <div className="text-center text-warm-3 text-[13px] mb-7 flex items-center justify-center gap-2">
            <span className="text-flame-400">✦</span>
            全球首个对话式 HTML 原型 + PRD + Spec 一体化工具
            <span className="text-flame-400">✦</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
            <PillBadge className="bg-gradient-to-br from-flame-500 to-flame-700">100% 免费起步</PillBadge>
            <PillBadge className="bg-gradient-to-br from-emerald-500 to-emerald-700">由 Claude 4.6 驱动</PillBadge>
            <PillBadge className="bg-gradient-to-br from-sky-500 to-sky-700">无需登录</PillBadge>
            <PillBadge className="bg-gradient-to-br from-violet-500 to-violet-700">导出即可上线</PillBadge>
          </div>

          {/* Generator Card */}
          <div className="bg-bg-1/90 rounded-2xl border border-line-2 glow-input overflow-hidden">
            <div className="px-6 pt-6 pb-3 flex items-end justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-display text-[26px] font-bold text-warm-0 leading-none mb-1">产品方案生成器</h2>
                <div className="text-[12px] text-warm-3">描述需求 · 上传物料 · 引用模板</div>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-warm-3">
                <span className="text-flame-400">🇬🇧</span>
                中英文皆可，<span className="text-flame-300">英文提示词</span>效果更稳
              </div>
            </div>

            <div className="px-6 pb-4">
              <div className="flex gap-4">
                <label
                  htmlFor="homepage-material-upload"
                  className={`shrink-0 w-[120px] h-[140px] rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center cursor-pointer group ${
                    dragActive
                      ? 'border-flame-500 bg-flame-500/10 text-flame-300'
                      : 'border-line-3 hover:border-flame-500 hover:bg-flame-500/5 text-warm-3 hover:text-flame-400'
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragActive(false)
                    onFilesPicked(event.dataTransfer.files)
                  }}
                >
                  <div className="w-9 h-9 rounded-full bg-bg-3 group-hover:bg-flame-500/10 flex items-center justify-center mb-2 transition-colors">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div className="text-[11px] font-medium">添加物料</div>
                  <div className="text-[10px] text-warm-4 mt-0.5">HTML/PDF/MD</div>
                </label>
                <input
                  id="homepage-material-upload"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.md,.docx,.html,.htm,.zip,text/html"
                  className="hidden"
                  onClick={(event) => { event.currentTarget.value = '' }}
                  onChange={(e) => { onFilesPicked(e.target.files); e.target.value = '' }}
                />
                <textarea
                  ref={promptRef}
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault(); handleGenerate()
                    }
                  }}
                  placeholder={'描述您想做的产品...\n\n例如：做一个面向小团队的项目管理后台，包含任务看板、迭代计划、成员权限管理。要求 Production Ready 质量，支持深色模式'}
                  className="flex-1 bg-transparent text-[16px] leading-relaxed text-warm-0 placeholder:text-warm-4 resize-none outline-none py-1"
                />
              </div>

              {files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-bg-3 border border-line-2 rounded-md text-[11px] text-warm-1">
                      <FileIcon name={f.name} />
                      <span className="max-w-[140px] truncate">{f.name}</span>
                      <button onClick={() => removeFile(i)} className="text-warm-3 hover:text-flame-400 ml-1 cursor-pointer" type="button">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-3 bg-bg-2/60 border-t border-line-1 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <button className="h-9 px-3 rounded-lg bg-bg-3 border border-line-2 text-[13px] text-warm-1 hover:bg-bg-4 transition-colors flex items-center gap-2 cursor-pointer" type="button">
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-flame-400 to-flame-600 flex items-center justify-center text-[9px] font-bold text-white">PR</span>
                  Production Ready
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                <button className="h-9 px-3 rounded-lg text-[13px] text-warm-1 hover:bg-bg-3 transition-colors flex items-center gap-2 cursor-pointer" type="button">
                  <span className="relative inline-flex items-center w-9 h-5 bg-flame-600 rounded-full">
                    <span className="absolute right-0.5 w-4 h-4 bg-white rounded-full shadow" />
                  </span>
                  <Zap className="w-3.5 h-3.5 text-flame-400" fill="currentColor" />
                  快速模式
                </button>
                <button className="h-9 px-3 rounded-lg text-[13px] text-warm-3 hover:bg-bg-3 hover:text-warm-1 transition-colors flex items-center gap-2 cursor-pointer" type="button">
                  <span className="relative inline-flex items-center w-9 h-5 bg-bg-4 rounded-full">
                    <span className="absolute left-0.5 w-4 h-4 bg-warm-3 rounded-full" />
                  </span>
                  生成 PRD
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPrompt('')} className="h-9 px-3 text-[13px] text-warm-3 hover:text-warm-0 transition-colors cursor-pointer" type="button">清除</button>
                <button className="h-9 px-3 text-[13px] text-warm-3 hover:text-warm-0 transition-colors flex items-center gap-1.5 cursor-pointer" type="button">
                  <RotateCw className="w-3.5 h-3.5" /> 随机
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={!canSend || generating}
                  className="relative h-9 px-5 rounded-lg bg-gradient-to-br from-flame-500 to-flame-700 text-white text-[13px] font-semibold flex items-center gap-2 hover:from-flame-400 hover:to-flame-600 transition-all glow-btn disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  type="button"
                >
                  {generating ? '创建中...' : '生成'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[12px] text-warm-3 mr-1">试试 →</span>
            {STARTERS.map(s => (
              <button
                key={s}
                onClick={() => handleStarterClick(s)}
                className="px-3 py-1.5 rounded-full bg-bg-2 border border-line-2 text-[12px] text-warm-1 hover:border-flame-500 hover:text-flame-300 transition-colors cursor-pointer"
                type="button"
              >{s}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ============== MY PROJECTS ============== */}
      <section className="relative pt-16 pb-20 border-t border-line-1 bg-bg-1/40">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-warm-0 tracking-tight">我的项目</h2>
              <p className="text-[13px] text-warm-3 mt-1">
                {loading ? '加载中...' : `共 ${projects.length} 个项目 · 草稿自动保留 24 小时`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 h-9 px-3 bg-bg-2 border border-line-2 rounded-lg focus-within:border-flame-500">
                <Search className="w-3.5 h-3.5 text-warm-3" />
                <input
                  className="bg-transparent text-[13px] outline-none w-44 text-warm-0 placeholder:text-warm-3"
                  placeholder="搜索项目名 / 描述..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="h-9 w-9 rounded-lg bg-bg-2 border border-line-2 text-warm-2 hover:text-warm-0 flex items-center justify-center cursor-pointer" title="网格" type="button">
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Status & source filters */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>全部 · {statusCounts.all}</FilterPill>
            <FilterPill active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')}>草稿 · {statusCounts.draft}</FilterPill>
            <FilterPill active={statusFilter === 'ready'} onClick={() => setStatusFilter('ready')}>就绪 · {statusCounts.ready}</FilterPill>
            <FilterPill active={statusFilter === 'exported'} onClick={() => setStatusFilter('exported')}>已导出 · {statusCounts.exported}</FilterPill>
            <FilterPill active={statusFilter === 'synced'} onClick={() => setStatusFilter('synced')}>已同步 · {statusCounts.synced}</FilterPill>
            <div className="h-5 w-px bg-line-2 mx-1" />
            <span className="text-[11px] text-warm-3">来源</span>
            {(['all','chat','material','prd','template'] as const).map(s => (
              <SourcePill key={s} active={sourceFilter === s} onClick={() => setSourceFilter(s)}>
                {({all:'全部', chat:'Chat 创建', material:'物料上传', prd:'PRD 解析', template:'模板'} as const)[s]}
              </SourcePill>
            ))}
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-flame-900/30 border border-flame-700/50 text-flame-300 text-[13px] flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-flame-400/70 hover:text-flame-300 cursor-pointer" type="button">✕</button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-warm-3">
              <div className="w-8 h-8 border-2 border-flame-700 border-t-flame-400 rounded-full animate-spin mb-3" />
              <span className="text-[13px]">加载中...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProjects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onClick={() => navigate(`/editor/${p.id}`)}
                  onDelete={(e) => handleDelete(p.id, e)}
                />
              ))}
              <button
                onClick={focusPrompt}
                className="home-card-lift group bg-gradient-to-br from-flame-900/15 via-bg-1 to-bg-1 rounded-xl border-2 border-dashed border-line-3 hover:border-flame-500 overflow-hidden flex flex-col items-center justify-center h-[200px] text-warm-3 hover:text-flame-300 transition-colors cursor-pointer"
                type="button"
              >
                <div className="w-10 h-10 rounded-full bg-bg-2 border border-line-3 group-hover:border-flame-500 flex items-center justify-center mb-2 transition-colors">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="text-[13px] font-semibold text-warm-1 mb-0.5">新建项目</div>
                <div className="text-[11px] text-warm-3">回到顶部，开始对话</div>
              </button>
            </div>
          )}

          {!loading && filteredProjects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-warm-3">
              <FolderOpen className="w-14 h-14 text-bg-4 mb-3" />
              <p className="text-[15px] font-medium text-warm-1 mb-1">
                {search || statusFilter !== 'all' ? '没有匹配的项目' : '还没有项目'}
              </p>
              <p className="text-[12px] text-warm-3">
                {search || statusFilter !== 'all' ? '试试其他关键词或筛选' : '回到顶部，描述你的第一个产品'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ============== INSPIRATION GALLERY ============== */}
      <section className="relative pt-16 pb-20 border-t border-line-1">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="text-center mb-3">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-warm-0 tracking-tight">获取灵感</h2>
          </div>
          <p className="text-center text-warm-3 text-[14px] mb-10">从 SpecFlow 社区的创作中获取灵感 · 一键复用为你的项目起点</p>

          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {['全部', 'SaaS 后台', '电商', '内容社区', '移动端', '官网/Landing', 'B 端工具'].map((t, i) => (
              <FilterPill key={t} active={i === 0} onClick={() => {}}>{t}</FilterPill>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {INSPIRATION.map(item => <InspirationCard key={item.id} item={item} />)}
          </div>

          <div className="mt-10 text-center">
            <button className="h-10 px-6 rounded-lg bg-bg-2 border border-line-2 text-[13px] text-warm-1 hover:border-flame-500 hover:text-flame-300 transition-colors cursor-pointer" type="button">
              浏览全部 2,341 个方案 →
            </button>
          </div>
        </div>
      </section>

      {/* ============== HOW IT WORKS ============== */}
      <section className="relative pt-20 pb-20 border-t border-line-1">
        <div className="absolute inset-0 glow-bg pointer-events-none opacity-50" />
        <div className="relative max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="text-[11px] uppercase tracking-[0.2em] text-flame-400 font-semibold mb-2">How it works</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-warm-0 tracking-tight">三步，从想法到可交付</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 relative">
            <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-flame-500/40 to-transparent" />
            <StepCard num={1} gradient="from-flame-400 to-flame-700" shadow="shadow-flame-600/30" title="描述 / 上传" desc="输入一句话需求，或丢入图片 / PRD / HTML 物料，立即建立草稿项目。" hint="≤ 2 秒" />
            <StepCard num={2} gradient="from-amber-400 to-flame-700" shadow="shadow-amber-600/30" title="AI 消化产出" desc="多模态理解所有物料，生成可交互 HTML 原型与结构化 Spec。" hint="首屏 ≤ 15 秒" />
            <StepCard num={3} gradient="from-rose-400 to-flame-700" shadow="shadow-rose-600/30" title="精修 → 导出" desc="画布对话式微调，一键导出 PRD / 项目骨架 / spec.json。" hint="含测试 / CI" />
          </div>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section className="relative pt-16 pb-20 border-t border-line-1 bg-bg-1/40">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <div className="text-[11px] uppercase tracking-[0.2em] text-flame-400 font-semibold mb-2">FAQ</div>
            <h2 className="font-display text-4xl font-bold text-warm-0 tracking-tight">常见问题</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className="bg-bg-1 border border-line-2 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  className="w-full px-5 py-4 cursor-pointer flex items-center justify-between text-warm-0 font-semibold text-[14px] text-left"
                  type="button"
                >
                  {f.q}
                  <ChevronDown className={`w-4 h-4 text-warm-3 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[13px] text-warm-2 leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== BOTTOM CTA ============== */}
      <section className="relative py-20 border-t border-line-1 overflow-hidden">
        <div className="absolute inset-0 glow-bg pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-flame-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold gradient-flame tracking-tight leading-tight mb-5">
            从一句话开始
          </h2>
          <p className="text-warm-2 text-[16px] mb-8">免费起步，无需信用卡，5 秒内进入编辑器。</p>
          <button
            onClick={focusPrompt}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-gradient-to-br from-flame-500 to-flame-700 text-white font-semibold text-[15px] hover:from-flame-400 hover:to-flame-600 transition-all glow-btn cursor-pointer"
            type="button"
          >
            立即开始生成 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="border-t border-line-1 bg-bg-0">
        <div className="max-w-[1280px] mx-auto px-6 py-10">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-flame-400 to-flame-700" />
                <span className="font-display text-lg font-bold gradient-flame">SpecFlow</span>
              </div>
              <p className="text-[12px] text-warm-3 leading-relaxed max-w-xs">
                对话式 HTML 原型 + PRD + Spec 一体化工具，PM 与创业者的 AI 产品设计工作台。
              </p>
            </div>
            <FooterCol title="产品" items={['画布编辑器', '物料库', '模板市场', 'MCP 集成']} />
            <FooterCol title="资源" items={['文档', '变更日志', 'PRD 模板', 'API 参考']} />
            <FooterCol title="公司" items={['关于', '定价', '联系我们', '隐私 / 条款']} />
          </div>
          <div className="pt-6 border-t border-line-1 flex items-center justify-between text-[11px] text-warm-4 flex-wrap gap-3">
            <div>© 2026 SpecFlow · Made with care in 杭州</div>
            <div className="flex items-center gap-4">
              <a className="hover:text-flame-300 cursor-pointer">Twitter</a>
              <a className="hover:text-flame-300 cursor-pointer">GitHub</a>
              <a className="hover:text-flame-300 cursor-pointer">微信公众号</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ===================== Sub Components ===================== */

function PillBadge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold text-white ${className}`}
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 14px -4px rgba(0,0,0,0.4)' }}
    >
      {children}
    </span>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`px-4 py-1.5 rounded-full text-[12px] font-medium border transition-all cursor-pointer ${
        active
          ? 'bg-gradient-to-br from-flame-500 to-flame-700 text-white border-transparent shadow-md shadow-flame-600/40'
          : 'bg-bg-2 text-warm-2 border-line-2 hover:text-warm-0 hover:border-line-3'
      }`}
    >{children}</button>
  )
}

function SourcePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`px-2.5 py-1 rounded-full border text-[11px] transition-colors cursor-pointer ${
        active
          ? 'bg-bg-3 text-flame-300 border-line-3'
          : 'bg-bg-2 text-warm-2 border-line-2 hover:text-warm-0'
      }`}
    >{children}</button>
  )
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png','jpg','jpeg','gif','webp'].includes(ext)) return <ImageIcon className="w-3 h-3" />
  if (ext === 'html') return <Code2 className="w-3 h-3" />
  if (ext === 'pdf' || ext === 'md' || ext === 'docx') return <FileText className="w-3 h-3" />
  return <Paperclip className="w-3 h-3" />
}

function ProjectCard({ project, onClick, onDelete }: {
  project: Project
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const status = STATUS_META[project.status] ?? { label: project.status, cls: 'bg-bg-3 text-warm-2' }
  const isDraft = project.status === 'draft'

  return (
    <div
      onClick={onClick}
      className={`home-card-lift group relative bg-bg-1 rounded-xl border overflow-hidden cursor-pointer ${
        isDraft ? 'border-flame-500/40' : 'border-line-2'
      }`}
    >
      <div className="h-32 bg-gradient-to-br from-flame-900/25 via-bg-2 to-amber-900/20 relative">
        <div className="home-thumb-grid">
          <div className="bg-flame-500/30" style={{ gridColumn: 'span 6', gridRow: 'span 1' }} />
          <div className="bg-bg-3" style={{ gridColumn: 'span 2', gridRow: 'span 3' }} />
          <div className="bg-flame-400/30" style={{ gridColumn: 'span 4', gridRow: 'span 1' }} />
          <div className="bg-bg-3" style={{ gridColumn: 'span 2', gridRow: 'span 1' }} />
          <div className="bg-amber-500/30" style={{ gridColumn: 'span 2', gridRow: 'span 1' }} />
          <div className="bg-bg-3" style={{ gridColumn: 'span 2', gridRow: 'span 2' }} />
          <div className="bg-bg-3" style={{ gridColumn: 'span 2', gridRow: 'span 2' }} />
        </div>
        <button
          onClick={onDelete}
          type="button"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md bg-bg-0/80 border border-line-2 text-warm-2 hover:text-flame-300 transition-opacity cursor-pointer"
          title="删除"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="p-3.5">
        <h3 className="text-[13px] font-semibold text-warm-0 truncate mb-1">{project.name}</h3>
        <p className="text-[11px] text-warm-3 line-clamp-1 mb-2">{project.description || '暂无描述'}</p>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className={`px-1.5 py-0.5 rounded font-medium ${status.cls}`}>{status.label}</span>
          <span className="ml-auto text-warm-3">{timeAgo(project.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

function InspirationCard({ item }: { item: InspirationItem }) {
  return (
    <div className="home-card-lift group bg-bg-1 rounded-2xl border border-line-2 overflow-hidden cursor-pointer">
      <div className={`bg-gradient-to-br ${item.gradient} relative overflow-hidden`} style={{ height: item.height }}>
        {item.featured && (
          <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-full bg-flame-500 text-white text-[10px] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white blink2" /> 精选
          </div>
        )}
        <div className="home-thumb-grid">
          {item.thumb.map((t, i) => (
            <div key={i} className={t.cls} style={{ gridColumn: `span ${t.col}`, gridRow: `span ${t.row}` }} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-bg-0/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5">
            <button className="flex-1 h-7 rounded-md bg-flame-600 text-white text-[11px] font-semibold hover:bg-flame-500 cursor-pointer" type="button">复用为我的</button>
            <button className="h-7 w-7 rounded-md bg-bg-2 border border-line-2 text-warm-2 hover:text-flame-300 flex items-center justify-center cursor-pointer" title="预览" type="button">
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="p-3.5">
        <h3 className="text-[14px] font-semibold text-warm-0 truncate mb-1">{item.title}</h3>
        <p className="text-[11px] text-warm-3 line-clamp-1 mb-2">{item.desc}</p>
        <div className="flex items-center justify-between text-[11px] text-warm-3">
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" fill="currentColor" /> {item.likes}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.categoryCls}`}>{item.category}</span>
        </div>
      </div>
    </div>
  )
}

function StepCard({ num, gradient, shadow, title, desc, hint }: {
  num: number; gradient: string; shadow: string; title: string; desc: string; hint: string
}) {
  return (
    <div className="relative bg-bg-1 border border-line-2 rounded-2xl p-6 text-center">
      <div className={`w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br ${gradient} text-white font-display text-2xl font-bold flex items-center justify-center shadow-lg ${shadow}`}>{num}</div>
      <div className="font-display text-xl font-bold text-warm-0 mb-2">{title}</div>
      <p className="text-[13px] text-warm-2 leading-relaxed">{desc}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-[11px] text-warm-3 px-2 py-0.5 rounded-full bg-bg-2 border border-line-2">{hint}</div>
    </div>
  )
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-warm-1 mb-3">{title}</div>
      <ul className="space-y-2 text-[12px] text-warm-3">
        {items.map(i => <li key={i}><a className="hover:text-flame-300 transition-colors cursor-pointer">{i}</a></li>)}
      </ul>
    </div>
  )
}
