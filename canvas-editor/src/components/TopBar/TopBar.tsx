import {
  MousePointer2, ZoomIn, Square, Type, Plus,
  Monitor, Smartphone, Undo2, Redo2, Download,
  FlaskConical,
} from 'lucide-react'
import { useEditorStore, type Tool, type Device } from '../../stores/editor-store'

const tools: { id: Tool; icon: typeof MousePointer2; label: string; key: string }[] = [
  { id: 'select', icon: MousePointer2, label: '选择', key: 'V' },
  { id: 'zoom', icon: ZoomIn, label: '缩放', key: 'Z' },
  { id: 'marquee', icon: Square, label: '框选', key: 'M' },
  { id: 'text', icon: Type, label: '编辑文本', key: 'T' },
  { id: 'insert', icon: Plus, label: '插入组件', key: 'I' },
]

const devices: { id: Device; icon: typeof Monitor; label: string }[] = [
  { id: 'desktop', icon: Monitor, label: '桌面端' },
  { id: 'mobile', icon: Smartphone, label: '移动端' },
]

export function TopBar() {
  const pages = useEditorStore(s => s.pages)
  const activePageId = useEditorStore(s => s.activePageId)
  const setActivePage = useEditorStore(s => s.setActivePage)
  const activeTool = useEditorStore(s => s.activeTool)
  const setTool = useEditorStore(s => s.setTool)
  const device = useEditorStore(s => s.device)
  const setDevice = useEditorStore(s => s.setDevice)
  const undo = useEditorStore(s => s.undo)
  const redo = useEditorStore(s => s.redo)
  const undoStack = useEditorStore(s => s.undoStack)
  const redoStack = useEditorStore(s => s.redoStack)

  return (
    <header className="h-12 bg-white border-b border-surface-3 flex items-center px-4 gap-3 shrink-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 pr-3 border-r border-surface-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-purple-600 flex items-center justify-center">
          <FlaskConical className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight">SpecFlow</span>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center text-xs text-ink-3">
        <span className="breadcrumb-separator font-medium text-ink-2">
          订单管理系统
        </span>
        <span className="font-medium text-ink-1">
          {pages.find(p => p.id === activePageId)?.title}
        </span>
      </div>

      {/* Center Toolbar */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center bg-surface-1 rounded-lg p-0.5 gap-0.5">
          {tools.map((t, i) => (
            <span key={t.id} className="contents">
              {i === 3 && <div className="w-px h-5 bg-surface-3 mx-1" />}
              <button
                className={`relative group w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                  activeTool === t.id ? 'bg-brand-600/10 text-brand-600' : 'hover:bg-black/5 text-ink-1'
                }`}
                onClick={() => setTool(t.id)}
              >
                <t.icon className="w-4 h-4" />
                <span className="absolute bottom-[-32px] left-1/2 -translate-x-1/2 bg-ink-0 text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  {t.label} ({t.key})
                </span>
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Page switcher */}
        <div className="flex items-center bg-surface-1 rounded-lg p-0.5 text-xs">
          {pages.map(p => (
            <button
              key={p.id}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activePageId === p.id
                  ? 'bg-white shadow-sm text-ink-0'
                  : 'text-ink-3 hover:text-ink-1'
              }`}
              onClick={() => setActivePage(p.id)}
            >
              {p.title}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-surface-3" />

        {/* Device toggle */}
        <div className="flex items-center bg-surface-1 rounded-lg p-0.5">
          {devices.map(d => (
            <button
              key={d.id}
              className={`relative group w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                device === d.id ? 'bg-brand-600/10 text-brand-600' : 'hover:bg-black/5 text-ink-2'
              }`}
              onClick={() => setDevice(d.id)}
            >
              <d.icon className="w-4 h-4" />
              <span className="absolute bottom-[-32px] left-1/2 -translate-x-1/2 bg-ink-0 text-white text-[11px] px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {d.label}
              </span>
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-surface-3" />

        {/* Undo / Redo */}
        <button
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-black/5 transition-colors disabled:opacity-30"
          onClick={undo}
          disabled={undoStack.length === 0}
        >
          <Undo2 className="w-4 h-4 text-ink-3" />
        </button>
        <button
          className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-black/5 transition-colors disabled:opacity-30"
          onClick={redo}
          disabled={redoStack.length === 0}
        >
          <Redo2 className="w-4 h-4 text-ink-4" />
        </button>

        <div className="w-px h-5 bg-surface-3" />

        {/* Export */}
        <button className="h-8 px-3.5 rounded-lg bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-brand-700 transition-colors">
          <Download className="w-3.5 h-3.5" />
          导出
        </button>
      </div>
    </header>
  )
}
