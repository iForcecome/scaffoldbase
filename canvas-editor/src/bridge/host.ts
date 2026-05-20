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

interface PendingRpc {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
  responseType: string
}

const pendingRpc = new Map<string, PendingRpc>()

if (typeof window !== 'undefined') {
  window.addEventListener('message', (e) => {
    const data = e.data
    if (!data || typeof data !== 'object') return
    const rid = data._rid
    if (typeof rid !== 'string') return
    const entry = pendingRpc.get(rid)
    if (!entry) return
    pendingRpc.delete(rid)
    clearTimeout(entry.timer)
    entry.resolve(data)
  })
}

export function requestFromBridge<T = Record<string, unknown>>(
  msg: Record<string, unknown>,
  responseType: string,
  timeoutMs = 5000,
): Promise<T> {
  const rid = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : `rpc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRpc.delete(rid)
      reject(new Error(`Bridge timeout waiting for "${responseType}"`))
    }, timeoutMs)
    pendingRpc.set(rid, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer,
      responseType,
    })
    sendBridgeMessage({ ...msg, _rid: rid })
  })
}
