/**
 * Database Migration Runner
 *
 * 1. Applies schema.sql (idempotent — uses IF NOT EXISTS).
 * 2. Runs any pending migration files from db/migrations/ in order.
 * 3. Tracks applied migrations in the _migrations table.
 *
 * Can be used both as a standalone script (`tsx src/db/migrate.ts`)
 * and imported as a library (`import { runMigrations } from "./migrate.js"`).
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_TABLE = "_migrations";

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum    TEXT NOT NULL DEFAULT ''
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>(
    `SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY id`
  );
  return new Set(rows.map((r) => r.filename));
}

async function applyMigration(filename: string, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Run the migration
    await client.query(sql);

    // Record it
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (filename, checksum) VALUES ($1, $2)`,
      [filename, ""]
    );

    await client.query("COMMIT");
    console.log(`[migrate]   ✅ ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[migrate]   ❌ ${filename}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  console.log("[migrate] Running database migrations...");

  // Step 1: Apply base schema
  const schemaPath = join(__dirname, "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf-8");
  try {
    await pool.query(schemaSql);
    console.log("[migrate] ✅ Base schema applied");
  } catch (err) {
    console.error("[migrate] ❌ Base schema failed:", err);
    throw err;
  }

  // Step 2: Run pending migration files
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const migrationsDir = join(__dirname, "migrations");
  let migrationFiles: string[] = [];
  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    console.log("[migrate] No migrations directory found — skipping");
  }

  let pendingCount = 0;
  for (const file of migrationFiles) {
    if (applied.has(file)) continue;

    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, "utf-8");

    console.log(`[migrate] Applying ${file}...`);
    await applyMigration(file, sql);
    pendingCount++;
  }

  if (pendingCount === 0) {
    console.log("[migrate] ✅ No pending migrations");
  } else {
    console.log(`[migrate] ✅ Applied ${pendingCount} migration(s)`);
  }
}

// Allow running as a standalone script: `node dist/db/migrate.js`
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  runMigrations()
    .catch((err) => {
      console.error("[migrate] Fatal:", err);
      process.exit(1);
    })
    .finally(() => pool.end());
}
