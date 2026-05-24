-- v2 consolidation: drop v1 schema baggage, add sharedHead + layouts.
--
-- 注意：这份 migration **不在 drizzle-kit 的管辖范围**（不在 _journal.json 中），
-- 因为它用了 DO $$ ... EXCEPTION 语法，drizzle-kit migrate 拆 statement 时会出错。
-- 应用方式：直接 psql 执行，或写脚本用 postgres-js client.unsafe() 执行。
--
-- 安全保证：所有变更都是幂等的（IF EXISTS / IF NOT EXISTS / DO $$ EXCEPTION WHEN duplicate_object），
-- 重复跑没有副作用。

-- 1. projects: add shared_head, drop design_token_id
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "shared_head" text NOT NULL DEFAULT '';
ALTER TABLE "projects" DROP COLUMN IF EXISTS "design_token_id";

-- 2. specs: drop v1 fields no longer used (pages jsonb kept, shape changed in TS only)
ALTER TABLE "specs" DROP COLUMN IF EXISTS "raw_materials";
ALTER TABLE "specs" DROP COLUMN IF EXISTS "normalized_materials";
ALTER TABLE "specs" DROP COLUMN IF EXISTS "ingestion_jobs";
ALTER TABLE "specs" DROP COLUMN IF EXISTS "data_models";
ALTER TABLE "specs" DROP COLUMN IF EXISTS "api_contracts";
ALTER TABLE "specs" DROP COLUMN IF EXISTS "quality_rules";
ALTER TABLE "specs" DROP COLUMN IF EXISTS "state_machines";
ALTER TABLE "specs" DROP COLUMN IF EXISTS "snapshot_html";

-- 3. layouts: new table with scope + parentLayoutId reserved for v3
DO $$ BEGIN
  CREATE TYPE "public"."layout_scope" AS ENUM('project', 'team', 'public');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "layouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" "layout_scope" DEFAULT 'project' NOT NULL,
  "project_id" uuid,
  "parent_layout_id" uuid,
  "name" text NOT NULL,
  "html" text NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "layouts" ADD CONSTRAINT "layouts_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "layouts" ADD CONSTRAINT "layouts_parent_layout_id_layouts_id_fk"
    FOREIGN KEY ("parent_layout_id") REFERENCES "public"."layouts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "layouts_project_id_idx" ON "layouts" ("project_id");

-- 4. drop v1 tables (already-empty DB; safe)
DROP TABLE IF EXISTS "exports";
DROP TABLE IF EXISTS "material_assets";
DROP TABLE IF EXISTS "design_tokens";
DROP TYPE IF EXISTS "export_type";
DROP TYPE IF EXISTS "material_type";
