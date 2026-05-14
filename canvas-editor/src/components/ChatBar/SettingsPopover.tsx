import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getAIConfig, setAIConfig } from '../../services/ai-service'
import { X } from 'lucide-react'

export function SettingsPopover({ anchorRef, onClose }: { anchorRef: React.RefObject<HTMLElement | null>; onClose: () => void }) {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  useEffect(() => {
    const cfg = getAIConfig()
    setApiKey(cfg.apiKey)
    setBaseUrl(cfg.baseUrl)
    setModel(cfg.model)
  }, [])

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({
        bottom: window.innerHeight - rect.top + 8,
        left: Math.max(16, rect.left),
      })
    }
  }, [anchorRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const save = () => {
    setAIConfig({ apiKey, baseUrl, model })
    onClose()
  }

  return createPortal(
    <div
      ref={ref}
      className="fixed w-80 bg-white rounded-xl shadow-xl border border-surface-3 p-4 z-[9999]"
      style={{ bottom: pos.bottom, left: pos.left }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-ink-1">AI 设置</span>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-surface-2">
          <X className="w-3 h-3 text-ink-3" />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[11px] text-ink-3 mb-1 block">API Key</label>
          <input
            type="password"
            className="w-full bg-surface-1 rounded-md px-2.5 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>
        <div>
          <label className="text-[11px] text-ink-3 mb-1 block">Base URL</label>
          <input
            className="w-full bg-surface-1 rounded-md px-2.5 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com"
          />
        </div>
        <div>
          <label className="text-[11px] text-ink-3 mb-1 block">Model</label>
          <input
            className="w-full bg-surface-1 rounded-md px-2.5 py-1.5 text-xs font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="deepseek-chat"
          />
        </div>
      </div>

      <button
        onClick={save}
        className="mt-3 w-full h-8 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 transition-colors"
      >
        保存
      </button>
    </div>,
    document.body,
  )
}
