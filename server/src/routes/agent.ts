import type { FastifyPluginAsync } from 'fastify'
import { runAgent, startRun, submitToolResult } from '../services/agent.js'

function sendSSE(reply: { raw: { write: (data: string) => void } }, type: string, payload: object = {}) {
  reply.raw.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`)
}

type AgentBody = {
  message: string
  pageId?: string
  pageSchema?: unknown
  selectedNode?: unknown
}

export const agentRoutes: FastifyPluginAsync = async (app) => {
  // POST /projects/:id/agent — 开 SSE，执行 agent loop。
  // 流程：
  //   1. 服务端建 run，发 SSE 'run_started' 把 runId 告诉 client
  //   2. agent 边跑边发 chunk / tool_request / step
  //   3. tool_request 后 server 阻塞等 client POST 回 tool result
  //   4. 完成发 done，关流
  app.post('/projects/:id/agent', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1 },
          pageId: { type: 'string' },
          pageSchema: { type: 'object', additionalProperties: true },
          selectedNode: { type: 'object', additionalProperties: true },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as AgentBody

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const run = startRun(id)
    sendSSE(reply, 'run_started', { runId: run.runId })

    // 客户端断连检测要监听 reply.raw（ServerResponse），不能用 request.raw —
    // Node 16+ 的 IncomingMessage 'close' 在 body 读完时就会触发，不代表客户端断了。
    const ac = new AbortController()
    reply.raw.on('close', () => {
      if (!reply.raw.writableEnded) ac.abort()
    })

    let done = false
    await runAgent(
      run.runId,
      {
        projectId: id,
        userMessage: body.message,
        pageContext: {
          activePageId: body.pageId,
          pageSchema: body.pageSchema,
          selectedNode: body.selectedNode,
        },
      },
      {
        text: (text) => sendSSE(reply, 'text', { text }),
        toolRequest: (callId, name, params) =>
          sendSSE(reply, 'tool_request', { callId, name, params }),
        step: (info) => sendSSE(reply, 'step', info),
        error: (message) => {
          sendSSE(reply, 'error', { message })
          done = true
        },
        done: () => {
          sendSSE(reply, 'done', {})
          done = true
        },
      },
      ac.signal,
    )

    if (!done) sendSSE(reply, 'done', {})
    reply.raw.end()
  })

  // POST /projects/:id/agent/tool-results — client 报告 tool 执行结果
  app.post('/projects/:id/agent/tool-results', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        required: ['runId', 'callId', 'name', 'ok'],
        properties: {
          runId: { type: 'string' },
          callId: { type: 'string' },
          name: { type: 'string' },
          ok: { type: 'boolean' },
          data: {},
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      runId: string
      callId: string
      name: string
      ok: boolean
      data?: unknown
      error?: { code: string; message: string; details?: unknown }
    }
    const result = submitToolResult(body.runId, {
      callId: body.callId,
      name: body.name,
      ok: body.ok,
      data: body.data,
      error: body.error,
    })
    if (!result.delivered) {
      reply.status(410)
      return { delivered: false, reason: result.reason }
    }
    return { delivered: true }
  })
}
