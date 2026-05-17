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

## Current Vertical Slice

Target:

```txt
Semantic DOM baseline
```

Acceptance:

- [x] `pnpm build` passes.
- [x] Existing pages still render.
- [x] Bridge emits semantic metadata when `data-sf-*` exists.
- [x] Layer tree displays semantic labels.
- [x] Right panel displays semantic component/role/spec fields for selected node.
