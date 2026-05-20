// Bridge host runtime — module-level mutable state that wires the editor
// (host window) to the iframe bridge. Stays out of zustand stores so the
// stores themselves can be pure data + actions.

let _bridgeSender: ((msg: Record<string, unknown>) => void) | null = null

export function setBridgeSender(fn: (msg: Record<string, unknown>) => void) {
  _bridgeSender = fn
}

export function sendBridgeMessage(msg: Record<string, unknown>) {
  _bridgeSender?.(msg)
}

let _pendingRevealId: string | null = null
export function setPendingReveal(id: string | null) { _pendingRevealId = id }
export function consumePendingReveal(): string | null {
  const id = _pendingRevealId
  _pendingRevealId = null
  return id
}

let _suppressIframeReload = false
export function suppressNextIframeReload() { _suppressIframeReload = true }
export function consumeSuppressReload(): boolean {
  if (_suppressIframeReload) { _suppressIframeReload = false; return true }
  return false
}

export function requestFromBridge<T = Record<string, unknown>>(
  msg: Record<string, unknown>,
  responseType: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler)
      reject(new Error(`Bridge timeout waiting for "${responseType}"`))
    }, timeoutMs)

    const handler = (e: MessageEvent) => {
      if (e.data?.type === responseType) {
        clearTimeout(timer)
        window.removeEventListener('message', handler)
        resolve(e.data as T)
      }
    }
    window.addEventListener('message', handler)
    sendBridgeMessage(msg)
  })
}
