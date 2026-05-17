import { useRef, useEffect } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { ChevronUp } from 'lucide-react'

export function ChatHistory({ onClose }: { onClose: () => void }) {
  const messages = useChatStore(s => s.messages)
  const isStreaming = useChatStore(s => s.isStreaming)
  const streamingContent = useChatStore(s => s.streamingContent)
  const error = useChatStore(s => s.error)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  const hasContent = messages.length > 0 || isStreaming || error

  if (!hasContent) return null

  return (
    <div className="max-w-2xl mx-auto mb-3 pointer-events-auto slide-up">
      <div className="glass-dark rounded-2xl p-4 text-white max-h-[40vh] flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center shrink-0">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
              </svg>
            </div>
            <span className="text-xs text-white/60 font-medium">AI 对话</span>
          </div>
          <button
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
            onClick={onClose}
          >
            <ChevronUp className="w-3.5 h-3.5 text-white/40" />
          </button>
        </div>

        <div ref={scrollRef} className="overflow-y-auto space-y-3 min-h-0">
          {messages.map(msg => (
            <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="bg-white/10 rounded-xl px-3 py-2 max-w-[80%]">
                  <p className="text-sm text-white/90">{msg.content}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {formatAssistantContent(msg.content)}
                  </p>
                  {msg.htmlApplied && (
                    <div className="flex items-center gap-1.5 text-xs text-green-400/80">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                      </svg>
                      已应用到画布{msg.appliedMode ? ` · ${formatAppliedMode(msg.appliedMode)}` : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isStreaming && (
            <div className="space-y-2">
              {streamingContent ? (
                <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {formatAssistantContent(streamingContent)}
                </p>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-white/60" />
                  <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-white/60" />
                  <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-white/60" />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatAppliedMode(mode: 'schema' | 'dom' | 'fragment' | 'diff'): string {
  switch (mode) {
    case 'schema':
      return 'Schema'
    case 'dom':
      return 'DOM'
    case 'fragment':
      return 'HTML 片段'
    case 'diff':
      return 'HTML Diff'
  }
}

function formatAssistantContent(content: string): string {
  return content
    .replace(/```html[\s\S]*?```/g, '[HTML 代码已应用]')
    .replace(/```[\s\S]*?```/g, '[代码块]')
    .replace(/<<<SEARCH>>>[\s\S]*?<<<END>>>/g, '')
    .trim() || '已应用修改。'
}
