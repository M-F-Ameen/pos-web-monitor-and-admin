-- ============================================================================
-- Migration 003: User Authentication for Monitor Web App
--
-- Adds tables for admin users (SaaS owner) and tenant users
-- (monitor dashboard login with email + password).
-- ============================================================================

-- Admin users (SaaS platform owner)
CREATE TABLE IF NOT EXISTS admin_users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'superadmin',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant dashboard users (each belongs to a tenant)
CREATE TABLE IF NOT EXISTS tenant_users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'owner',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email  ON admin_users (email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users (tenant_id, email);

-- Insert default admin if none exists (password: admin123)
INSERT INTO admin_users (id, email, password_hash, name, role)
SELECT
  'admin_default',
  'admin@poscloud.com',
  '$2a$10$pTNa7WDBumesI3jer9Jr/uzTpJTpnlHCNJCtpDVEsEnmuFmpJADdG',
  'Super Admin',
  'superadmin'
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'admin@poscloud.com');
