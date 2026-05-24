import { useState, useEffect } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { useViewportStore } from '../../stores/viewport-store'

export function PagePropertiesSection() {
  const activePageId = useEditorStore(s => s.activePageId)
  const pages = useEditorStore(s => s.pages)
  const renamePage = useEditorStore(s => s.renamePage)
  const sharedHead = useEditorStore(s => s.sharedHead)
  const setSharedHead = useEditorStore(s => s.setSharedHead)
  const deviceWidth = useViewportStore(s => s.getDeviceWidth())
  const setCustomWidth = useViewportStore(s => s.setCustomWidth)

  const page = pages.find(p => p.id === activePageId)
  const [title, setTitle] = useState(page?.title ?? '')
  const [widthLocal, setWidthLocal] = useState(String(deviceWidth))
  const [sharedHeadLocal, setSharedHeadLocal] = useState(sharedHead)

  useEffect(() => { setTitle(page?.title ?? '') }, [page?.title])
  useEffect(() => { setWidthLocal(String(deviceWidth)) }, [deviceWidth])
  useEffect(() => { setSharedHeadLocal(sharedHead) }, [sharedHead])

  const commitTitle = () => {
    if (title.trim() && title !== page?.title) {
      renamePage(activePageId, title.trim())
    }
  }

  const commitSharedHead = () => {
    if (sharedHeadLocal !== sharedHead) {
      setSharedHead(sharedHeadLocal)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">页面</div>
        <label className="text-[11px] text-ink-3 mb-1 block">页面标题</label>
        <input
          className="w-full bg-surface-1 rounded-md px-2 py-1.5 text-xs text-ink-0 outline-none focus:ring-1 focus:ring-brand-400"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        />
      </div>

      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">尺寸</div>
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
      </div>

      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">项目共享 head</div>
        <p className="text-[10px] text-ink-3 mb-1.5">注入到所有页面的 &lt;head&gt; 末尾。CSS、JS、字体在这里写。</p>
        <textarea
          className="w-full bg-surface-1 rounded-md px-2 py-1.5 text-[11px] font-mono text-ink-1 outline-none focus:ring-1 focus:ring-brand-400 resize-y min-h-[80px]"
          value={sharedHeadLocal}
          onChange={e => setSharedHeadLocal(e.target.value)}
          onBlur={commitSharedHead}
          placeholder='<script src="https://cdn.tailwindcss.com"></script>'
        />
      </div>

      <div className="p-3 border-b border-surface-3">
        <div className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-2">导出</div>
        <p className="text-[11px] text-ink-3">β8 重写中（基于 DOM walker 重做）</p>
      </div>
    </div>
  )
}
