import type { ReactNode } from 'react'

interface BrowserFrameProps {
  deviceWidth: number
  pageSlug: string
  children: ReactNode
}

export function BrowserFrame({ deviceWidth, pageSlug, children }: BrowserFrameProps) {
  return (
    <div
      className="bg-white rounded-xl shadow-2xl shadow-black/[0.06] border border-surface-3/60 overflow-hidden shrink-0"
      style={{ width: deviceWidth }}
    >
      {/* Browser chrome */}
      <div className="bg-surface-2 px-4 py-2 flex items-center gap-3 border-b border-surface-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="bg-white/80 rounded-md px-4 py-1 text-[11px] text-ink-3 flex items-center gap-1.5 min-w-[240px]">
            <svg className="w-3 h-3 text-ink-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/>
            </svg>
            app.specflow.dev/preview/{pageSlug}
          </div>
        </div>
      </div>

      {/* Page content area */}
      <div className="relative">
        {children}
      </div>
    </div>
  )
}
