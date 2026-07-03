-- ============================================================================
-- Migration 001: Initial Schema (v1 — single-tenant)
-- ============================================================================

-- This file documents the v1 schema. It is superseded by schema.sql
-- which includes IF NOT EXISTS guards. This file exists for reference
-- and for the migration runner to validate upgrade paths.

-- All tables defined without tenant_id, using simple id PKs.
-- See schema.sql for the current v2 multi-tenant schema.
