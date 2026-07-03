-- Migration 005: Add columns for cloud sync compatibility
--
-- The schema.sql has these columns in the CREATE TABLE statements,
-- but existing databases created before the schema was updated need
-- ALTER TABLE to add them.

-- Add increase_amount to sales (used by sync upsert)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS increase_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Add processed_by_id to returns (used by sync upsert)
ALTER TABLE returns ADD COLUMN IF NOT EXISTS processed_by_id TEXT NOT NULL DEFAULT '';

-- Add updated_at to sales and returns for incremental sync tracking
ALTER TABLE sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE returns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
