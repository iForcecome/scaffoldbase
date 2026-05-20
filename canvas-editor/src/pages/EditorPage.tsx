import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TopBar } from '../components/TopBar/TopBar'
import { LeftPanel } from '../components/LeftPanel/LeftPanel'
import { CanvasArea } from '../components/Canvas/CanvasArea'
import { RightPanel } from '../components/RightPanel/RightPanel'
import { useEditorStore } from '../stores/editor-store'
import { useToolStore } from '../stores/tool-store'
import { useChatStore } from '../stores/chat-store'
import { api } from '../services/api'

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const isPreview = useToolStore(s => s.activeTool === 'preview')
  const setTool = useToolStore(s => s.setTool)
  const loadProject = useEditorStore(s => s.loadProject)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      navigate('/')
      return
    }

    let cancelled = false

    async function init() {
      try {
        setLoading(true)
        setError(null)
        const project = await api.projects.get(projectId!)
        if (cancelled) return

        const pages = await api.pages.list(projectId!)
        if (cancelled) return

        loadProject(projectId!, project.name, pages)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '加载项目失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [projectId, navigate, loadProject])

  useEffect(() => {
    if (loading || !projectId) return
    const key = `sf:pendingPrompt:${projectId}`
    const pending = sessionStorage.getItem(key)
    if (!pending) return
    sessionStorage.removeItem(key)
    useChatStore.getState().sendMessage(pending)
  }, [loading, projectId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const tool = useToolStore.getState()
      if (e.key === 'p' || e.key === 'P') {
        if (tool.activeTool !== 'preview') {
          setTool('preview')
        }
      }
      if (e.key === 'Escape' && tool.activeTool === 'preview') {
        setTool('select')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setTool])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty()) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas-bg">
        <div className="flex flex-col items-center gap-3 text-ink-3">
          <div className="w-8 h-8 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
          <span className="text-sm">加载项目中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-canvas-bg">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-2xl">!</span>
          </div>
          <p className="text-sm text-ink-2">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="h-9 px-4 rounded-lg border border-surface-3 text-sm font-medium text-ink-1 hover:bg-surface-1 transition-colors cursor-pointer"
            >
              返回项目列表
            </button>
            <button
              onClick={() => window.location.reload()}
              className="h-9 px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-canvas-bg font-sans text-ink-0 select-none">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        {!isPreview && <LeftPanel />}
        <CanvasArea />
        {!isPreview && <RightPanel />}
      </div>
    </div>
  )
}
