import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'

export const projectStatusEnum = pgEnum('project_status', ['draft', 'ready', 'exported', 'synced'])
export const qualityPresetEnum = pgEnum('quality_preset', ['mvp', 'production', 'enterprise'])
export const baasProviderEnum = pgEnum('baas_provider', ['supabase', 'pocketbase', 'none'])
export const layoutScopeEnum = pgEnum('layout_scope', ['project', 'team', 'public'])

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').default(''),
  qualityPreset: qualityPresetEnum('quality_preset').default('mvp').notNull(),
  baasProvider: baasProviderEnum('baas_provider').default('none').notNull(),
  sharedHead: text('shared_head').notNull().default(''),
  status: projectStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type PageData = {
  id: string
  title: string
  layoutId: string | null
  contentHtml: string
}

export const specs = pgTable('specs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  version: integer('version').notNull().default(1),
  pages: jsonb('pages').$type<PageData[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const layouts = pgTable('layouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  scope: layoutScopeEnum('scope').default('project').notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  parentLayoutId: uuid('parent_layout_id'),
  name: text('name').notNull(),
  html: text('html').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('layouts_project_id_idx').on(t.projectId),
])

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  messages: jsonb('messages').$type<{ role: string; content: string; timestamp: number }[]>().default([]),
  specVersionAt: integer('spec_version_at').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
