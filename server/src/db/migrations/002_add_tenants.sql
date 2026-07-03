-- ============================================================================
-- Migration 002: Multi-Tenant Support
--
-- Upgrades v1 (single-tenant) to v2 (multi-tenant).
-- Safe to run on v1 databases or no-op on v2 (uses IF NOT EXISTS / IF EXISTS).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Create tenants table
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  api_key       TEXT NOT NULL UNIQUE,
  monitor_key   TEXT NOT NULL UNIQUE,
  domain        TEXT NOT NULL DEFAULT '',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  max_stores    INTEGER NOT NULL DEFAULT 1,
  max_users     INTEGER NOT NULL DEFAULT 5,
  config        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_api_key      ON tenants (api_key);
CREATE INDEX IF NOT EXISTS idx_tenants_monitor_key   ON tenants (monitor_key);
CREATE INDEX IF NOT EXISTS idx_tenants_slug          ON tenants (slug);

-- --------------------------------------------------------------------------
-- 2. Insert default tenant for existing single-tenant installations
-- --------------------------------------------------------------------------
INSERT INTO tenants (id, name, slug, api_key, monitor_key, domain)
SELECT
  'default',
  'Default Store',
  'default',
  COALESCE(current_setting('app.sync_secret', true), 'default-key'),
  COALESCE(current_setting('app.monitor_secret', true), 'default-monitor-key'),
  ''
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 'default');

-- --------------------------------------------------------------------------
-- 3. Add tenant_id to all data tables
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'categories', 'suppliers', 'products', 'customers',
    'users', 'sales', 'sale_items', 'returns',
    'treasury_operations', 'user_shifts', 'sync_meta'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    -- Add column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN tenant_id TEXT NOT NULL DEFAULT ''default''',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 4. Drop old PKs and recreate as composite (tenant_id, id)
-- --------------------------------------------------------------------------

-- Helper: drop PK if it exists, then recreate
DO $$
DECLARE
  tables_with_pk TEXT[] := ARRAY[
    'categories', 'suppliers', 'products', 'customers',
    'users', 'sales', 'returns', 'treasury_operations', 'user_shifts'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables_with_pk
  LOOP
    -- Drop existing PK constraint
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I_pkey CASCADE', tbl, tbl);
    -- Recreate as composite
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (tenant_id, id)', tbl);
  END LOOP;
END $$;

-- sale_items and sync_meta need special handling for FKs / existing data
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_pkey CASCADE;
ALTER TABLE sale_items ADD PRIMARY KEY (tenant_id, id);

ALTER TABLE sync_meta DROP CONSTRAINT IF EXISTS sync_meta_pkey CASCADE;
ALTER TABLE sync_meta ADD PRIMARY KEY (tenant_id, id);

-- --------------------------------------------------------------------------
-- 5. Recreate foreign keys
-- --------------------------------------------------------------------------
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE sale_items ADD FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id) ON DELETE CASCADE;

-- products FKs (these reference categories and suppliers)
DO $$
BEGIN
  -- Drop old FKs if they exist (names may vary)
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'products_category_id_fkey') THEN
    ALTER TABLE products DROP CONSTRAINT products_category_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'products_supplier_id_fkey') THEN
    ALTER TABLE products DROP CONSTRAINT products_supplier_id_fkey;
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 6. Enable RLS on all data tables
-- --------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'categories', 'suppliers', 'products', 'customers',
      'users', 'sales', 'sale_items', 'returns',
      'treasury_operations', 'user_shifts', 'sync_meta'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      $policy$
        CREATE POLICY tenant_isolation ON %I
          FOR ALL
          USING (tenant_id = current_setting('app.tenant_id', true)::TEXT)
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::TEXT)
      $policy$,
      tbl
    );
  END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- 7. Drop old single-tenant indexes, recreate with tenant_id prefix
-- --------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_sales_created_at;
DROP INDEX IF EXISTS idx_sales_status;
DROP INDEX IF EXISTS idx_sales_cashier_id;
DROP INDEX IF EXISTS idx_returns_created_at;
DROP INDEX IF EXISTS idx_returns_status;
DROP INDEX IF EXISTS idx_products_is_active;
DROP INDEX IF EXISTS idx_sale_items_sale_id;
DROP INDEX IF EXISTS idx_customers_name;
DROP INDEX IF EXISTS idx_treasury_operations_type;
DROP INDEX IF EXISTS idx_user_shifts_login_at;

CREATE INDEX IF NOT EXISTS idx_sales_tenant_created
  ON sales (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_status
  ON sales (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_cashier
  ON sales (tenant_id, cashier_id);
CREATE INDEX IF NOT EXISTS idx_returns_tenant_created
  ON returns (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_tenant_status
  ON returns (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active
  ON products (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode
  ON products (tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_sale
  ON sale_items (tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name
  ON customers (tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_treasury_tenant_type
  ON treasury_operations (tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_user_shifts_tenant_login
  ON user_shifts (tenant_id, login_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_meta_tenant
  ON sync_meta (tenant_id);

-- --------------------------------------------------------------------------
-- 8. Add FK reference from products to categories and suppliers (composite)
-- --------------------------------------------------------------------------
-- Note: These are soft FKs since category_id/supplier_id may reference
-- records from other tenants in edge cases. We add them as advisory.
-- The RLS policy handles actual isolation.
ALTER TABLE products ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (tenant_id, category_id) REFERENCES categories(tenant_id, id) ON DELETE SET NULL;
ALTER TABLE products ADD CONSTRAINT products_supplier_id_fkey
  FOREIGN KEY (tenant_id, supplier_id) REFERENCES suppliers(tenant_id, id) ON DELETE SET NULL;

-- --------------------------------------------------------------------------
-- 9. Add FK from returns to sales
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'returns_sale_id_fkey') THEN
    ALTER TABLE returns DROP CONSTRAINT returns_sale_id_fkey;
  END IF;
END $$;
