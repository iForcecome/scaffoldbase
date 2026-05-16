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
  createdAt: string
  updatedAt: string
}

export interface Page {
  id: string
  title: string
  html: string
}

export const api = {
  projects: {
    list: () => request<Project[]>('/projects'),
    get: (id: string) => request<Project & { spec: unknown }>(`/projects/${id}`),
    create: (data: { name: string; description?: string }) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Project>) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  pages: {
    list: (projectId: string) => request<Page[]>(`/projects/${projectId}/pages`),
    update: (projectId: string, pageId: string, data: { title?: string; html: string }) =>
      request<Page[]>(`/projects/${projectId}/pages/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  chat: {
    stream: (projectId: string, body: { message: string; pageId?: string; elementId?: string; elementHtml?: string }, signal?: AbortSignal) =>
      fetch(`${BASE}/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      }),
  },

  designTokens: {
    list: () => request<unknown[]>('/design-tokens'),
  },
}
