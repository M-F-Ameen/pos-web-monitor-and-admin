-- ============================================================================
-- Migration 004: Expand suppliers with full fields + add supplier_operations
-- ============================================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code   TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS email           TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address         TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes           TEXT NOT NULL DEFAULT '';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS debt            NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS total_purchases INTEGER NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS total_paid      NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

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

ALTER TABLE supplier_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON supplier_operations;
CREATE POLICY tenant_isolation ON supplier_operations
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::TEXT)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::TEXT);

CREATE INDEX IF NOT EXISTS idx_supplier_operations_tenant_supplier
  ON supplier_operations (tenant_id, supplier_id, created_at DESC);
