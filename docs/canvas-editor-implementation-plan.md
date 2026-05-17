# SpecFlow Canvas Editor Refactor Plan

This document is the Phase 2 plan for the canvas editor. The first implementation pass proved the core pieces: iframe preview, semantic DOM metadata, operation JSON, design-system CSS, Page Schema rendering, legacy HTML migration, and exports. The next step is to make Page Schema the primary source of truth for the canvas.

## 1. Target

The canvas should become:

```txt
Page Schema source
-> renderer
-> semantic HTML
-> iframe preview
-> bridge selection and measurements
-> schema operations
-> render again
```

HTML remains important, but its role changes:

- It is the iframe render target.
- It is the export target.
- It is a legacy compatibility format.
- It should not be the main editable source for new pages.

The product position stays the same: SpecFlow is not a Figma clone. It is a schema-backed product workbench for solo founders, freelancers, independent developers, and outsourcing clients.

## 2. Current State

Already implemented:

- iframe-based canvas preview
- semantic `data-sf-*` bridge metadata
- legacy HTML runtime semantic upgrade
- AI operation JSON for selected-element edits
- `replaceText`, `setVariant`, `updateStyle`, `replaceClass`
- design-system tokens, component recipes, and generated `sf-*` CSS
- Page Schema types, validator, renderer, and default page generation
- derived page schema from DOM tree on save for legacy pages
- semantic index from DOM tree
- `spec.json` and HTML PRD export endpoints

Still transitional:

- `Page.html` and `Page.schema` both exist, but `html` is still often the active source.
- AI edit flow still applies operations in the iframe and then recovers HTML.
- legacy imported pages are only partially schema-like.
- `spec.json` is currently an export aggregation, not a full AI-generated product spec.

## 3. New Rule

For Phase 2:

> New pages and schema-backed pages are edited through schema first. HTML is regenerated from schema.

Legacy pages may continue through iframe DOM edits until migrated, but every change should try to produce or improve `page.schema`.

## 4. Page Data Model

Use this practical page model:

```ts
interface Page {
  id: string
  title: string
  schema: PageSchema | null
  html: string
  source: 'schema' | 'legacy-html'
  updatedAt?: string
}
```

Implementation note:

- The database can keep using `specs.pages` JSONB for now.
- Add `source` without a DB migration because `pages` is JSONB.
- Existing pages without `source` should be treated as `legacy-html`.
- New pages should use `source: 'schema'`.

## 5. Page Schema

The schema must be stable before building a richer product spec.

Minimum stable shape:

```ts
interface PageSchema {
  page: {
    id: string
    title: string
    layout: 'dashboard' | 'marketing' | 'form-flow' | 'detail' | 'settings'
    sections: ComponentNode[]
  }
}

interface ComponentNode {
  id: string
  component: string
  role?: string
  label?: string
  variant?: string
  props: Record<string, unknown>
  children?: ComponentNode[]
}
```

Next schema work:

- add component-specific prop validators
- add supported variants from the component registry
- add `actions` for safe runtime interactions
- add `bindings` for future spec/data/API binding

Do not build a full product spec editor yet.

## 6. Render Flow

For `source: 'schema'` pages:

```txt
schema
-> validate
-> renderPageSchemaToHtml(schema)
-> injectBridge(html)
-> iframe.srcDoc
```

On save:

```txt
schema-backed page:
  save schema + generated html

legacy page:
  recover html from iframe
  derive best-effort schema from domTree
  save html + derived schema
```

This keeps old pages usable while new pages move toward schema-first.

## 7. Edit Flow

There should be two operation layers.

### 7.1 Schema Operations

Used for schema-backed pages.

Start with:

```ts
type SchemaOperation =
  | { type: 'replaceText'; target: string; text: string }
  | { type: 'setVariant'; target: string; variant: string }
  | { type: 'updateProps'; target: string; props: Record<string, unknown> }
  | { type: 'insertComponent'; parent: string; position: 'before' | 'after' | 'inside:start' | 'inside:end'; node: ComponentNode }
  | { type: 'removeNode'; target: string }
  | { type: 'moveNode'; target: string; parent: string; position: string }
```

Execution:

```txt
AI/user command
-> SchemaOperation JSON
-> validate
-> apply to PageSchema
-> render HTML
-> update iframe
-> mark dirty
```

### 7.2 DOM Operations

Used only for legacy pages and measurement-only interactions.

Current supported operations remain:

- `replaceText`
- `setVariant`
- `updateStyle`
- `replaceClass`

This layer should shrink over time.

## 8. AI Flow

For schema-backed pages, prompt AI with:

- page schema
- selected node
- semantic index summary
- available components
- supported operations
- design-system constraints

AI should return schema operations, not HTML.

For legacy pages:

- keep current operation/fragment fallback
- after applying, derive schema from the resulting DOM

Do not use conversation history to synthesize full `spec.json` yet. That belongs after schema-first editing is stable.

## 9. Component Registry

The registry should become the single place that defines:

- component name
- allowed props
- allowed variants
- renderer
- default props
- safe actions

Near-term components:

- `PageHeader`
- `FilterBar`
- `DataTable`
- `Button`
- `FormSection`
- `Modal`
- `EmptyState`
- `Navigation`
- `Section`
- `StatsGrid`
- `CardGrid`

The renderer should not accept arbitrary component names without a generic fallback.

## 10. CSS

Keep:

```txt
tokens + component recipes + variants + safe style patches
```

Do not reintroduce Tailwind CDN for generated canvas pages.

Schema-backed pages should produce self-contained HTML:

```html
<style data-sf-design-system>...</style>
```

Legacy imported pages may still contain Tailwind classes, but new generated pages should not depend on Tailwind CDN.

## 11. Legacy Migration

Migration is gradual:

1. Open legacy HTML.
2. bridge assigns runtime IDs and upgrades semantic attributes.
3. user edits or saves.
4. editor derives `PageSchema` from DOM tree.
5. page becomes partially schema-backed.
6. later, explicit "Upgrade page to schema source" can switch `source` to `schema`.

Do not silently discard original HTML for complex imported pages until the schema renderer can reproduce them adequately.

## 12. Exports

Keep two export products:

- `spec.json`
- HTML PRD

For now:

- `spec.json` should export project metadata, pages, page schemas, semantic index, tokens, and existing spec placeholders.
- HTML PRD should render the current page HTML snapshots.

Later:

- generate `spec.md` from `spec.json` if human-readable Markdown is needed.
- synthesize data models, API contracts, and quality rules from stable schema plus user conversations.

## 13. Execution Plan

### Phase 2.1: Page Source Model

- add `source: 'schema' | 'legacy-html'` to page objects
- treat missing source as `legacy-html`
- new pages use `schema`
- save schema-backed pages by regenerating HTML from schema

### Phase 2.2: Schema Operation Engine

- add SchemaOperation types and validator
- add schema tree helpers: find, replace, insert, remove, move
- execute `replaceText`, `setVariant`, `updateProps`
- render and reload iframe after schema operation

### Phase 2.3: AI Schema Edit

- send page schema and selected schema node to AI
- request SchemaOperation JSON for schema-backed pages
- keep DOM operation fallback for legacy pages

### Phase 2.4: Component Registry Hardening

- add prop definitions and default props
- validate variants against recipes
- add `Section`, `StatsGrid`, `CardGrid`, `Navigation`

### Phase 2.5: Legacy Upgrade UI

- show page source status in the UI
- add an explicit "Upgrade to schema" action
- preserve original HTML until the user confirms

## 14. Current Priority

Do next:

```txt
Phase 2.1 Page Source Model
```

This is the foundation for the full canvas refactor. It is small enough to verify and does not require changing AI behavior immediately.

