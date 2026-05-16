import { useState, useRef, useCallback, useEffect } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { useChatStore } from '../../stores/chat-store'

interface ChatInputProps {
  historyVisible: boolean
  canToggleHistory: boolean
  onToggleHistory: () => void
}

export function ChatInput({ historyVisible, canToggleHistory, onToggleHistory }: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedIds = useEditorStore(s => s.selectedIds)
  const selectedElements = useEditorStore(s => s.selectedElements)
  const selectElement = useEditorStore(s => s.selectElement)

  const sendMessage = useChatStore(s => s.sendMessage)
  const isStreaming = useChatStore(s => s.isStreaming)
  const stopStreaming = useChatStore(s => s.stopStreaming)

  useEffect(() => {
    if (selectedIds.length > 0 && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [selectedIds])

  const handleSend = useCallback(() => {
    const msg = text.trim()
    if (!msg || isStreaming) return
    setText('')
    sendMessage(msg)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [text, isStreaming, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      selectElement(null)
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }

  const removeSelection = (id: string) => {
    selectElement(id, undefined, undefined, true)
  }

  return (
    <div className="max-w-2xl mx-auto pointer-events-auto">
      <div className="chat-float glass rounded-2xl overflow-hidden">
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-0 overflow-hidden">
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar">
              {selectedIds.map(id => {
                const el = selectedElements[id]
                const label = el?.label || id
                return (
                  <div key={id} className="flex items-center gap-1 bg-brand-50 text-brand-600 text-xs font-medium pl-1.5 pr-1 py-0.5 rounded-md border border-brand-200/50 shrink-0">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75Z"/>
                    </svg>
                    <span className="max-w-24 truncate text-[11px]">{label}</span>
                    <button
                      className="w-3.5 h-3.5 rounded-full hover:bg-brand-100 flex items-center justify-center shrink-0"
                      onClick={() => removeSelection(id)}
                    >
                      <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            <button
              className="w-4 h-4 rounded-full hover:bg-surface-2 flex items-center justify-center text-ink-3 shrink-0"
              onClick={() => selectElement(null)}
              title="清除所有选中"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M6 18 18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}

        <div className="flex items-end gap-3 p-3 pt-2">
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full text-sm text-ink-0 leading-relaxed py-1.5 bg-transparent outline-none placeholder:text-ink-3 resize-none"
              placeholder={isStreaming ? 'AI 正在生成...' : '描述你想要的修改...'}
              disabled={isStreaming}
            />
          </div>

          <div className="flex items-center gap-1.5 pb-1 shrink-0">
            {isStreaming ? (
              <button
                className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors"
                onClick={stopStreaming}
                title="停止生成"
              >
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1"/>
                </svg>
              </button>
            ) : (
              <>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-2 transition-colors text-ink-3" title="附加图片">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 0 3Z"/>
                  </svg>
                </button>
                <button
                  className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center hover:bg-brand-700 transition-colors shadow-lg shadow-brand-600/30 disabled:opacity-40"
                  onClick={handleSend}
                  disabled={!text.trim()}
                  title="发送 (⏎)"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-2 pt-0 relative">
          <div className="flex items-center gap-3 text-[11px] text-ink-3">
            {canToggleHistory && (
              <span
                className="flex items-center gap-1 cursor-pointer hover:text-ink-1 transition-colors"
                onClick={onToggleHistory}
                title={historyVisible ? '收起对话' : '展开对话'}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.2 48.2 0 0 0 5.887-.512c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.4 48.4 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"/>
                </svg>
                对话记录
                <svg
                  className={`w-2.5 h-2.5 transition-transform ${historyVisible ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" d="m4.5 15.75 7.5-7.5 7.5 7.5"/>
                </svg>
              </span>
            )}
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
              </svg>
              deepseek-chat
            </span>
            <span className="text-ink-4">·</span>
            <span className="flex items-center gap-1 cursor-pointer hover:text-ink-1 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
              </svg>
              Spec 自动同步
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-ink-3">
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] font-mono">⏎</kbd>
            <span>发送</span>
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] font-mono">⇧⏎</kbd>
            <span>换行</span>
            <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] font-mono">Esc</kbd>
            <span>取消选中</span>
          </div>
        </div>
      </div>
    </div>
  )
}
