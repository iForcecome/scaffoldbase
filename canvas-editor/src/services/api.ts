import type { PageSchema } from '../page-schema/types'

const BASE = '/api'

async function download(projectId: string, type: 'spec_json' | 'html_prd', filename: string, scope: 'page' | 'project' = 'project', pageId?: string | null): Promise<void> {
  const requestUrl = new URL(`${window.location.origin}${BASE}/projects/${projectId}/exports/${type}`)
  requestUrl.searchParams.set('scope', scope)
  if (pageId) requestUrl.searchParams.set('pageId', pageId)
  const res = await fetch(requestUrl.toString(), {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
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
  origin?: unknown
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
    create: (data: { name: string; description?: string; ingestionMaterials?: IngestionMaterialInput[] }) =>
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
    update: (projectId: string, pageId: string, data: { title?: string; html: string; schema?: PageSchema | null }) =>
      request<Page[]>(`/projects/${projectId}/pages/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (projectId: string, pageId: string) =>
      request<Page[]>(`/projects/${projectId}/pages/${pageId}`, { method: 'DELETE' }),
  },

  ingestion: {
    run: (projectId: string, data: { prompt?: string; appendPages?: boolean; materials: IngestionMaterialInput[] }) =>
      request<{
        pages: Page[]
        rawMaterials: unknown[]
        normalizedMaterials: unknown[]
        ingestionJobs: unknown[]
        ingestionPlan: unknown
        conversionReport: unknown
      }>(`/projects/${projectId}/ingest`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  chat: {
    stream: (projectId: string, body: {
      message: string
      pageId?: string
      pageSchema?: PageSchema | null
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
    downloadSpecJson: (projectId: string, projectName = 'specflow', scope: 'page' | 'project' = 'project', pageId?: string | null) =>
      download(projectId, 'spec_json', `${projectName}-spec.json`, scope, pageId),
    downloadHtmlPrd: (projectId: string, projectName = 'specflow', scope: 'page' | 'project' = 'project', pageId?: string | null) =>
      download(projectId, 'html_prd', `${projectName}-html-prd.html`, scope, pageId),
  },
}
