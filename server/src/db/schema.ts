import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum } from 'drizzle-orm/pg-core'

export const projectStatusEnum = pgEnum('project_status', ['draft', 'ready', 'exported', 'synced'])
export const qualityPresetEnum = pgEnum('quality_preset', ['mvp', 'production', 'enterprise'])
export const baasProviderEnum = pgEnum('baas_provider', ['supabase', 'pocketbase', 'none'])
export const exportTypeEnum = pgEnum('export_type', ['html_prd', 'project_base', 'spec_json'])
export const materialTypeEnum = pgEnum('material_type', ['animation', 'component', 'pattern'])

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').default(''),
  qualityPreset: qualityPresetEnum('quality_preset').default('mvp').notNull(),
  baasProvider: baasProviderEnum('baas_provider').default('none').notNull(),
  designTokenId: uuid('design_token_id'),
  status: projectStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const specs = pgTable('specs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  pages: jsonb('pages').$type<{ id: string; title: string; html: string; schema?: unknown; source?: 'schema' | 'legacy-html'; origin?: unknown }[]>().default([]),
  rawMaterials: jsonb('raw_materials').default([]),
  normalizedMaterials: jsonb('normalized_materials').default([]),
  ingestionJobs: jsonb('ingestion_jobs').default([]),
  dataModels: jsonb('data_models').default([]),
  apiContracts: jsonb('api_contracts').default([]),
  qualityRules: jsonb('quality_rules').default({}),
  stateMachines: jsonb('state_machines').default([]),
  snapshotHtml: text('snapshot_html'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  messages: jsonb('messages').$type<{ role: string; content: string; timestamp: number }[]>().default([]),
  specVersionAt: integer('spec_version_at').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const designTokens = pgTable('design_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  colors: jsonb('colors').default({}),
  typography: jsonb('typography').default({}),
  spacing: jsonb('spacing').default({}),
  isBuiltin: boolean('is_builtin').default(false).notNull(),
})

export const materialAssets = pgTable('material_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: materialTypeEnum('type').notNull(),
  name: text('name').notNull(),
  codeSnippet: text('code_snippet').default(''),
  previewUrl: text('preview_url'),
  tags: text('tags').array().default([]),
})

export const exports = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  type: exportTypeEnum('type').notNull(),
  specVersion: integer('spec_version').notNull(),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
