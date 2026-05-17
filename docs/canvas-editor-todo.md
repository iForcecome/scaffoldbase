# Canvas Editor TODO

This checklist tracks the implementation path for the semantic HTML canvas and AI operation workflow.

## Phase 0: Stabilize Current Editor

- [x] Fix current TypeScript build errors.
- [x] Keep iframe rendering, selection, style editing, save, undo, and redo working.
- [x] Run `pnpm build` after each vertical slice.

## Phase 1: Semantic DOM

- [x] Extend editor DOM node types with semantic metadata:
  - `sfId`
  - `component`
  - `role`
  - `label`
  - `variant`
  - `specPath`
- [x] Update iframe bridge to read existing `data-sf-*` attributes.
- [x] Keep runtime `sf-*` IDs as fallback only.
- [x] Update layer tree to prefer semantic labels.
- [x] Update right panel to show component/role/spec binding.
- [x] Add fallback inference for legacy HTML.
- [x] Upgrade legacy HTML with semantic attributes at runtime on load and replace.

## Phase 2: AI Operation JSON

- [x] Add operation TypeScript types.
- [x] Add operation validation against allowed operations and safe style props.
- [x] Add bridge operation executor for:
  - `replaceText`
  - `setVariant`
  - `updateStyle`
  - `replaceClass`
- [x] Update selected-node AI prompt to request operation JSON first.
- [x] Keep existing HTML fragment replacement as fallback.

## Phase 3: CSS Design System

- [x] Add `canvas-editor/src/design-system/tokens.ts`.
- [x] Add `component-recipes.ts`.
- [x] Add `style-whitelist.ts`.
- [x] Add `render-css.ts`.
- [x] Define first component recipes:
  - `PageHeader`
  - `FilterBar`
  - `DataTable`
  - `Button`
  - `FormSection`
  - `Modal`
  - `EmptyState`
- [x] Support `setVariant` class changes.
- [x] Start moving generated pages away from Tailwind CDN toward self-contained `sf-*` CSS.

## Phase 4: Page Schema Generation

- [x] Add Page Schema TypeScript types.
- [x] Add schema validator.
- [x] Add component registry renderer.
- [x] Generate new pages from Page Schema JSON.
- [x] Store schema next to HTML.

## Phase 5: Spec Synchronization

- [x] Build semantic index from DOM tree.
- [x] Bind DOM nodes to spec paths.
- [x] Make `SpecStatus` read real page/spec/token counts.
- [x] Export `spec.json`.
- [x] Export self-contained HTML PRD.
- [x] Derive page schema from current DOM tree on save for legacy pages.

## Phase 6: Schema-First Canvas Refactor

- [x] Add page source model: `source: 'schema' | 'legacy-html'`.
- [x] Treat missing `source` as `legacy-html`.
- [x] Make new pages use `source: 'schema'`.
- [x] Save schema-backed pages by regenerating HTML from schema.
- [x] Add schema operation TypeScript types.
- [x] Add schema operation validator.
- [x] Add schema tree helpers: find, update, insert, remove, move.
- [x] Execute `replaceText`, `setVariant`, and `updateProps` against Page Schema.
- [x] Render iframe HTML from schema after schema operations.
- [x] Route AI edits to schema operations for schema-backed pages.
- [x] Keep DOM operation fallback for legacy pages.
- [x] Show page source status in the UI.
- [x] Add explicit legacy page upgrade action.
- [x] Add component-specific prop and variant validation.

## Phase 7: AI Schema Edit

- [x] Send schema-backed page requests with `pageSource` and current `pageSchema`.
- [x] Add server-side schema operation prompt.
- [x] Return `schemaOperations` over SSE for schema-backed pages.
- [x] Apply `schemaOperations` directly to Page Schema on the client.
- [x] Keep legacy HTML, fragment, and DOM operation modes as fallback.
- [x] Add UI/debug visibility for which AI edit mode was used.
- [x] Add dry-run examples for schema operation responses.

## Phase 8: Homepage Upload To Editor Flow

- [x] Let project creation accept uploaded HTML materials.
- [x] Read `.html` files from the homepage upload control and send them into ingestion.
- [x] Allow file-only HTML upload to create a project without prompt text.
- [x] Remove the fixed legacy HTML import script.
- [x] Clear existing project data from the local database.
- [x] Verify a temporary uploaded HTML project can be created, read, and deleted through the API.

## Phase 9: Standard Ingestion Pipeline

- [x] Add server-side ingestion service with Raw Material, Normalized Material, Ingestion Plan, and Conversion Report outputs.
- [x] Add `raw_materials`, `normalized_materials`, and `ingestion_jobs` storage on specs.
- [x] Make project creation use `ingestionMaterials` instead of direct `initialPages`.
- [x] Generate schema-backed pages from uploaded HTML materials.
- [x] Add `/projects/:id/ingest` for editor-side add-page uploads.
- [x] Add "Upload HTML as page" action in the page list.
- [x] Ensure generated `Section` nodes render and validate in the frontend Page Schema renderer.
- [x] Apply local database columns for ingestion storage.
- [x] Verify a temporary uploaded HTML is standardized into `source: schema` page and then delete the test project.

## Current Vertical Slice

Target:

```txt
Phase 9.1 Standard HTML Ingestion Flow
```

Acceptance:

- [x] `pnpm build` passes.
- [x] Schema operation types exist for text, variant, props, insert, remove, and move.
- [x] Schema operations are validated before execution.
- [x] Schema pages can apply `replaceText`, `setVariant`, and `updateProps` without DOM mutation.
- [x] Schema operation execution regenerates iframe HTML from Page Schema.
- [x] Legacy pages keep the DOM bridge operation fallback.
- [x] Legacy pages can be explicitly converted to schema-backed pages from page properties.
- [x] Known schema components validate supported variants and common prop shapes.
- [x] `pnpm build` passes after schema AI flow changes.
- [x] Schema-backed AI edits no longer need HTML fragment replacement.
- [x] Legacy AI edits keep the previous fallback flow.
- [x] Homepage upload can create initial project pages.
- [x] Local project list is empty after clearing old data.
- [x] Uploaded HTML no longer becomes a direct legacy page by default.
- [x] Uploaded HTML is converted into Raw Material, Normalized Material, Ingestion Plan, Conversion Report, Page Schema, and rendered standard HTML.
