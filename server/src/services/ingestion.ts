import { createHash, randomUUID } from 'node:crypto'

export type PageLayout = 'dashboard' | 'marketing' | 'form-flow' | 'detail' | 'settings'

export interface ComponentNode {
  id: string
  component: string
  role?: string
  label?: string
  variant?: string
  props: Record<string, unknown>
  children?: ComponentNode[]
}

export interface PageSchema {
  page: {
    id: string
    title: string
    layout: PageLayout
    theme?: {
      brandColor?: string
      brandColorStrong?: string
      backgroundColor?: string
      surfaceColor?: string
      surfaceColorRaised?: string
      borderColor?: string
      textColor?: string
      textColorSecondary?: string
      mutedTextColor?: string
      fontFamily?: string
    }
    sections: ComponentNode[]
  }
}

export interface RawMaterial {
  id: string
  projectId?: string
  filename: string
  mimeType: string
  size: number
  checksum: string
  originalText?: string
  intendedUse?: IngestionMaterialInput['intendedUse']
  createdAt: string
}

export type MaterialKind =
  | 'html-page'
  | 'html-document'
  | 'prd'
  | 'reference-site'
  | 'image-reference'
  | 'component-snippet'
  | 'unknown'

export type MaterialIntent =
  | 'create-page'
  | 'reference-style'
  | 'reference-content'
  | 'extract-requirements'
  | 'extract-components'

export interface NormalizedMaterial {
  id: string
  rawMaterialId: string
  kind: MaterialKind
  intent: MaterialIntent
  summary: string
  confidence: number
  extracted: {
    title?: string
    headings?: string[]
    sections?: Array<{ id: string; title?: string; text?: string; role?: string }>
    actions?: Array<{ label: string; intent?: string }>
    forms?: unknown[]
    tables?: unknown[]
    images?: unknown[]
    links?: unknown[]
    visualStyle?: {
      colors?: string[]
      typography?: string[]
      layout?: string
      density?: 'compact' | 'normal' | 'spacious'
      theme?: PageSchema['page']['theme']
    }
  }
}

export interface IngestionPlan {
  goal: string
  materials: Array<{
    materialId: string
    role: 'source-page' | 'style-reference' | 'content-reference' | 'requirement-source' | 'asset'
    confidence: number
    reason: string
  }>
  pagesToCreate: Array<{
    id: string
    title: string
    layout: PageLayout
    sourceMaterialIds: string[]
    requirements: string[]
    visualReferences: string[]
  }>
  specToCreate: {
    productSummary: string
    userRoles: string[]
    coreFeatures: string[]
    constraints: string[]
  }
}

export interface ConversionReport {
  confidence: number
  sourceMaterialIds: string[]
  createdPageIds: string[]
  preserved: string[]
  discarded: Array<{
    type: 'script' | 'event-handler' | 'tracking' | 'unsupported-style' | 'external-runtime'
    reason: string
  }>
  warnings: string[]
}

export interface IngestionMaterialInput {
  filename: string
  mimeType?: string
  content: string
  intendedUse?: 'page' | 'reference' | 'requirements' | 'asset' | 'auto'
}

export interface StandardPage {
  id: string
  title: string
  schema: PageSchema
  html: string
  origin: {
    type: 'uploaded-html' | 'generated-from-prompt' | 'converted-reference'
    rawMaterialIds: string[]
    conversionReport: ConversionReport
  }
}

export interface IngestionResult {
  rawMaterials: RawMaterial[]
  normalizedMaterials: NormalizedMaterial[]
  ingestionPlan: IngestionPlan
  pages: StandardPage[]
  conversionReport: ConversionReport
}

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8)
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return slug || fallback
}

function createSafeId(prefix: string, value: string, index: number): string {
  const safe = slugify(value, `${prefix}-${index + 1}`)
  return `${prefix}-${safe}-${shortHash(`${value}:${index}`)}`
}

function ensureUniqueId(id: string, used: Set<string>): string {
  let candidate = id
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${id}-${suffix}`
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

function getFileStem(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim() || filename
}

function extractColorGroup(html: string, group: string): Record<string, string> {
  const groupMatch = html.match(new RegExp(`${group}\\s*:\\s*\\{([\\s\\S]*?)\\}`, 'i'))
  if (!groupMatch) return {}
  const values: Record<string, string> = {}
  const colorRegex = /([a-zA-Z0-9_-]+)\s*:\s*['"]?(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))['"]?/g
  let match: RegExpExecArray | null
  while ((match = colorRegex.exec(groupMatch[1])) !== null) {
    values[match[1]] = match[2]
  }
  return values
}

function extractCssColor(html: string, property: string): string | undefined {
  const match = html.match(new RegExp(`${property}\\s*:\\s*(#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\))`, 'i'))
  return match?.[1]
}

function extractFontFamily(html: string): string | undefined {
  if (/fontFamily\s*:\s*\{[\s\S]*?sans\s*:\s*\[([\s\S]*?)\]/i.test(html)) {
    return '"Inter", "Noto Sans SC", system-ui, sans-serif'
  }
  if (/Playfair Display/i.test(html)) {
    return '"Inter", "Noto Sans SC", system-ui, sans-serif'
  }
  return undefined
}

function extractTheme(html: string, colors: string[]): PageSchema['page']['theme'] {
  const bg = extractColorGroup(html, 'bg')
  const warm = extractColorGroup(html, 'warm')
  const flame = extractColorGroup(html, 'flame')
  const gold = extractColorGroup(html, 'gold')
  const line = extractColorGroup(html, 'line')
  const bodyBackground = extractCssColor(html, 'background')
  const fallbackBrand = colors.find(color => /^#(?:f97316|ea580c|fb923c|fbbf24)$/i.test(color)) ?? colors.find(color => !/^#(?:fff|ffffff|000|000000)$/i.test(color))

  return {
    brandColor: flame['500'] ?? flame['600'] ?? gold['500'] ?? fallbackBrand ?? '#2563eb',
    brandColorStrong: flame['700'] ?? flame['600'] ?? '#1d4ed8',
    backgroundColor: bg['0'] ?? bodyBackground ?? '#f6f7fb',
    surfaceColor: bg['1'] ?? '#ffffff',
    surfaceColorRaised: bg['2'] ?? '#f1f3f9',
    borderColor: line['2'] ?? line['1'] ?? '#dde2ec',
    textColor: warm['0'] ?? '#172033',
    textColorSecondary: warm['1'] ?? '#334155',
    mutedTextColor: warm['2'] ?? '#667085',
    fontFamily: extractFontFamily(html),
  }
}

function extractAll(html: string, pattern: RegExp, mapper: (match: RegExpExecArray, index: number) => string): string[] {
  const values: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html)) !== null) {
    const value = decodeEntities(stripTags(mapper(match, values.length))).trim()
    if (value) values.push(value)
  }
  return values
}

function parseHtmlMaterial(raw: RawMaterial): NormalizedMaterial {
  const html = raw.originalText ?? ''
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = decodeEntities(stripTags(titleMatch?.[1] || h1Match?.[1] || getFileStem(raw.filename)))
  const headings = extractAll(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, match => match[1]).slice(0, 24)
  const actions = extractAll(html, /<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/gi, match => match[2])
    .filter(label => label.length <= 80)
    .slice(0, 16)
    .map(label => ({ label }))
  const links = extractAll(html, /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, match => `${stripTags(match[2])} ${match[1]}`).slice(0, 30)
  const images = Array.from(html.matchAll(/<img\b[^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi)).slice(0, 20).map((match, index) => ({
    id: `image-${index + 1}`,
    alt: match[1] ?? '',
  }))
  const colors = Array.from(new Set(Array.from(html.matchAll(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g)).map(match => match[0]))).slice(0, 16)
  const theme = extractTheme(html, colors)
  const bodyText = decodeEntities(stripTags(html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html))
  const textChunks = bodyText.split(/[。.!?！？\n]/).map(item => item.trim()).filter(Boolean).slice(0, 8)
  const sections = textChunks.map((text, index) => ({
    id: `section-${index + 1}`,
    title: headings[index],
    text: text.slice(0, 600),
    role: index === 0 ? 'hero' : 'content',
  }))
  const scriptCount = (html.match(/<script\b/gi) ?? []).length
  const eventHandlerCount = (html.match(/\son[a-z]+\s*=/gi) ?? []).length
  const isDocumentLike = headings.length >= 5 && actions.length <= 3 && bodyText.length > 1200
  const kind: MaterialKind = isDocumentLike ? 'html-document' : 'html-page'
  const confidence = Math.max(0.35, Math.min(0.92, 0.74 + Math.min(headings.length, 5) * 0.02 - scriptCount * 0.08 - eventHandlerCount * 0.04))

  return {
    id: randomUUID(),
    rawMaterialId: raw.id,
    kind,
    intent: kind === 'html-page' ? 'create-page' : 'extract-requirements',
    summary: `${title}。识别到 ${headings.length} 个标题、${actions.length} 个操作、${sections.length} 个内容片段。`,
    confidence,
    extracted: {
      title,
      headings,
      sections,
      actions,
      images,
      links,
      visualStyle: {
        colors,
        theme,
        layout: /grid/i.test(html) ? 'grid' : /flex/i.test(html) ? 'flex' : 'document',
        density: bodyText.length > 1800 ? 'compact' : 'normal',
      },
    },
  }
}

function parseGenericMaterial(raw: RawMaterial): NormalizedMaterial {
  const text = raw.originalText ?? ''
  const name = getFileStem(raw.filename)
  const isImage = raw.mimeType.startsWith('image/')
  const isMarkdown = raw.filename.toLowerCase().endsWith('.md') || raw.mimeType.includes('markdown')
  const isPdf = raw.filename.toLowerCase().endsWith('.pdf') || raw.mimeType === 'application/pdf'
  const plainText = decodeEntities(stripTags(text))
  const headings = isMarkdown
    ? Array.from(text.matchAll(/^#{1,3}\s+(.+)$/gm)).map(match => match[1].trim()).slice(0, 24)
    : plainText.split(/[。.!?！？\n]/).map(item => item.trim()).filter(Boolean).slice(0, 8)
  const sections = headings.slice(0, 8).map((heading, index) => ({
    id: `section-${index + 1}`,
    title: heading,
    text: plainText.slice(index * 400, (index + 1) * 400),
    role: index === 0 ? 'summary' : 'content',
  }))

  const kind: MaterialKind = isImage
    ? 'image-reference'
    : isPdf || isMarkdown
      ? 'prd'
      : raw.intendedUse === 'asset'
        ? 'component-snippet'
        : 'unknown'

  const intent: MaterialIntent = raw.intendedUse === 'requirements' || kind === 'prd'
    ? 'extract-requirements'
    : raw.intendedUse === 'reference' || isImage
      ? 'reference-style'
      : 'reference-content'

  return {
    id: randomUUID(),
    rawMaterialId: raw.id,
    kind,
    intent,
    summary: isImage
      ? `${name}。图片类参考物料已保存，后续可用于视觉参考。`
      : `${name}。识别为${kind === 'prd' ? '需求/文档' : '参考'}物料，提取到 ${headings.length} 个文本片段。`,
    confidence: isImage ? 0.55 : 0.62,
    extracted: {
      title: name,
      headings,
      sections,
      images: isImage ? [{ id: 'image-1', alt: name }] : [],
      visualStyle: {
        layout: isImage ? 'image-reference' : 'document',
        density: plainText.length > 1800 ? 'compact' : 'normal',
      },
    },
  }
}

function parseMaterial(raw: RawMaterial): NormalizedMaterial {
  const filename = raw.filename.toLowerCase()
  if (raw.mimeType === 'text/html' || filename.endsWith('.html') || filename.endsWith('.htm')) {
    return parseHtmlMaterial(raw)
  }
  return parseGenericMaterial(raw)
}

function inferLayout(material: NormalizedMaterial): PageLayout {
  const text = `${material.extracted.title ?? ''} ${material.summary}`.toLowerCase()
  if (material.kind === 'html-document' || /prd|需求|文档|spec/.test(text)) return 'detail'
  if (/landing|官网|首页|营销|hero/.test(text)) return 'marketing'
  if (/表单|配置|设置|提交/.test(text)) return 'form-flow'
  return 'dashboard'
}

function pickThemeColor(colors: string[] | undefined, fallback: string): string {
  if (!colors || colors.length === 0) return fallback
  return colors.find(color => !/^#(?:fff|ffffff|000|000000)$/i.test(color)) ?? colors[0] ?? fallback
}

function buildPageSchema(material: NormalizedMaterial, index: number, pageId: string): PageSchema {
  const title = material.extracted.title || `页面 ${index + 1}`
  const sections = material.extracted.sections ?? []
  const actions = material.extracted.actions ?? []
  const layout = inferLayout(material)
  const colors = material.extracted.visualStyle?.colors
  const extractedTheme = material.extracted.visualStyle?.theme
  const brandColor = extractedTheme?.brandColor ?? pickThemeColor(colors, '#2563eb')

  const schemaSections: ComponentNode[] = [
    {
      id: `${pageId}.header`,
      component: 'PageHeader',
      role: 'header',
      label: '页面标题区',
      variant: layout === 'marketing' ? 'spacious' : 'default',
      props: {
        title,
        description: sections[0]?.text ?? material.summary,
        actions: actions.slice(0, 2).map((action, actionIndex) => ({
          label: action.label,
          variant: actionIndex === 0 ? 'primary' : 'default',
        })),
      },
    },
  ]

  const contentSections = sections.slice(1, 7)
  if (contentSections.length > 0) {
    schemaSections.push(...contentSections.map((section, sectionIndex) => ({
      id: `${pageId}.section.${sectionIndex + 1}`,
      component: 'Section',
      role: section.role ?? 'content',
      label: section.title ?? `内容区 ${sectionIndex + 1}`,
      variant: 'default',
      props: {
        title: section.title ?? `内容区 ${sectionIndex + 1}`,
        description: section.text ?? '',
      },
    })))
  }

  if (layout === 'dashboard') {
    schemaSections.push({
      id: `${pageId}.table`,
      component: 'DataTable',
      role: 'table',
      label: '信息表格',
      variant: 'default',
      props: {
        columns: [
          { key: 'name', label: '名称' },
          { key: 'status', label: '状态' },
          { key: 'note', label: '说明' },
        ],
        rows: (material.extracted.headings ?? []).slice(0, 5).map((heading, rowIndex) => ({
          name: heading,
          status: rowIndex === 0 ? '重点' : '待细化',
          note: sections[rowIndex]?.text ?? '由上传材料提取',
        })),
      },
    })
  }

  return {
    page: {
      id: pageId,
      title,
      layout,
      theme: {
        ...extractedTheme,
        brandColor,
        backgroundColor: extractedTheme?.backgroundColor ?? (layout === 'marketing' ? '#f8fafc' : '#f6f7fb'),
        surfaceColor: extractedTheme?.surfaceColor ?? '#ffffff',
        textColor: extractedTheme?.textColor ?? '#172033',
        mutedTextColor: extractedTheme?.mutedTextColor ?? '#667085',
      },
      sections: schemaSections,
    },
  }
}

function renderComponent(node: ComponentNode): string {
  const attrs = `data-sf-id="${escapeHtml(node.id)}" data-sf-component="${escapeHtml(node.component)}"${node.role ? ` data-sf-role="${escapeHtml(node.role)}"` : ''}${node.label ? ` data-sf-label="${escapeHtml(node.label)}"` : ''}${node.variant ? ` data-sf-variant="${escapeHtml(node.variant)}"` : ''}`
  if (node.component === 'PageHeader') {
    const actions = Array.isArray(node.props.actions) ? node.props.actions as Array<Record<string, unknown>> : []
    return `<section ${attrs} class="sf-page-header sf-page-header--${escapeHtml(node.variant ?? 'default')}">
  <div>
    <h1 data-sf-id="${escapeHtml(`${node.id}.title`)}">${escapeHtml(node.props.title ?? node.label)}</h1>
    <p data-sf-id="${escapeHtml(`${node.id}.description`)}">${escapeHtml(node.props.description ?? '')}</p>
  </div>
  <div class="sf-page-header__actions">${actions.map((action, index) => `<button data-sf-id="${escapeHtml(`${node.id}.action.${index}`)}" class="sf-button sf-button--${escapeHtml(action.variant ?? 'default')}">${escapeHtml(action.label ?? `操作 ${index + 1}`)}</button>`).join('')}</div>
</section>`
  }
  if (node.component === 'DataTable') {
    const columns = Array.isArray(node.props.columns) ? node.props.columns as Array<Record<string, unknown>> : []
    const rows = Array.isArray(node.props.rows) ? node.props.rows as Array<Record<string, unknown>> : []
    return `<section ${attrs} class="sf-data-table sf-data-table--${escapeHtml(node.variant ?? 'default')}">
  <table>
    <thead><tr>${columns.map(col => `<th>${escapeHtml(col.label ?? col.key)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${columns.map(col => `<td>${escapeHtml(row[String(col.key)] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
</section>`
  }
  return `<section ${attrs} class="sf-section sf-section--${escapeHtml(node.variant ?? 'default')}">
  ${node.props.title ? `<h2 data-sf-id="${escapeHtml(`${node.id}.title`)}">${escapeHtml(node.props.title)}</h2>` : ''}
  ${node.props.description ? `<p data-sf-id="${escapeHtml(`${node.id}.description`)}">${escapeHtml(node.props.description)}</p>` : ''}
</section>`
}

export function renderStandardPageHtml(schema: PageSchema): string {
  const body = schema.page.sections.map(renderComponent).join('\n')
  const theme = schema.page.theme ?? {}
  const brandColor = theme.brandColor ?? '#2563eb'
  const brandColorStrong = theme.brandColorStrong ?? brandColor
  const backgroundColor = theme.backgroundColor ?? '#f6f7fb'
  const surfaceColor = theme.surfaceColor ?? '#ffffff'
  const surfaceColorRaised = theme.surfaceColorRaised ?? '#f8fafc'
  const borderColor = theme.borderColor ?? '#dde2ec'
  const textColor = theme.textColor ?? '#172033'
  const textColorSecondary = theme.textColorSecondary ?? textColor
  const mutedTextColor = theme.mutedTextColor ?? '#667085'
  const fontFamily = theme.fontFamily ?? 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; font-family: ${escapeHtml(fontFamily)}; color: ${escapeHtml(textColor)}; background: ${escapeHtml(backgroundColor)}; }
.sf-page-shell { display: grid; gap: 18px; padding: 24px; }
.sf-page-header, .sf-section, .sf-data-table { background: ${escapeHtml(surfaceColor)}; border: 1px solid ${escapeHtml(borderColor)}; border-radius: 12px; padding: 20px; }
.sf-page-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.sf-page-header--spacious { padding: 32px; }
h1, h2, p { margin: 0; }
h1 { font-size: 32px; line-height: 1.15; color: ${escapeHtml(textColor)}; }
h2 { font-size: 20px; margin-bottom: 8px; color: ${escapeHtml(textColorSecondary)}; }
p { color: ${escapeHtml(mutedTextColor)}; line-height: 1.65; }
.sf-page-header__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.sf-button { border: 1px solid #dde2ec; background: #fff; border-radius: 8px; height: 36px; padding: 0 14px; font-weight: 600; }
.sf-button--primary { background: ${escapeHtml(brandColor)}; color: #fff; border-color: ${escapeHtml(brandColorStrong)}; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px; border-bottom: 1px solid ${escapeHtml(borderColor)}; text-align: left; }
th { color: ${escapeHtml(textColorSecondary)}; font-size: 13px; background: ${escapeHtml(surfaceColorRaised)}; }
</style>
</head>
<body>
  <main class="sf-page-shell sf-page-shell--${escapeHtml(schema.page.layout)}" data-sf-page-id="${escapeHtml(schema.page.id)}" data-sf-page-title="${escapeHtml(schema.page.title)}">
    ${body}
  </main>
</body>
</html>`
}

export function ingestMaterials(input: {
  prompt?: string
  materials: IngestionMaterialInput[]
}): IngestionResult {
  const now = new Date().toISOString()
  const rawMaterials = input.materials.map(material => ({
    id: randomUUID(),
    filename: material.filename,
    mimeType: material.mimeType || (material.filename.toLowerCase().endsWith('.html') ? 'text/html' : 'text/plain'),
    size: Buffer.byteLength(material.content, 'utf8'),
    checksum: checksum(material.content),
    originalText: material.content,
    intendedUse: material.intendedUse ?? 'auto',
    createdAt: now,
  }))

  const normalizedMaterials = rawMaterials.map(parseMaterial)
  const sourceMaterials = normalizedMaterials.filter(material => material.intent === 'create-page' || material.kind === 'html-page')

  const plan: IngestionPlan = {
    goal: input.prompt?.trim() || '根据上传材料生成标准化页面',
    materials: normalizedMaterials.map(material => ({
      materialId: material.id,
      role: sourceMaterials.some(source => source.id === material.id) ? 'source-page' : 'requirement-source',
      confidence: material.confidence,
      reason: material.intent === 'create-page' ? '内容结构接近完整页面，可重建为 SpecFlow 标准页面。' : '内容更像文档资料，优先提取需求。',
    })),
    pagesToCreate: sourceMaterials.map((material, index) => {
      const title = material.extracted.title || `页面 ${index + 1}`
      return {
        id: createSafeId('page', title, index),
        title,
        layout: inferLayout(material),
        sourceMaterialIds: [material.id],
        requirements: material.extracted.sections?.map(section => section.text ?? '').filter(Boolean).slice(0, 6) ?? [],
        visualReferences: material.extracted.visualStyle?.colors ?? [],
      }
    }),
    specToCreate: {
      productSummary: input.prompt?.trim() || normalizedMaterials.map(material => material.summary).join('\n'),
      userRoles: [],
      coreFeatures: normalizedMaterials.flatMap(material => material.extracted.headings ?? []).slice(0, 12),
      constraints: ['上传内容已标准化为 SpecFlow Page Schema，原始 HTML 仅用于溯源。'],
    },
  }

  const usedPageIds = new Set<string>()
  const pages = sourceMaterials.map((material, index) => {
    const title = material.extracted.title || `页面 ${index + 1}`
    const pageId = ensureUniqueId(createSafeId('page', title, index), usedPageIds)
    const schema = buildPageSchema(material, index, pageId)
    const report: ConversionReport = {
      confidence: material.confidence,
      sourceMaterialIds: [material.rawMaterialId],
      createdPageIds: [schema.page.id],
      preserved: ['页面标题', '主要文本内容', '标题层级', '按钮/链接文案', '视觉颜色线索'],
      discarded: [
        { type: 'script', reason: '上传 HTML 中的脚本不会进入标准画布页面。' },
        { type: 'event-handler', reason: '内联事件处理器不属于安全 Page Schema。' },
      ],
      warnings: material.confidence < 0.6 ? ['转换置信度偏低，建议人工检查生成页面。'] : [],
    }
    return {
      id: schema.page.id,
      title: schema.page.title,
      schema,
      html: renderStandardPageHtml(schema),
      origin: {
        type: 'uploaded-html' as const,
        rawMaterialIds: [material.rawMaterialId],
        conversionReport: report,
      },
    }
  })

  const conversionReport: ConversionReport = {
    confidence: pages.length > 0 ? Math.min(...pages.map(page => page.origin.conversionReport.confidence)) : 0,
    sourceMaterialIds: rawMaterials.map(material => material.id),
    createdPageIds: pages.map(page => page.id),
    preserved: ['原始材料', '结构化摘要', '页面生成计划'],
    discarded: [],
    warnings: pages.length === 0 ? ['未识别到可直接转换为页面的上传材料。'] : [],
  }

  return { rawMaterials, normalizedMaterials, ingestionPlan: plan, pages, conversionReport }
}
