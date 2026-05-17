import type { PageSchema } from '../page-schema/types'

const BASE = '/api'

async function download(projectId: string, type: 'spec_json' | 'html_prd', filename: string): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/exports/${type}`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

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
  schema?: PageSchema | null
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
    update: (projectId: string, pageId: string, data: { title?: string; html: string; schema?: PageSchema | null }) =>
      request<Page[]>(`/projects/${projectId}/pages/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  chat: {
    stream: (projectId: string, body: {
      message: string
      pageId?: string
      elementId?: string
      elementHtml?: string
      selectedNode?: unknown
    }, signal?: AbortSignal) =>
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

  exports: {
    downloadSpecJson: (projectId: string, projectName = 'specflow') =>
      download(projectId, 'spec_json', `${projectName}-spec.json`),
    downloadHtmlPrd: (projectId: string, projectName = 'specflow') =>
      download(projectId, 'html_prd', `${projectName}-html-prd.html`),
  },
}
