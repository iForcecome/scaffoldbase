import { renderDesignSystemCss } from '../design-system/render-css'
import { assertPageSchema } from './validate'
import type { ComponentNode, PageSchema } from './types'
import { renderComponentNode } from './component-registry'

export type { PageSchema } from './types'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isSafeCssColor(value: unknown): value is string {
  return typeof value === 'string' && (
    /^#[0-9a-fA-F]{3,8}$/.test(value) ||
    /^rgba?\([\d\s,%.]+\)$/.test(value)
  )
}

function renderThemeCss(page: PageSchema['page']): string {
  const theme = page.theme
  if (!theme) return ''
  const rules: string[] = []
  if (isSafeCssColor(theme.brandColor)) rules.push(`--sf-color-brand-600: ${theme.brandColor};`)
  if (isSafeCssColor(theme.brandColorStrong)) rules.push(`--sf-color-brand-700: ${theme.brandColorStrong};`)
  if (isSafeCssColor(theme.backgroundColor)) rules.push(`--sf-color-surface-1: ${theme.backgroundColor};`)
  if (isSafeCssColor(theme.surfaceColor)) rules.push(`--sf-color-surface-0: ${theme.surfaceColor};`)
  if (isSafeCssColor(theme.surfaceColorRaised)) rules.push(`--sf-color-surface-2: ${theme.surfaceColorRaised};`)
  if (isSafeCssColor(theme.borderColor)) rules.push(`--sf-color-surface-3: ${theme.borderColor};`)
  if (isSafeCssColor(theme.textColor)) rules.push(`--sf-color-ink-0: ${theme.textColor};`)
  if (isSafeCssColor(theme.textColorSecondary)) rules.push(`--sf-color-ink-1: ${theme.textColorSecondary};`)
  if (isSafeCssColor(theme.mutedTextColor)) rules.push(`--sf-color-ink-2: ${theme.mutedTextColor};`)
  if (typeof theme.fontFamily === 'string' && theme.fontFamily.length < 200) rules.push(`--sf-font-sans: ${theme.fontFamily};`)
  if (rules.length === 0) return ''
  return `<style data-sf-theme>
:root {
  ${rules.join('\n  ')}
}
</style>`
}

function renderPageShell(page: PageSchema['page'], body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    background: var(--sf-color-surface-1);
    color: var(--sf-color-ink-0);
    font-family: var(--sf-font-sans);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  main.sf-page-shell {
    display: grid;
    gap: var(--sf-space-4);
    padding: 24px;
  }
  .sf-page-shell--marketing {
    gap: var(--sf-space-6);
  }
  h1, h2, h3, p { margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--sf-color-surface-3); }
  th { background: var(--sf-color-surface-1); font-size: 13px; font-weight: 600; color: var(--sf-color-ink-1); }
  td { font-size: 14px; color: var(--sf-color-ink-0); }
  input, select, button, textarea {
    font: inherit;
  }
  input, select, textarea {
    width: 100%;
    min-height: 36px;
    border: 1px solid var(--sf-color-surface-3);
    border-radius: var(--sf-radius-md);
    padding: 0 12px;
    background: var(--sf-color-surface-0);
    color: var(--sf-color-ink-0);
  }
  label { display: grid; gap: 8px; }
  .sf-filter-field { min-width: 180px; }
  .sf-filter-field__label { font-size: 12px; color: var(--sf-color-ink-2); font-weight: 600; }
  .sf-page-header__actions, .sf-empty-state__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .sf-modal__overlay { display: grid; place-items: center; background: rgba(15, 23, 42, 0.42); min-height: 100vh; padding: 24px; }
  .sf-modal__body { display: grid; gap: 16px; }
  .sf-filter-bar__fields { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; width: 100%; }
  .sf-date-range { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; }
</style>
<style data-sf-design-system>
${renderDesignSystemCss()}
</style>
${renderThemeCss(page)}
</head>
<body>
  <main class="sf-page-shell sf-page-shell--${escapeHtml(page.layout)}" data-sf-page-id="${escapeHtml(page.id)}" data-sf-page-title="${escapeHtml(page.title)}">
    ${body}
  </main>
</body>
</html>`
}

function createDefaultSections(pageId: string): ComponentNode[] {
  return [
    {
      id: `${pageId}.header`,
      component: 'PageHeader',
      role: 'header',
      label: '页面标题区',
      variant: 'default',
      props: {
        title: '新页面',
        description: '开始编辑你的页面',
        actions: [
          { component: 'Button', variant: 'primary', label: '新建' },
        ],
      },
    },
    {
      id: `${pageId}.filters`,
      component: 'FilterBar',
      role: 'filters',
      label: '筛选区',
      variant: 'default',
      props: {
        fields: [
          { type: 'search', name: 'keyword', label: '搜索' },
          { type: 'select', name: 'status', label: '状态', options: ['全部', '进行中', '已完成'] },
        ],
      },
    },
    {
      id: `${pageId}.table`,
      component: 'DataTable',
      role: 'table',
      label: '数据表格',
      variant: 'default',
      props: {
        columns: [
          { key: 'name', label: '名称' },
          { key: 'status', label: '状态' },
          { key: 'updatedAt', label: '更新时间' },
        ],
      },
    },
  ]
}

export function createDefaultPageSchema(pageId: string, title = '新页面'): PageSchema {
  return {
    page: {
      id: pageId,
      title,
      layout: 'dashboard',
      sections: createDefaultSections(pageId),
    },
  }
}

export function clonePageSchema(schema: PageSchema, pageOverrides?: Partial<PageSchema['page']>): PageSchema {
  const clone = structuredClone(schema)
  if (pageOverrides) {
    clone.page = { ...clone.page, ...pageOverrides }
  }
  return clone
}

export function renderPageSchemaToHtml(schema: PageSchema): string {
  assertPageSchema(schema)
  const body = schema.page.sections.map(renderComponentNode).join('\n')
  return renderPageShell(schema.page, body)
}
