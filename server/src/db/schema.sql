-- ============================================================================
-- Freedom POS Cloud — PostgreSQL Schema (Multi-Tenant v2)
--
-- Composite PKs: (tenant_id, id) — every tenant gets full UUID isolation.
-- Row-Level Security (RLS) enabled on all data tables as defense-in-depth.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TENANTS — the root of all multi-tenant isolation
-- ============================================================================
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

-- ============================================================================
-- CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- SUPPLIERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id              TEXT NOT NULL,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  supplier_code   TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  debt            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  total_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- SUPPLIER OPERATIONS LEDGER
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplier_operations (
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id              TEXT NOT NULL,
  supplier_id     TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('purchase','settlement')),
  purchase_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  debt_before     NUMERIC(12,2) NOT NULL DEFAULT 0,
  debt_after      NUMERIC(12,2) NOT NULL DEFAULT 0,
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- PRODUCTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id            TEXT NOT NULL,
  name          TEXT NOT NULL,
  barcode       TEXT NOT NULL DEFAULT '',
  category_id   TEXT,
  supplier_id   TEXT,
  cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock         INTEGER NOT NULL DEFAULT 0,
  min_stock     INTEGER NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'piece',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  product_code  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id              TEXT NOT NULL,
  customer_id     TEXT NOT NULL DEFAULT '',
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  debt            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  total_spent     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- USERS (cashiers / managers synced from POS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  username    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'cashier',
  name        TEXT NOT NULL DEFAULT '',

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- SALES
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales (
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id              TEXT NOT NULL,
  receipt_number  TEXT NOT NULL DEFAULT '',
  customer_id     TEXT,
  customer_name   TEXT NOT NULL DEFAULT '',
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  increase_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type   TEXT NOT NULL DEFAULT '',
  discount_value  NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method  TEXT NOT NULL DEFAULT 'cash',
  amount_received NUMERIC(12,2) NOT NULL DEFAULT 0,
  change_given    NUMERIC(12,2) NOT NULL DEFAULT 0,
  reference       TEXT NOT NULL DEFAULT '',
  cashier_id      TEXT NOT NULL DEFAULT '',
  cashier_name    TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- SALE ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS sale_items (
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id            TEXT NOT NULL,
  sale_id       TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  product_name  TEXT NOT NULL,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity      INTEGER NOT NULL DEFAULT 1,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,

  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, sale_id) REFERENCES sales(tenant_id, id) ON DELETE CASCADE
);

-- ============================================================================
-- RETURNS
-- ============================================================================
CREATE TABLE IF NOT EXISTS returns (
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id              TEXT NOT NULL,
  return_number   TEXT NOT NULL DEFAULT '',
  sale_id         TEXT,
  product_id      TEXT NOT NULL,
  product_name    TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  refund_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',
  processed_by_id TEXT NOT NULL DEFAULT '',
  processed_by    TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- TREASURY OPERATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_operations (
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  user_id     TEXT NOT NULL DEFAULT '',
  user_name   TEXT NOT NULL DEFAULT '',
  date        TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT 'system',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- USER SHIFTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_shifts (
  tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id                TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  user_name         TEXT NOT NULL,
  user_role         TEXT NOT NULL DEFAULT 'cashier',
  login_at          TIMESTAMPTZ NOT NULL,
  logout_at         TIMESTAMPTZ,
  start_cash        NUMERIC(12,2) NOT NULL DEFAULT 0,
  end_cash          NUMERIC(12,2),
  total_sales       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_returns     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_withdrawals NUMERIC(12,2) NOT NULL DEFAULT 0,
  operations_count  INTEGER NOT NULL DEFAULT 0,

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- SYNC META — per-tenant sync tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_meta (
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id            TEXT NOT NULL DEFAULT 'default',
  last_sync_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  pos_version   TEXT NOT NULL DEFAULT '',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (tenant_id, id)
);

-- ============================================================================
-- ROW-LEVEL SECURITY — defense-in-depth tenant isolation
-- ============================================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'categories', 'suppliers', 'products', 'customers',
      'users', 'sales', 'sale_items', 'returns',
      'treasury_operations', 'user_shifts', 'sync_meta', 'supplier_operations'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON %I',
      tbl
    );
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

-- ============================================================================
-- INDEXES
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_name
  ON suppliers (tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_supplier_operations_tenant_supplier
  ON supplier_operations (tenant_id, supplier_id, created_at DESC);
