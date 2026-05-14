import { useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { ChatHistory } from './ChatHistory'
import { ChatInput } from './ChatInput'

export function ChatBar() {
  const [historyVisible, setHistoryVisible] = useState(true)
  const hasMessages = useChatStore(s => s.messages.length > 0)
  const isStreaming = useChatStore(s => s.isStreaming)
  const hasError = useChatStore(s => s.error !== null)

  const showHistory = historyVisible && (hasMessages || isStreaming || hasError)

  return (
    <div className="absolute bottom-0 inset-x-0 z-30 px-4 pb-4 pointer-events-none">
      {showHistory && (
        <ChatHistory onClose={() => setHistoryVisible(false)} />
      )}
      <ChatInput />
    </div>
  )
}
