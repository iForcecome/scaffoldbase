# SpecFlow Ingestion Standardization Plan

This document defines the standard upload, ingestion, normalization, and page creation flow for SpecFlow.

The core rule:

```txt
Raw uploaded content is never the long-term canvas source.
Page Schema / Product Model is the editable source of truth.
HTML is an input material or render target, not the primary editing model.
```

## 1. Goals

SpecFlow should not become a generic dirty HTML editor. Users can upload HTML, PRD, Markdown, screenshots, PDFs, and code snippets, but every uploaded input must pass through a standard ingestion pipeline before it affects the canvas.

The system should:

- preserve raw uploads for traceability and reprocessing
- parse and clean uploaded content deterministically
- use AI to understand user intent and semantic structure
- generate an explainable ingestion plan
- produce clean internal models: `PageSchema`, future `SpecSchema`, assets, flows, and design tokens
- render standardized HTML from internal models

## 2. Non-Goals

Do not make these the default path:

```txt
Upload HTML -> pages[].html -> edit directly
Upload reference -> blindly create a page per file
AI returns full HTML -> save as source of truth
```

Direct legacy HTML editing may exist only as an emergency compatibility preview, not as the standard product path.

## 3. Data Layers

SpecFlow should separate uploaded material from editable canvas state.

```txt
Raw Material
-> Parsed Material
-> Normalized Material
-> Ingestion Plan
-> Product Model
-> Render Target
```

### 3.1 Raw Material

Raw uploads are immutable source evidence.

```ts
interface RawMaterial {
  id: string
  projectId: string
  filename: string
  mimeType: string
  size: number
  checksum: string
  originalText?: string
  originalUrl?: string
  createdAt: string
}
```

Usage:

- audit trail
- re-run ingestion after parser/model improvements
- compare conversion output with source
- show original preview when needed

Raw material is not edited directly.

### 3.2 Normalized Material

Normalized material is the AI-readable, structured interpretation of raw content.

```ts
type MaterialKind =
  | 'html-page'
  | 'html-document'
  | 'prd'
  | 'reference-site'
  | 'image-reference'
  | 'component-snippet'
  | 'unknown'

type MaterialIntent =
  | 'create-page'
  | 'reference-style'
  | 'reference-content'
  | 'extract-requirements'
  | 'extract-components'

interface NormalizedMaterial {
  id: string
  rawMaterialId: string
  kind: MaterialKind
  intent: MaterialIntent
  summary: string
  confidence: number
  extracted: {
    title?: string
    headings?: string[]
    sections?: Array<{
      id: string
      title?: string
      text?: string
      role?: string
    }>
    actions?: Array<{
      label: string
      intent?: string
    }>
    forms?: unknown[]
    tables?: unknown[]
    images?: unknown[]
    links?: unknown[]
    visualStyle?: {
      colors?: string[]
      typography?: string[]
      layout?: string
      density?: 'compact' | 'normal' | 'spacious'
    }
  }
}
```

### 3.3 Ingestion Plan

The ingestion plan is the explainable bridge between uploaded material and generated product model.

```ts
interface IngestionPlan {
  goal: string
  materials: Array<{
    materialId: string
    role:
      | 'source-page'
      | 'style-reference'
      | 'content-reference'
      | 'requirement-source'
      | 'asset'
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
```

The plan decides whether a material is a page source, style reference, content reference, requirement source, or asset.

Do not hide this decision. The product should surface it when confidence is low or when uploaded material is ambiguous.

### 3.4 Product Model

The canvas consumes internal product models.

```ts
interface ProductModel {
  projectId: string
  pages: PageSchema[]
  spec: SpecSchema
  assets: AssetSchema[]
  flows: FlowSchema[]
  designSystem: DesignSystemSchema
}
```

Near term, `PageSchema` is the primary model. `SpecSchema`, `AssetSchema`, and `FlowSchema` can be introduced after the schema-first canvas is stable.

## 4. Intent Resolution

Do not rely on a single hidden AI guess.

Intent should be resolved from:

```txt
user prompt
+ file content analysis
+ filename and file type hints
+ AI ingestion plan
+ optional user confirmation
```

Examples:

```txt
"导入这个 HTML，继续编辑"
-> role: source-page
-> intent: create-page
```

```txt
"参考这个官网风格，帮我做一个 CRM"
-> role: style-reference
-> intent: reference-style
```

```txt
"根据这份 PRD 生成产品原型"
-> role: requirement-source
-> intent: extract-requirements
```

```txt
only uploaded complex HTML, no prompt
-> parse content
-> generate ingestion plan
-> if confidence is high, proceed
-> if confidence is low, ask user to confirm page/reference/document role
```

## 5. HTML Ingestion Standard

HTML upload has two entry points:

1. Homepage project creation
2. Add page inside editor

Both must use the same ingestion pipeline.

### 5.1 Deterministic Cleaning

Before AI interpretation, clean and parse HTML.

Required deterministic steps:

- remove `<script>` by default
- remove event handlers such as `onclick`, `onload`, `onerror`
- block `javascript:` URLs
- remove analytics/tracking snippets
- extract document title
- extract meaningful body text
- extract sections, headings, buttons, links, forms, tables, images
- summarize CSS colors, typography, spacing, layout signals
- detect external assets
- detect if page depends heavily on runtime JS

The parser should produce `ParsedMaterial`, not `PageSchema` directly.

### 5.2 AI Semantic Reconstruction

AI receives:

- user prompt
- parsed material
- raw excerpts only when needed
- current design system
- available component registry
- Page Schema contract

AI outputs:

```txt
NormalizedMaterial
IngestionPlan
PageSchema[]
conversion report
```

AI should preserve intent, content, hierarchy, and visual direction. It should not preserve dirty DOM structure.

### 5.3 Conversion Report

Every HTML-to-page conversion should produce a report.

```ts
interface ConversionReport {
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
```

This gives users trust and gives the editor a way to explain why some original behavior did not carry over.

## 6. Homepage Flow

Standard homepage flow:

```txt
User enters prompt and/or uploads files
-> create ingestion job
-> save raw materials
-> parse materials
-> normalize materials
-> generate ingestion plan
-> if confidence high: generate Product Model
-> if confidence low: show plan confirmation
-> create project with PageSchema pages
-> render standard HTML
-> enter editor
```

Important rule:

```txt
Homepage upload should not directly create legacy-html pages.
```

The project should enter the editor with schema-backed pages whenever page creation succeeds.

## 7. Add Page Upload Flow

Inside the editor, users may choose:

```txt
Add page -> Upload HTML
```

This is a page-level source-material flow.

Standard flow:

```txt
Upload HTML
-> save RawMaterial
-> deterministic clean + parse
-> AI semantic reconstruction
-> generate one PageSchema
-> render standard HTML
-> append page to project
-> open new page in editor
```

This path should not mean:

```txt
Upload HTML -> edit original HTML
```

It means:

```txt
Upload HTML as page source -> rebuild a clean SpecFlow page
```

## 8. Low Confidence Handling

If ingestion confidence is low, do not silently create a bad page.

Low confidence triggers:

- lots of JS-rendered content
- canvas/WebGL-heavy page
- very large bundled app shell
- missing meaningful body content
- many unsupported widgets
- conflicting prompt and file content
- AI plan uncertainty

User choices:

```txt
1. Standardize into editable SpecFlow page
2. Save as reference material
3. Cancel upload
```

An advanced legacy preview can exist, but it must be clearly marked as non-standard and not treated as the long-term editing model.

## 9. Page Object After Standardization

When HTML upload becomes an editable page, the page should look like this:

```ts
interface Page {
  id: string
  title: string
  source: 'schema'
  schema: PageSchema
  html: string
  origin?: {
    type: 'uploaded-html' | 'generated-from-prompt' | 'converted-reference'
    rawMaterialIds: string[]
    conversionReport: ConversionReport
  }
}
```

`html` must be generated by:

```ts
renderPageSchemaToHtml(page.schema)
```

It should not be the original uploaded HTML.

## 10. Editing Rule

All standard pages use schema editing:

```txt
AI instruction
-> schemaOperations
-> validate
-> apply PageSchema
-> render HTML
-> iframe preview
```

Legacy DOM/HTML fallback is only for temporary compatibility and should shrink over time.

## 11. Implementation Plan

### Phase A: Data Model

- Add `rawMaterials` storage.
- Add `normalizedMaterials` storage.
- Add `ingestionJobs` storage.
- Add page `origin` metadata.
- Stop treating uploaded HTML as direct `pages[].html` source.

### Phase B: Parser

- Add HTML parser and sanitizer.
- Extract headings, sections, links, buttons, forms, tables, images, text, CSS style summary.
- Produce deterministic `ParsedMaterial`.

### Phase C: AI Normalizer

- Add prompts and validators for:
  - `NormalizedMaterial`
  - `IngestionPlan`
  - `PageSchema[]`
  - `ConversionReport`

### Phase D: Homepage Ingestion Flow

- Replace direct `initialPages` upload path with ingestion job creation.
- Show ingestion progress.
- If high confidence, proceed automatically.
- If low confidence, show plan confirmation.

### Phase E: Add Page Upload Flow

- Add editor-side "Upload HTML as page source".
- Run the same ingestion pipeline.
- Append generated schema-backed page.

### Phase F: Legacy Decommission

- Keep legacy preview only for unsupported conversions.
- Remove default legacy page creation.
- Remove DOM operation fallback for schema-backed pages once coverage is sufficient.

## 12. Current Project Decision

Going forward:

```txt
SpecFlow does not edit user-uploaded HTML as source.
SpecFlow ingests user-uploaded HTML and rebuilds clean schema-backed pages.
```

This is the product distinction:

```txt
Not HTML editor.
AI product design workbench with a standardized internal model.
```
