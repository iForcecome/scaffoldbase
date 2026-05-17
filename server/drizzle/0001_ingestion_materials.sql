ALTER TABLE "specs" ADD COLUMN "raw_materials" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "specs" ADD COLUMN "normalized_materials" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "specs" ADD COLUMN "ingestion_jobs" jsonb DEFAULT '[]'::jsonb;
