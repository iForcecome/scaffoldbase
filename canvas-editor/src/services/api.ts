const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  return res.json()
}

export interface Project {
  id: string
  name: string
  description: string
  qualityPreset: string
  baasProvider: string
  status: string
  sharedHead: string
  createdAt: string
  updatedAt: string
}

export interface Page {
  id: string
  title: string
  layoutId: string | null
  contentHtml: string
}

export interface IngestionMaterialInput {
  filename: string
  mimeType?: string
  content: string
  intendedUse?: 'page' | 'reference' | 'requirements' | 'asset' | 'auto'
}

export const api = {
  projects: {
    list: () => request<Project[]>('/projects'),
    get: (id: string) => request<Project & { spec: unknown }>(`/projects/${id}`),
    create: (data: {
      name: string
      description?: string
      sharedHead?: string
      ingestionMaterials?: IngestionMaterialInput[]
    }) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    deriveMeta: (prompt: string) =>
      request<{ name: string; description: string }>('/projects/derive-meta', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      }),
    update: (id: string, data: Partial<Project>) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  pages: {
    list: (projectId: string) => request<Page[]>(`/projects/${projectId}/pages`),
    update: (projectId: string, pageId: string, data: { title?: string; contentHtml: string; layoutId?: string | null }) =>
      request<Page[]>(`/projects/${projectId}/pages/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, pageId: string) =>
      request<Page[]>(`/projects/${projectId}/pages/${pageId}`, { method: 'DELETE' }),
  },

  ingestion: {
    run: (projectId: string, data: { prompt?: string; appendPages?: boolean; materials: IngestionMaterialInput[] }) =>
      request<{ pages: Page[] }>(`/projects/${projectId}/ingest`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  agent: {
    /** 启动 agent 流。返回 SSE Response；客户端逐行解析事件。 */
    start: (projectId: string, body: {
      message: string
      pageId?: string
      selectedNode?: unknown
    }, signal?: AbortSignal) =>
      fetch(`${BASE}/projects/${projectId}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),

    /** 回报 tool 执行结果给当前 run。 */
    submitToolResult: (projectId: string, body: {
      runId: string
      callId: string
      name: string
      ok: boolean
      data?: unknown
      error?: { code: string; message: string; details?: unknown }
    }) =>
      request<{ delivered: boolean; reason?: string }>(`/projects/${projectId}/agent/tool-results`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
}
