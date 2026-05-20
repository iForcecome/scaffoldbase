import { useState, useEffect, useCallback } from 'react'
import { Download, FileText, RefreshCw } from 'lucide-react'
import { useEditorStore, sendBridgeMessage } from '../../stores/editor-store'
import { useViewportStore } from '../../stores/viewport-store'
import { api } from '../../services/api'

const BODY_SF_ID = 'sf-0'

export function PagePropertiesSection() {
  const activePageId = useEditorStore(s => s.activePageId)
  const pages = useEditorStore(s => s.pages)
  const renamePage = useEditorStore(s => s.renamePage)
  const upgradePageToSchema = useEditorStore(s => s.upgradePageToSchema)
  const applySchemaOperations = useEditorStore(s => s.applySchemaOperations)
  const deviceWidth = useViewportStore(s => s.getDeviceWidth())
  const setCustomWidth = useViewportStore(s => s.setCustomWidth)

  const page = pages.find(p => p.id === activePageId)
  const projectId = useEditorStore(s => s.projectId)
  const projectName = useEditorStore(s => s.projectName)
  const [title, setTitle] = useState(page?.title ?? '')
  const [widthLocal, setWidthLocal] = useState(String(deviceWidth))
  const [minWidth, setMinWidth] = useState('')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [padValues, setPadValues] = useState<[string, string, string, string]>(['0', '0', '0', '0'])

  useEffect(() => {
    setTitle(page?.title ?? '')
  }, [page?.title])

  useEffect(() => {
    setWidthLocal(String(deviceWidth))
  }, [deviceWidth])

  const syncFromBridge = useCallback(() => {
    const handler = (e: MessageEvent) => {
      const d = e.data
      if (d?.type !== 'computed-style' || d.id !== BODY_SF_ID) return
      window.removeEventListener('message', handler)
      const s = d.styles as Record<string, string>
      const mw = s['min-width']
      if (mw && mw !== 'auto' && mw !== '0px') {
        setMinWidth(String(Math.round(parseFloat(mw))))
      }
      const bg = s['background-color']
      if (bg) setBgColor(bg)
      const pad = s['padding'] ?? '0'
      const parts = pad.replace(/px/g, '').trim().split(/\s+/).map((v: string) => String(Math.round(parseFloat(v) || 0)))
      if (parts.length === 1) setPadValues([parts[0], parts[0], parts[0], parts[0]])
      else if (parts.length === 2) setPadValues([parts[0], parts[1], parts[0], parts[1]])
      else if (parts.length === 3) setPadValues([parts[0], parts[1], parts[2], parts[1]])
      else setPadValues([parts[0], parts[1], parts[2], parts[3]])
    }
    window.addEventListener('message', handler)
    const timer = setTimeout(() => window.removeEventListener('message', handler), 5000)
    sendBridgeMessage({ type: 'get-computed-style', id: BODY_SF_ID })
    return () => { clearTimeout(timer); window.removeEventListener('message', handler) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(syncFromBridge, 600)
    return () => clearTimeout(timer)
  }, [activePageId, syncFromBridge])

  const updateBodyStyle = (prop: string, value: string) => {
    if (!activePageId) return
    applySchemaOperations(activePageId, [{ type: 'updateStyle', target: activePageId, styles: { [prop]: value } }])
  }

  const commitTitle = () => {
    if (title.trim() && title !== page?.title) {
      renamePage(activePageId, title.trim())
    }
  }

  const commitMinWidth = () => {
    const v = minWidth.trim()
    if (v === '' || v === '0') {
      updateBodyStyle('minWidth', '')
    } else {
      updateBodyStyle('minWidth', v + 'px')
    }
  }

  const handlePadChange = (index: number, value: string) => {
    const next = [...padValues] as [string, string, string, string]
    next[index] = value
    setPadValues(next)
    updateBodyStyle('padding', next.map(v => (v || '0') + 'px').join(' '))
  }

  const handleBgChange = (value: string) => {
    setBgColor(value)
    updateBodyStyle('backgroundColor', value)
  }

  const handleDownload = async (type: 'spec_json' | 'html_prd', scope: 'page' | 'project', pageId?: string | null) => {
    if (!projectId) return
    const base = projectName.trim() || 'specflow'
    if (type === 'spec_json') {
      await api.exports.downloadSpecJson(projectId, base, scope, pageId)
    } else {
      await api.exports.downloadHtmlPrd(projectId, base, scope, pageId)
    }
  }

  const handleUpgradeToSchema = () => {
    if (!page) return
    upgradePageToSchema(page.id)
  }

  const padLabels = ['上', '右', '下', '左']

  return (
    <div className="flex flex-col">
      {/* Page Title */}
      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">页面</div>
        {!page?.schema && (
          <button
            className="mb-3 w-full h-8 rounded-md border border-amber-200 bg-amber-50 text-xs font-medium text-amber-700 flex items-center justify-center gap-1.5 hover:bg-amber-100"
            onClick={handleUpgradeToSchema}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            从 DOM 重建 Schema
          </button>
        )}
        <div>
          <label className="text-[11px] text-ink-3 mb-1 block">页面标题</label>
          <input
            className="w-full bg-surface-1 rounded-md px-2 py-1.5 text-xs text-ink-0 outline-none focus:ring-1 focus:ring-brand-400"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
      </div>

      {/* Size */}
      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">尺寸</div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-3 w-14 shrink-0">画布宽度</span>
            <input
              className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 text-center outline-none focus:ring-1 focus:ring-brand-400 w-0"
              value={widthLocal}
              onChange={e => setWidthLocal(e.target.value)}
              onBlur={() => {
                const v = parseInt(widthLocal)
                if (!isNaN(v) && v >= 320) setCustomWidth(v)
                else setWidthLocal(String(deviceWidth))
              }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-3 w-14 shrink-0">最小宽度</span>
            <input
              className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 text-center outline-none focus:ring-1 focus:ring-brand-400 w-0"
              value={minWidth}
              placeholder="auto"
              onChange={e => setMinWidth(e.target.value)}
              onBlur={commitMinWidth}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            />
          </div>
        </div>
      </div>

      {/* Background */}
      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">背景</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-7 h-7 rounded-md border border-surface-3 cursor-pointer p-0.5"
            value={bgColor.startsWith('#') ? bgColor : '#ffffff'}
            onChange={e => handleBgChange(e.target.value)}
          />
          <input
            className="flex-1 bg-surface-1 rounded-md px-2 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
            value={bgColor}
            onChange={e => setBgColor(e.target.value)}
            onBlur={() => updateBodyStyle('backgroundColor', bgColor)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        </div>
      </div>

      {/* Padding */}
      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">内边距</div>
        <div className="grid grid-cols-4 gap-1">
          {padLabels.map((label, i) => (
            <div key={label} className="flex flex-col items-center">
              <input
                className="bg-surface-1 rounded px-1.5 py-1 text-[10px] font-mono text-ink-2 text-center w-full outline-none focus:ring-1 focus:ring-brand-400"
                value={padValues[i]}
                onChange={e => handlePadChange(i, e.target.value)}
              />
              <span className="text-[9px] text-ink-4 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">导出</div>
        <div className="grid gap-2">
          <button
            className="w-full h-8 rounded-md border border-surface-3 bg-white text-xs font-medium text-ink-1 flex items-center justify-center gap-1.5 hover:bg-surface-1"
            onClick={() => handleDownload('spec_json', 'page', activePageId)}
          >
            <Download className="w-3.5 h-3.5" />
            当前页 spec.json
          </button>
          <button
            className="w-full h-8 rounded-md border border-surface-3 bg-white text-xs font-medium text-ink-1 flex items-center justify-center gap-1.5 hover:bg-surface-1"
            onClick={() => handleDownload('html_prd', 'page', activePageId)}
          >
            <FileText className="w-3.5 h-3.5" />
            当前页 HTML PRD
          </button>
          <button
            className="w-full h-8 rounded-md border border-surface-3 bg-white text-xs font-medium text-ink-1 flex items-center justify-center gap-1.5 hover:bg-surface-1"
            onClick={() => handleDownload('spec_json', 'project')}
          >
            <Download className="w-3.5 h-3.5" />
            全部 spec.json
          </button>
          <button
            className="w-full h-8 rounded-md border border-surface-3 bg-white text-xs font-medium text-ink-1 flex items-center justify-center gap-1.5 hover:bg-surface-1"
            onClick={() => handleDownload('html_prd', 'project')}
          >
            <FileText className="w-3.5 h-3.5" />
            全部 HTML PRD
          </button>
        </div>
      </div>
    </div>
  )
}
