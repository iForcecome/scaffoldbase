// In-memory agent run 状态。每个 chat 请求开一个 run，多轮 tool 调用在这里挂账。
// 单进程足够；上集群时换 Redis。

import { randomUUID } from 'node:crypto'

export interface ToolResultRecord {
  callId: string
  name: string
  ok: boolean
  data?: unknown
  error?: { code: string; message: string; details?: unknown }
}

interface PendingResult {
  resolve: (record: ToolResultRecord) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface RunState {
  runId: string
  projectId: string
  createdAt: number
  pending: Map<string, PendingResult>     // callId → deferred
  closed: boolean
}

const runs = new Map<string, RunState>()

const TOOL_RESULT_TIMEOUT_MS = 60_000

export function createRun(projectId: string): RunState {
  const runId = randomUUID()
  const run: RunState = {
    runId,
    projectId,
    createdAt: Date.now(),
    pending: new Map(),
    closed: false,
  }
  runs.set(runId, run)
  return run
}

export function getRun(runId: string): RunState | undefined {
  return runs.get(runId)
}

export function closeRun(runId: string): void {
  const run = runs.get(runId)
  if (!run) return
  run.closed = true
  // 拒绝所有 pending
  for (const [, pending] of run.pending) {
    clearTimeout(pending.timer)
    pending.reject(new Error('Run closed before tool result arrived'))
  }
  run.pending.clear()
  runs.delete(runId)
}

/** server 端等 client 报告 tool 执行结果 */
export function awaitToolResult(run: RunState, callId: string): Promise<ToolResultRecord> {
  if (run.closed) return Promise.reject(new Error('Run already closed'))

  return new Promise<ToolResultRecord>((resolve, reject) => {
    const timer = setTimeout(() => {
      run.pending.delete(callId)
      reject(new Error(`Tool result timeout for callId=${callId}`))
    }, TOOL_RESULT_TIMEOUT_MS)
    run.pending.set(callId, { resolve, reject, timer })
  })
}

/** client POST 回来的 tool_result 走这里派发 */
export function submitToolResult(
  runId: string,
  record: ToolResultRecord,
): { delivered: boolean; reason?: string } {
  const run = runs.get(runId)
  if (!run) return { delivered: false, reason: 'run_not_found' }
  if (run.closed) return { delivered: false, reason: 'run_closed' }
  const pending = run.pending.get(record.callId)
  if (!pending) return { delivered: false, reason: 'callId_not_pending' }
  clearTimeout(pending.timer)
  run.pending.delete(record.callId)
  pending.resolve(record)
  return { delivered: true }
}

// 周期性清理超 10 分钟未关闭的 zombie runs
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000
  for (const [runId, run] of runs) {
    if (run.createdAt < cutoff) {
      closeRun(runId)
    }
  }
}, 60_000).unref()
