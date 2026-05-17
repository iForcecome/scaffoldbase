import type { InferSelectModel } from 'drizzle-orm'
import type { projects, specs, designTokens } from '../db/schema.js'

type Project = InferSelectModel<typeof projects>
type Spec = InferSelectModel<typeof specs>
type DesignToken = InferSelectModel<typeof designTokens>
type ExportType = 'spec_json' | 'html_prd'
type ExportScope = 'page' | 'project'

interface PageSchema {
  page: {
    id: string
    title: string
    layout: string
    sections: unknown[]
  }
}

interface ExportPage {
  id: string
  title: string
  html: string
  schema?: unknown
  source?: 'schema' | 'legacy-html'
  origin?: unknown
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function normalizePageSchema(page: { id: string; title: string; html: string; schema?: unknown }): PageSchema | null {
  if (!page.schema || typeof page.schema !== 'object') return null
  const maybe = page.schema as PageSchema
  if (!maybe.page || !Array.isArray(maybe.page.sections)) return null
  return maybe
}

function filterPages(pages: ExportPage[], scope: ExportScope, pageId?: string | null): ExportPage[] {
  if (scope === 'project') return pages
  if (!pageId) return pages.slice(0, 1)
  return pages.filter(page => page.id === pageId)
}

export function buildSpecJsonExport(project: Project, spec: Spec, tokens: DesignToken[], generatedAt: string, scope: ExportScope, pageId?: string | null) {
  const pages = filterPages((spec.pages ?? []) as ExportPage[], scope, pageId)
  return {
    exportType: 'spec_json',
    scope,
    pageId: pageId ?? null,
    generatedAt,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      qualityPreset: project.qualityPreset,
      baasProvider: project.baasProvider,
      designTokenId: project.designTokenId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    spec: {
      id: spec.id,
      version: spec.version,
      pages,
      dataModels: spec.dataModels ?? [],
      apiContracts: spec.apiContracts ?? [],
      qualityRules: spec.qualityRules ?? {},
      stateMachines: spec.stateMachines ?? [],
      snapshotHtml: spec.snapshotHtml ?? null,
      createdAt: spec.createdAt,
    },
    designTokens: tokens,
  }
}

function pagePreviewHtml(page: ExportPage) {
  const schema = normalizePageSchema(page)
  const semanticSummary = schema
    ? `<pre class="schema-json">${escapeHtml(JSON.stringify(schema, null, 2))}</pre>`
    : '<p class="muted">该页面尚未绑定 Page Schema，当前仅展示 HTML 快照。</p>'
  const rendered = page.html
  return `<article class="page-block">
    <header class="page-block__header">
      <div>
        <h2>${escapeHtml(page.title)}</h2>
        <p>${escapeHtml(page.id)}</p>
      </div>
    </header>
    <div class="page-block__preview">
      <iframe sandbox="allow-scripts allow-same-origin" srcdoc="${escapeAttr(rendered)}" title="${escapeAttr(page.title)}"></iframe>
    </div>
    <section class="page-block__spec">
      <h3>Schema / Spec</h3>
      ${semanticSummary}
    </section>
  </article>`
}

export function buildHtmlPrdExport(project: Project, spec: Spec, tokens: DesignToken[], generatedAt: string, scope: ExportScope, pageId?: string | null) {
  const pages = filterPages((spec.pages ?? []) as ExportPage[], scope, pageId)
  const pageBlocks = pages.map(pagePreviewHtml).join('\n')
  const tokenCount = tokens.length
  const pageCount = pages.length

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(project.name)} - HTML PRD</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, "Noto Sans SC", system-ui, sans-serif;
    color: #0f172a;
    background: #f8f9fc;
  }
  .doc { max-width: 1280px; margin: 0 auto; padding: 32px 24px 80px; }
  .hero {
    background: #ffffff;
    border: 1px solid #e9ecf5;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .hero h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; }
  .hero p { margin: 0; color: #64748b; }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
  .chip { background: #f1f3f9; color: #334155; border-radius: 999px; padding: 6px 12px; font-size: 12px; }
  .page-block {
    background: #ffffff;
    border: 1px solid #e9ecf5;
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  .page-block__header { padding: 20px 20px 0; }
  .page-block__header h2 { margin: 0 0 4px; font-size: 18px; }
  .page-block__header p { margin: 0; color: #64748b; font-size: 12px; }
  .page-block__preview { padding: 16px 20px 20px; }
  .page-block__preview iframe {
    width: 100%;
    min-height: 760px;
    border: 1px solid #e9ecf5;
    border-radius: 12px;
    background: #ffffff;
  }
  .page-block__spec { padding: 0 20px 20px; }
  .page-block__spec h3 { margin: 0 0 8px; font-size: 14px; }
  .schema-json {
    margin: 0;
    padding: 16px;
    border-radius: 12px;
    background: #0f172a;
    color: #e2e8f0;
    overflow: auto;
    font-size: 12px;
    line-height: 1.6;
  }
  .muted { margin: 0; color: #94a3b8; font-size: 13px; }
</style>
</head>
<body>
  <div class="doc">
    <section class="hero">
      <h1>${escapeHtml(project.name)} HTML PRD</h1>
      <p>${escapeHtml(project.description || 'SpecFlow 结构化导出文档')}</p>
      <div class="stats">
      <span class="chip">${pageCount} 页面</span>
      <span class="chip">${tokenCount} Design Tokens</span>
      <span class="chip">Spec v${spec.version}</span>
      <span class="chip">${escapeHtml(generatedAt)}</span>
      </div>
    </section>

    ${pageBlocks}
  </div>
</body>
</html>`
}

export type { ExportType }
