// One-shot migration: convert pages still lacking `schema` into PageSchema.
//
// Strategy: render the page's stored html in a headless Chromium tab, walk the
// rendered DOM to assign sf-ids + semantic metadata (mirroring bridge-script
// inference), then collapse the structural tree into a ComponentNode tree.
//
// Run via `pnpm --filter server migrate:schema` after `pnpm install` pulls
// Playwright. Browsers must be installed once (`pnpm exec playwright install
// chromium`).

import { chromium, type Page as PlaywrightPage } from 'playwright'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../env.js'
import * as dbSchema from '../db/schema.js'

type PageLayout = 'dashboard' | 'marketing' | 'form-flow' | 'detail' | 'settings'

interface ComponentNode {
  id: string
  component: string
  role?: string
  label?: string
  variant?: string
  props: Record<string, unknown>
  children?: ComponentNode[]
}

interface PageSchema {
  page: {
    id: string
    title: string
    layout: PageLayout
    sections: ComponentNode[]
  }
}

interface RawDOMNode {
  id: string
  sfId?: string | null
  tag: string
  label: string
  semanticLabel?: string | null
  component?: string | null
  role?: string | null
  variant?: string | null
  children: RawDOMNode[]
}

interface StoredPage {
  id: string
  title: string
  html: string
  schema?: unknown
  origin?: unknown
}

function inferLayout(pageId: string, title: string): PageLayout {
  const text = `${pageId} ${title}`.toLowerCase()
  if (text.includes('详情')) return 'detail'
  if (text.includes('设置')) return 'settings'
  if (text.includes('表单') || text.includes('配置')) return 'form-flow'
  if (text.includes('落地页') || text.includes('首页') || text.includes('营销')) return 'marketing'
  return 'dashboard'
}

function toComponentNode(node: RawDOMNode): ComponentNode | null {
  const children = node.children.map(toComponentNode).filter(Boolean) as ComponentNode[]
  const component = node.component || node.semanticLabel ? (node.component || 'Region') : null
  if (!component && children.length === 0) return null
  return {
    id: node.sfId || node.id,
    component: component || 'Region',
    role: node.role || undefined,
    label: node.semanticLabel || node.label,
    variant: node.variant || undefined,
    props: {},
    children: children.length > 0 ? children : undefined,
  }
}

function buildSchemaFromTree(pageId: string, title: string, tree: RawDOMNode[]): PageSchema | null {
  const sections = tree.map(toComponentNode).filter(Boolean) as ComponentNode[]
  if (sections.length === 0) return null
  return {
    page: {
      id: pageId,
      title,
      layout: inferLayout(pageId, title),
      sections,
    },
  }
}

// Walker executed inside the headless page. Mirrors the inference rules in
// canvas-editor/src/bridge/bridge-script.ts; keep the two in sync if either
// side gains semantic heuristics.
async function captureTree(page: PlaywrightPage): Promise<RawDOMNode[]> {
  return page.evaluate(() => {
    const BRIDGE_ATTR = 'data-sf-id'
    let counter = 0

    function assignIds(root: Element) {
      const walk = (el: Element) => {
        if (!el.getAttribute(BRIDGE_ATTR)) el.setAttribute(BRIDGE_ATTR, 'sf-' + counter++)
        for (let i = 0; i < el.children.length; i++) walk(el.children[i])
      }
      walk(root)
    }

    function directText(el: Element): string {
      let t = ''
      for (let i = 0; i < el.childNodes.length; i++) {
        const n = el.childNodes[i]
        if (n.nodeType === 3) t += (n.textContent || '').trim()
      }
      return t.slice(0, 24)
    }

    function toKebab(value: string): string {
      return String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase()
    }

    function inferSemantic(el: Element) {
      const tag = el.tagName.toLowerCase()
      const text = (el.textContent || '').trim()
      if (tag === 'header') return { component: 'PageHeader', role: 'header', label: '页面标题区' }
      if (tag === 'nav') return { component: 'Navigation', role: 'navigation', label: '导航菜单' }
      if (tag === 'form') return { component: 'FormSection', role: 'form', label: '表单区' }
      if (tag === 'table') return { component: 'DataTable', role: 'table', label: '数据表格' }
      if (tag === 'button') return { component: 'Button', role: 'action', label: directText(el) || '按钮' }
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') return { component: null, role: 'title', label: directText(el) || '标题' }
      if (tag === 'p') return { component: null, role: 'description', label: directText(el) || '描述' }
      if (tag === 'div' || tag === 'section' || tag === 'main' || tag === 'article') {
        if (el.querySelector(':scope > table') || el.querySelector('table')) {
          return { component: 'DataTable', role: 'table', label: '数据表格' }
        }
        const hasField = !!el.querySelector('input, select, textarea')
        const buttons = el.querySelectorAll('button')
        const hasFilterText = ['搜索', '筛选', '重置', '状态', '日期'].some(s => text.indexOf(s) >= 0)
        if ((hasField && buttons.length > 0) || (hasFilterText && buttons.length >= 1)) {
          return { component: 'FilterBar', role: 'filters', label: '筛选区' }
        }
        const directTitle = el.querySelector(':scope > h1, :scope > h2, :scope > h3')
        if (directTitle && buttons.length > 0) {
          return { component: 'PageHeader', role: 'header', label: '页面标题区' }
        }
        if (el.querySelector('label') && el.querySelector('input, select, textarea')) {
          return { component: 'FormSection', role: 'form', label: '表单区' }
        }
        if ((text.indexOf('暂无') >= 0 || text.indexOf('没有') >= 0) && buttons.length <= 1) {
          return { component: 'EmptyState', role: 'empty-state', label: '空状态' }
        }
      }
      return { component: null, role: null, label: null }
    }

    function applySemanticAttrs(el: Element) {
      const inferred = inferSemantic(el)
      const component = el.getAttribute('data-sf-component') || inferred.component
      const role = el.getAttribute('data-sf-role') || inferred.role
      if (component) {
        el.setAttribute('data-sf-component', component)
        if (!el.getAttribute('data-sf-variant')) el.setAttribute('data-sf-variant', 'default')
      }
      if (role && !el.getAttribute('data-sf-role')) el.setAttribute('data-sf-role', role)
      if (inferred.label && !el.getAttribute('data-sf-label')) el.setAttribute('data-sf-label', inferred.label)
    }

    function inferLabel(el: Element): string {
      const semantic = el.getAttribute('data-sf-label')
      if (semantic) return semantic
      const tag = el.tagName.toLowerCase()
      if (tag === 'body') return '页面根'
      if (tag === 'header') return 'Header'
      if (tag === 'nav') return '导航菜单'
      if (tag === 'main') return '主内容区'
      if (tag === 'footer') return 'Footer'
      if (tag === 'section') return 'Section'
      if (tag === 'aside') return 'Aside'
      if (tag === 'form') return 'Form'
      if (tag === 'table') return '数据表格'
      const t = directText(el)
      const full = (el.textContent || '').trim()
      if (tag === 'h1') return t || '标题'
      if (tag === 'h2') return t || '副标题'
      if (tag === 'h3') return t || '小标题'
      if (tag === 'p') return t || '段落'
      if (tag === 'button') return t || '按钮'
      if (tag === 'a') return t || '链接'
      if (tag === 'span') return t || '文本'
      if (tag === 'div') {
        if (t.length > 0 && t.length <= 20) return t
        if (el.children.length === 0 && full) return full.slice(0, 16)
        if (el.children.length === 0) return '空容器'
        return '容器'
      }
      return tag
    }

    function isDecorative(el: Element): boolean {
      const tag = el.tagName.toLowerCase()
      if (tag !== 'div' && tag !== 'span') return false
      if ((el.textContent || '').trim()) return false
      if (el.querySelector('img, svg, canvas, input, select, textarea, button, a')) return false
      const style = window.getComputedStyle(el)
      const className = el.getAttribute('class') || ''
      const isOverlay = style.position === 'absolute' || style.position === 'fixed' ||
        className.indexOf('absolute') >= 0 || className.indexOf('inset-0') >= 0
      const isFaint = parseFloat(style.opacity || '1') <= 0.25 || className.indexOf('opacity-') >= 0
      return isOverlay && isFaint
    }

    function semanticMeta(el: Element) {
      const inferred = inferSemantic(el)
      return {
        sfId: el.getAttribute(BRIDGE_ATTR),
        semanticLabel: el.getAttribute('data-sf-label') || inferred.label || null,
        component: el.getAttribute('data-sf-component') || inferred.component || null,
        role: el.getAttribute('data-sf-role') || inferred.role || null,
        variant: el.getAttribute('data-sf-variant') || null,
      }
    }

    function parse(el: Element, depth: number): RawDOMNode | null {
      if (depth > 10) return null
      const tag = el.tagName.toLowerCase()
      if (['script', 'style', 'link', 'meta', 'br', 'hr'].includes(tag)) return null
      if (isDecorative(el)) return null
      const rect = el.getBoundingClientRect()
      if (rect.width < 2 && rect.height < 2) return null
      if (tag === 'svg') {
        return Object.assign({ id: el.getAttribute(BRIDGE_ATTR) || '', tag, label: inferLabel(el), children: [] }, semanticMeta(el))
      }
      const children: RawDOMNode[] = []
      for (let i = 0; i < el.children.length; i++) {
        const child = parse(el.children[i], depth + 1)
        if (child) children.push(child)
      }
      return Object.assign({ id: el.getAttribute(BRIDGE_ATTR) || '', tag, label: inferLabel(el), children }, semanticMeta(el))
    }

    function prune(nodes: RawDOMNode[], depth: number): RawDOMNode[] {
      if (!nodes.length) return []
      const result: RawDOMNode[] = []
      for (const node of nodes) {
        const tag = node.tag
        if (['svg', 'input', 'th', 'td', 'tr'].includes(tag)) continue
        if (depth >= 3 && ['span', 'a', 'p', 'button', 'label'].includes(tag)) continue
        const children = prune(node.children, depth + 1)
        if (tag === 'div' && children.length === 1) {
          const child = children[0]
          const generic = ['容器', '空容器', '表格容器']
          const label = generic.indexOf(node.label) >= 0 ? child.label : node.label
          result.push({ ...node, tag: child.tag, label, children: child.children })
          continue
        }
        node.children = children
        result.push(node)
      }
      return result
    }

    const body = document.body
    if (!body) return []
    assignIds(body)
    const stack: Element[] = [body]
    while (stack.length) {
      const cur = stack.pop()
      if (!cur || cur.nodeType !== 1) continue
      if (cur.getAttribute(BRIDGE_ATTR)) applySemanticAttrs(cur)
      for (let i = 0; i < cur.children.length; i++) stack.push(cur.children[i])
    }
    const tree = parse(body, 0)
    if (!tree) return []
    return prune(tree.children, 1)
  })
}

async function migrate() {
  if (!env.DATABASE_URL) {
    console.error('DATABASE_URL not configured')
    process.exit(1)
  }

  const sql = postgres(env.DATABASE_URL)
  const db = drizzle(sql, { schema: dbSchema })
  const browser = await chromium.launch({ headless: true })

  let migrated = 0
  let alreadyOk = 0
  let failed = 0

  try {
    const allSpecs = await db.select().from(dbSchema.specs)
    console.log(`Found ${allSpecs.length} spec(s).`)

    for (const spec of allSpecs) {
      const pages = ((spec.pages ?? []) as StoredPage[]).slice()
      let changed = false

      for (const page of pages) {
        if (page.schema) {
          alreadyOk += 1
          continue
        }
        if (!page.html?.trim()) {
          console.warn(`  ⚠ ${spec.projectId}/${page.id}: no html, skipped`)
          failed += 1
          continue
        }

        const ctx = await browser.newContext()
        const tab = await ctx.newPage()
        try {
          await tab.setContent(page.html, { waitUntil: 'domcontentloaded' })
          const tree = await captureTree(tab)
          const schema = buildSchemaFromTree(page.id, page.title || 'Untitled', tree)
          if (!schema) {
            console.warn(`  ⚠ ${spec.projectId}/${page.id}: empty schema, skipped`)
            failed += 1
            continue
          }
          page.schema = schema
          migrated += 1
          changed = true
          console.log(`  ✓ ${spec.projectId}/${page.id}: migrated (${schema.page.sections.length} sections)`)
        } catch (err) {
          console.error(`  ✗ ${spec.projectId}/${page.id}: ${(err as Error).message}`)
          failed += 1
        } finally {
          await tab.close()
          await ctx.close()
        }
      }

      if (changed) {
        await db.update(dbSchema.specs).set({ pages }).where(eq(dbSchema.specs.id, spec.id))
      }
    }
  } finally {
    await browser.close()
    await sql.end()
  }

  console.log(`Done. migrated=${migrated}, already-schema=${alreadyOk}, failed=${failed}`)
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
