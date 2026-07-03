/**
 * PostgreSQL Connection Pool
 *
 * Provides shared pool access + tenant context helpers for RLS.
 * Configured via DATABASE_URL (auto-set by Railway).
 */

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

// ---------------------------------------------------------------------------
// Tenant Context Helpers
// ---------------------------------------------------------------------------

/**
 * Set the tenant context for the current session.
 * This is used by RLS policies to automatically filter queries.
 * Must be called once per request before any data queries.
 */
export async function setTenantContext(tenantId: string): Promise<void> {
  await pool.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
}

/**
 * Get the current tenant_id from session context.
 * Useful for logging and debugging.
 */
export async function getTenantContext(): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT current_setting('app.tenant_id', true) AS tenant_id"
  );
  return rows[0]?.tenant_id ?? null;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Run a read query returning rows
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query<T>(text, params);
  return rows;
}

/**
 * Run a write query returning the first row
 */
export async function queryOne<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const { rows } = await pool.query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run a raw query (for DDL, counts, etc.)
 */
export async function raw(text: string, params?: unknown[]): Promise<pg.QueryResult> {
  return pool.query(text, params);
}

/**
 * Acquire a dedicated client with tenant context set for RLS.
 * All queries via this client share the same connection + tenant config.
 * MUST call client.release() in a finally block.
 */
export async function acquireTenantClient(tenantId: string): Promise<pg.PoolClient> {
  const client = await pool.connect();
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  return client;
}
