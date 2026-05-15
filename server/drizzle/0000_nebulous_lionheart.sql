CREATE TYPE "public"."baas_provider" AS ENUM('supabase', 'pocketbase', 'none');--> statement-breakpoint
CREATE TYPE "public"."export_type" AS ENUM('html_prd', 'project_base', 'spec_json');--> statement-breakpoint
CREATE TYPE "public"."material_type" AS ENUM('animation', 'component', 'pattern');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'ready', 'exported', 'synced');--> statement-breakpoint
CREATE TYPE "public"."quality_preset" AS ENUM('mvp', 'production', 'enterprise');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb,
	"spec_version_at" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"colors" jsonb DEFAULT '{}'::jsonb,
	"typography" jsonb DEFAULT '{}'::jsonb,
	"spacing" jsonb DEFAULT '{}'::jsonb,
	"is_builtin" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "export_type" NOT NULL,
	"spec_version" integer NOT NULL,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "material_type" NOT NULL,
	"name" text NOT NULL,
	"code_snippet" text DEFAULT '',
	"preview_url" text,
	"tags" text[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"quality_preset" "quality_preset" DEFAULT 'mvp' NOT NULL,
	"baas_provider" "baas_provider" DEFAULT 'none' NOT NULL,
	"design_token_id" uuid,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"pages" jsonb DEFAULT '[]'::jsonb,
	"data_models" jsonb DEFAULT '[]'::jsonb,
	"api_contracts" jsonb DEFAULT '[]'::jsonb,
	"quality_rules" jsonb DEFAULT '{}'::jsonb,
	"state_machines" jsonb DEFAULT '[]'::jsonb,
	"snapshot_html" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specs" ADD CONSTRAINT "specs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;