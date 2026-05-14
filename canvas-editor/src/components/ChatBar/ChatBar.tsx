import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { ChatHistory } from './ChatHistory'
import { ChatInput } from './ChatInput'

export function ChatBar() {
  const [historyVisible, setHistoryVisible] = useState(true)
  const messageCount = useChatStore(s => s.messages.length)
  const isStreaming = useChatStore(s => s.isStreaming)
  const hasError = useChatStore(s => s.error !== null)
  const hasMessages = messageCount > 0

  const prevCountRef = useRef(messageCount)
  useEffect(() => {
    if (messageCount > prevCountRef.current) {
      setHistoryVisible(true)
    }
    prevCountRef.current = messageCount
  }, [messageCount])

  const showHistory = historyVisible && (hasMessages || isStreaming || hasError)
  const canToggle = hasMessages || isStreaming || hasError

  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-4 pb-4 pointer-events-none" data-no-canvas-wheel>
      {showHistory && (
        <ChatHistory onClose={() => setHistoryVisible(false)} />
      )}
      <ChatInput
        historyVisible={showHistory}
        canToggleHistory={canToggle}
        onToggleHistory={() => setHistoryVisible(v => !v)}
      />
    </div>
  )
}
