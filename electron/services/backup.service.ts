import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import { closeDatabase, getDatabasePath, getDb, initDatabase } from "../database";
import type { DataBackupResult, DataRestoreResult, DataScope } from "../shared/types";

const REQUIRED_TABLES = [
  "users",
  "categories",
  "products",
  "customers",
  "sales",
  "sale_items",
  "returns",
  "treasury_ops",
  "settings",
  "schema_version",
] as const;

type ScopedBackupScope = Exclude<DataScope, "system">;

const BACKUP_METADATA_TABLE = "backup_metadata";
const BACKUP_METADATA_FORMAT_KEY = "format";
const BACKUP_METADATA_SCOPE_KEY = "scope";
const BACKUP_METADATA_CREATED_AT_KEY = "createdAt";
const BACKUP_FORMAT_SCOPED_V1 = "scoped-v1";
const OPERATIONS_CUSTOMERS_FINANCIALS_TABLE = "backup_customers_financials";

const SCOPED_BACKUP_TABLES: Record<ScopedBackupScope, readonly string[]> = {
  inventory: ["categories", "products", "suppliers", "supplier_operations"],
  operations: ["sales", "sale_items", "returns", "treasury_ops", "user_shifts"],
};

const SCOPED_CLEAR_ORDER: Record<ScopedBackupScope, readonly string[]> = {
  inventory: ["supplier_operations", "products", "suppliers", "categories"],
  operations: ["sale_items", "returns", "sales", "treasury_ops", "user_shifts"],
};

const SCOPED_RESTORE_ORDER: Record<ScopedBackupScope, readonly string[]> = {
  inventory: ["categories", "products", "suppliers", "supplier_operations"],
  operations: ["sales", "sale_items", "returns", "treasury_ops", "user_shifts"],
};

let operationInProgress = false;

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function formatTimestampForFileName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function normalizeBackupDestinationPath(filePath: string): string {
  const absolutePath = path.resolve(filePath.trim());
  if (path.extname(absolutePath)) {
    return absolutePath;
  }
  return `${absolutePath}.db`;
}

async function safeUnlink(targetPath: string): Promise<void> {
  try {
    await fs.unlink(targetPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}

async function assertReadableFile(filePath: string): Promise<void> {
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error("ملف النسخة الاحتياطية غير موجود.");
    }
    throw error;
  }

  if (!stat.isFile()) {
    throw new Error("المسار المحدد ليس ملفاً صالحاً.");
  }
  if (stat.size <= 0) {
    throw new Error("ملف النسخة الاحتياطية فارغ.");
  }
}

function tableExists(database: Database.Database, tableName: string): boolean {
  const row = database
    .prepare(
      `
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `,
    )
    .get(tableName);
  return Boolean(row);
}

function listTableColumns(database: Database.Database, tableName: string): string[] {
  if (!tableExists(database, tableName)) {
    return [];
  }
  const rows = database
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function assertQuickCheck(database: Database.Database): void {
  const quickCheck = database.pragma("quick_check(1)", {
    simple: true,
  });
  if (typeof quickCheck !== "string" || quickCheck.toLowerCase() !== "ok") {
    throw new Error("ملف النسخة الاحتياطية تالف أو غير مكتمل.");
  }
}

function getMetadataValue(
  database: Database.Database,
  key: string,
): string | null {
  if (!tableExists(database, BACKUP_METADATA_TABLE)) {
    return null;
  }
  const row = database
    .prepare(
      `SELECT value FROM ${quoteIdentifier(BACKUP_METADATA_TABLE)} WHERE key = ?`,
    )
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function readScopedBackupScope(database: Database.Database): ScopedBackupScope | null {
  if (!tableExists(database, BACKUP_METADATA_TABLE)) {
    return null;
  }

  const format = getMetadataValue(database, BACKUP_METADATA_FORMAT_KEY);
  if (format !== BACKUP_FORMAT_SCOPED_V1) {
    throw new Error("صيغة ملف النسخة الاحتياطية الجزئية غير مدعومة.");
  }

  const scope = getMetadataValue(database, BACKUP_METADATA_SCOPE_KEY);
  if (scope === "inventory" || scope === "operations") {
    return scope;
  }
  throw new Error("ملف النسخة الاحتياطية يحتوي على نطاق بيانات غير معروف.");
}

function validateBackupFileSchema(filePath: string): void {
  let backupDb: Database.Database | null = null;

  try {
    backupDb = new Database(filePath, {
      readonly: true,
      fileMustExist: true,
    });

    assertQuickCheck(backupDb);

    const tableRows = backupDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const tableNames = new Set(tableRows.map((row) => row.name));
    const missingTables = REQUIRED_TABLES.filter((table) => !tableNames.has(table));

    if (missingTables.length > 0) {
      throw new Error(
        `ملف النسخة الاحتياطية لا يحتوي على بنية قاعدة البيانات المطلوبة: ${missingTables.join(", ")}`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`تعذّر التحقق من ملف النسخة الاحتياطية: ${error.message}`);
    }
    throw error;
  } finally {
    backupDb?.close();
  }
}

function validateScopedBackupFileSchema(
  filePath: string,
  expectedScope: ScopedBackupScope,
): void {
  let backupDb: Database.Database | null = null;

  try {
    backupDb = new Database(filePath, {
      readonly: true,
      fileMustExist: true,
    });

    assertQuickCheck(backupDb);
    const actualScope = readScopedBackupScope(backupDb);
    if (actualScope !== expectedScope) {
      throw new Error(
        `نوع النسخة غير مطابق. المطلوب: ${expectedScope}، الموجود: ${actualScope ?? "غير معروف"}.`,
      );
    }

    const requiredTables = [
      ...SCOPED_BACKUP_TABLES[expectedScope],
      ...(expectedScope === "operations"
        ? [OPERATIONS_CUSTOMERS_FINANCIALS_TABLE]
        : []),
    ];

    const tableRows = backupDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const tableNames = new Set(tableRows.map((row) => row.name));
    const missingTables = requiredTables.filter((table) => !tableNames.has(table));
    if (missingTables.length > 0) {
      throw new Error(
        `ملف النسخة لا يحتوي على الجداول المطلوبة لنطاق ${expectedScope}: ${missingTables.join(", ")}`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`تعذّر التحقق من النسخة الجزئية: ${error.message}`);
    }
    throw error;
  } finally {
    backupDb?.close();
  }
}

async function calculateFileChecksumSha256(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

async function replaceDatabaseFile(
  sourceFilePath: string,
  databasePath: string,
): Promise<void> {
  const tempRestorePath = `${databasePath}.restore.tmp`;
  await safeUnlink(tempRestorePath);

  try {
    await fs.copyFile(sourceFilePath, tempRestorePath);
    await safeUnlink(databasePath);
    await safeUnlink(`${databasePath}-wal`);
    await safeUnlink(`${databasePath}-shm`);
    await fs.rename(tempRestorePath, databasePath);
  } finally {
    await safeUnlink(tempRestorePath);
  }
}

async function withOperationLock<T>(operation: () => Promise<T>): Promise<T> {
  if (operationInProgress) {
    throw new Error("توجد عملية نسخ احتياطي أو استعادة قيد التنفيذ حالياً.");
  }

  operationInProgress = true;
  try {
    return await operation();
  } finally {
    operationInProgress = false;
  }
}

function copyTableSchema(
  sourceDb: Database.Database,
  targetDb: Database.Database,
  tableName: string,
): void {
  const row = sourceDb
    .prepare(
      `
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `,
    )
    .get(tableName) as { sql: string | null } | undefined;

  if (!row?.sql) {
    throw new Error(`تعذّر نسخ بنية جدول ${tableName}.`);
  }

  targetDb.exec(row.sql);
}

function copyTableRows(
  sourceDb: Database.Database,
  targetDb: Database.Database,
  tableName: string,
): number {
  const columns = listTableColumns(sourceDb, tableName);
  if (columns.length === 0) {
    return 0;
  }

  const quotedColumns = columns.map((column) => quoteIdentifier(column));
  const selectStmt = sourceDb.prepare(
    `SELECT ${quotedColumns.join(", ")} FROM ${quoteIdentifier(tableName)}`,
  );
  const insertStmt = targetDb.prepare(
    `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns.join(", ")}) VALUES (${columns
      .map(() => "?")
      .join(", ")})`,
  );

  let copiedRows = 0;
  for (const row of selectStmt.iterate() as Iterable<Record<string, unknown>>) {
    const values = columns.map((column) => row[column]);
    insertStmt.run(...values);
    copiedRows += 1;
  }
  return copiedRows;
}

function restoreTableRows(
  sourceDb: Database.Database,
  targetDb: Database.Database,
  tableName: string,
): number {
  const sourceColumns = listTableColumns(sourceDb, tableName);
  const destinationColumnsSet = new Set(listTableColumns(targetDb, tableName));
  const compatibleColumns = sourceColumns.filter((column) =>
    destinationColumnsSet.has(column),
  );

  if (compatibleColumns.length === 0) {
    return 0;
  }

  const quotedColumns = compatibleColumns.map((column) => quoteIdentifier(column));
  const selectStmt = sourceDb.prepare(
    `SELECT ${quotedColumns.join(", ")} FROM ${quoteIdentifier(tableName)}`,
  );
  const insertStmt = targetDb.prepare(
    `INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns.join(", ")}) VALUES (${compatibleColumns
      .map(() => "?")
      .join(", ")})`,
  );

  let restoredRows = 0;
  for (const row of selectStmt.iterate() as Iterable<Record<string, unknown>>) {
    const values = compatibleColumns.map((column) => row[column]);
    insertStmt.run(...values);
    restoredRows += 1;
  }

  return restoredRows;
}

function writeScopedBackupMetadata(
  snapshotDb: Database.Database,
  scope: ScopedBackupScope,
): void {
  snapshotDb.exec(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(BACKUP_METADATA_TABLE)} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const upsertMetadata = snapshotDb.prepare(
    `INSERT OR REPLACE INTO ${quoteIdentifier(BACKUP_METADATA_TABLE)} (key, value) VALUES (?, ?)`,
  );

  upsertMetadata.run(BACKUP_METADATA_FORMAT_KEY, BACKUP_FORMAT_SCOPED_V1);
  upsertMetadata.run(BACKUP_METADATA_SCOPE_KEY, scope);
  upsertMetadata.run(BACKUP_METADATA_CREATED_AT_KEY, new Date().toISOString());
}

function writeOperationsCustomersFinancialsSnapshot(
  sourceDb: Database.Database,
  snapshotDb: Database.Database,
): void {
  snapshotDb.exec(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(OPERATIONS_CUSTOMERS_FINANCIALS_TABLE)} (
      customer_id TEXT PRIMARY KEY,
      debt REAL NOT NULL DEFAULT 0,
      total_purchases INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0
    )
  `);

  if (!tableExists(sourceDb, "customers")) {
    return;
  }

  const selectStmt = sourceDb.prepare(`
    SELECT
      id AS customer_id,
      debt,
      total_purchases,
      total_spent
    FROM customers
  `);
  const insertStmt = snapshotDb.prepare(
    `
    INSERT INTO ${quoteIdentifier(OPERATIONS_CUSTOMERS_FINANCIALS_TABLE)}
      (customer_id, debt, total_purchases, total_spent)
    VALUES (?, ?, ?, ?)
  `,
  );

  for (const row of selectStmt.iterate() as Iterable<{
    customer_id: string;
    debt: number;
    total_purchases: number;
    total_spent: number;
  }>) {
    insertStmt.run(
      row.customer_id,
      row.debt ?? 0,
      row.total_purchases ?? 0,
      row.total_spent ?? 0,
    );
  }
}

function restoreOperationsCustomersFinancials(
  sourceDb: Database.Database,
  targetDb: Database.Database,
): number {
  if (
    !tableExists(sourceDb, OPERATIONS_CUSTOMERS_FINANCIALS_TABLE) ||
    !tableExists(targetDb, "customers")
  ) {
    return 0;
  }

  targetDb
    .prepare(
      `
      UPDATE customers
      SET debt = 0,
          total_purchases = 0,
          total_spent = 0,
          updated_at = datetime('now','localtime')
    `,
    )
    .run();

  const selectStmt = sourceDb.prepare(
    `
    SELECT customer_id, debt, total_purchases, total_spent
    FROM ${quoteIdentifier(OPERATIONS_CUSTOMERS_FINANCIALS_TABLE)}
  `,
  );
  const updateStmt = targetDb.prepare(`
    UPDATE customers
    SET debt = ?,
        total_purchases = ?,
        total_spent = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `);

  let updatedRows = 0;
  for (const row of selectStmt.iterate() as Iterable<{
    customer_id: string;
    debt: number;
    total_purchases: number;
    total_spent: number;
  }>) {
    updatedRows += updateStmt.run(
      row.debt ?? 0,
      row.total_purchases ?? 0,
      row.total_spent ?? 0,
      row.customer_id,
    ).changes;
  }

  return updatedRows;
}

async function createScopedDatabaseBackup(
  destinationPath: string,
  scope: ScopedBackupScope,
): Promise<DataBackupResult> {
  return withOperationLock(async () => {
    const finalPath = normalizeBackupDestinationPath(destinationPath);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    const tempPath = `${finalPath}.tmp`;
    await safeUnlink(tempPath);

    let moved = false;
    let snapshotDb: Database.Database | null = null;

    try {
      snapshotDb = new Database(tempPath);
      snapshotDb.pragma("journal_mode = DELETE");
      snapshotDb.pragma("synchronous = FULL");
      snapshotDb.pragma("foreign_keys = OFF");

      const sourceDb = getDb();
      writeScopedBackupMetadata(snapshotDb, scope);

      for (const tableName of SCOPED_BACKUP_TABLES[scope]) {
        if (!tableExists(sourceDb, tableName)) {
          continue;
        }
        copyTableSchema(sourceDb, snapshotDb, tableName);
        copyTableRows(sourceDb, snapshotDb, tableName);
      }

      if (scope === "operations") {
        writeOperationsCustomersFinancialsSnapshot(sourceDb, snapshotDb);
      }

      snapshotDb.close();
      snapshotDb = null;

      await safeUnlink(finalPath);
      await fs.rename(tempPath, finalPath);
      moved = true;
    } finally {
      snapshotDb?.close();
      if (!moved) {
        await safeUnlink(tempPath);
      }
    }

    const stat = await fs.stat(finalPath);
    const checksumSha256 = await calculateFileChecksumSha256(finalPath);

    return {
      canceled: false,
      scope,
      backupPath: finalPath,
      fileSizeBytes: stat.size,
      checksumSha256,
      createdAt: new Date().toISOString(),
    };
  });
}

function buildRollbackBackupPath(): string {
  const fileName = `tobacco_pos_pre_restore_${formatTimestampForFileName(new Date())}.db`;
  return path.join(getSuggestedBackupDirectory(), fileName);
}

async function createRollbackSnapshot(): Promise<{
  rollbackPath: string;
  rollbackTempPath: string;
}> {
  await fs.mkdir(getSuggestedBackupDirectory(), { recursive: true });
  const rollbackPath = buildRollbackBackupPath();
  const rollbackTempPath = `${rollbackPath}.tmp`;
  await safeUnlink(rollbackTempPath);
  await safeUnlink(rollbackPath);

  await getDb().backup(rollbackTempPath);
  await fs.rename(rollbackTempPath, rollbackPath);

  return { rollbackPath, rollbackTempPath };
}

async function restoreScopedDatabaseBackup(
  sourcePath: string,
  scope: ScopedBackupScope,
): Promise<DataRestoreResult> {
  return withOperationLock(async () => {
    const normalizedSourcePath = path.resolve(sourcePath.trim());
    await assertReadableFile(normalizedSourcePath);
    validateScopedBackupFileSchema(normalizedSourcePath, scope);

    const { rollbackPath, rollbackTempPath } = await createRollbackSnapshot();
    let backupDb: Database.Database | null = null;

    try {
      backupDb = new Database(normalizedSourcePath, {
        readonly: true,
        fileMustExist: true,
      });
      assertQuickCheck(backupDb);

      const mainDb = getDb();
      const applyRestore = mainDb.transaction(() => {
        for (const tableName of SCOPED_CLEAR_ORDER[scope]) {
          if (tableExists(mainDb, tableName)) {
            mainDb.prepare(`DELETE FROM ${quoteIdentifier(tableName)}`).run();
          }
        }

        for (const tableName of SCOPED_RESTORE_ORDER[scope]) {
          if (tableExists(backupDb!, tableName) && tableExists(mainDb, tableName)) {
            restoreTableRows(backupDb!, mainDb, tableName);
          }
        }

        if (scope === "operations") {
          restoreOperationsCustomersFinancials(backupDb!, mainDb);
        }
      });

      applyRestore();

      return {
        canceled: false,
        scope,
        sourcePath: normalizedSourcePath,
        rollbackBackupPath: rollbackPath,
        restoredAt: new Date().toISOString(),
        requiresReload: true,
      };
    } finally {
      backupDb?.close();
      await safeUnlink(rollbackTempPath);
    }
  });
}

export function getSuggestedBackupDirectory(): string {
  if (!app.isPackaged) {
    return path.join(app.getAppPath(), "backups");
  }

  return path.join(app.getPath("documents"), "TobaccoPOS Backups");
}

export function getSuggestedBackupPath(scope: DataScope = "system"): string {
  const scopePrefix = scope === "system" ? "system" : scope;
  const fileName = `tobacco_pos_${scopePrefix}_backup_${formatTimestampForFileName(new Date())}.db`;
  return path.join(getSuggestedBackupDirectory(), fileName);
}

export async function createDatabaseBackup(
  destinationPath: string,
): Promise<DataBackupResult> {
  return withOperationLock(async () => {
    const finalPath = normalizeBackupDestinationPath(destinationPath);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    const tempPath = `${finalPath}.tmp`;
    await safeUnlink(tempPath);

    let moved = false;

    try {
      await getDb().backup(tempPath);
      await safeUnlink(finalPath);
      await fs.rename(tempPath, finalPath);
      moved = true;
    } finally {
      if (!moved) {
        await safeUnlink(tempPath);
      }
    }

    const stat = await fs.stat(finalPath);
    const checksumSha256 = await calculateFileChecksumSha256(finalPath);

    return {
      canceled: false,
      backupPath: finalPath,
      fileSizeBytes: stat.size,
      checksumSha256,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function createBackup(
  destinationPath: string,
  scope: DataScope = "system",
): Promise<DataBackupResult> {
  if (scope === "system") {
    const result = await createDatabaseBackup(destinationPath);
    return {
      ...result,
      scope: "system",
    };
  }

  return createScopedDatabaseBackup(destinationPath, scope);
}

export async function restoreDatabaseBackup(
  sourcePath: string,
): Promise<DataRestoreResult> {
  return withOperationLock(async () => {
    const normalizedSourcePath = path.resolve(sourcePath.trim());
    const databasePath = getDatabasePath();

    if (normalizedSourcePath === path.resolve(databasePath)) {
      throw new Error("لا يمكن الاستعادة من ملف قاعدة البيانات النشط حالياً.");
    }

    await assertReadableFile(normalizedSourcePath);
    validateBackupFileSchema(normalizedSourcePath);

    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    const { rollbackPath, rollbackTempPath } = await createRollbackSnapshot();

    closeDatabase();

    try {
      await replaceDatabaseFile(normalizedSourcePath, databasePath);
      initDatabase();

      return {
        canceled: false,
        sourcePath: normalizedSourcePath,
        rollbackBackupPath: rollbackPath,
        restoredAt: new Date().toISOString(),
        requiresReload: true,
      };
    } catch (restoreError) {
      const restoreMessage =
        restoreError instanceof Error
          ? restoreError.message
          : "Unknown restore error";

      try {
        await replaceDatabaseFile(rollbackPath, databasePath);
        initDatabase();
      } catch (rollbackError) {
        const rollbackMessage =
          rollbackError instanceof Error
            ? rollbackError.message
            : "Unknown rollback error";
        throw new Error(
          `فشل الاستعادة (${restoreMessage}) وتعذرت إعادة قاعدة البيانات السابقة (${rollbackMessage}).`,
        );
      }

      throw new Error(
        `فشل استعادة النسخة الاحتياطية، وتمت إعادة قاعدة البيانات السابقة تلقائياً. (${restoreMessage})`,
      );
    } finally {
      await safeUnlink(rollbackTempPath);
    }
  });
}

export async function restoreBackup(
  sourcePath: string,
  scope: DataScope = "system",
): Promise<DataRestoreResult> {
  if (scope === "system") {
    const result = await restoreDatabaseBackup(sourcePath);
    return {
      ...result,
      scope: "system",
      requiresReload: true,
    };
  }

  return restoreScopedDatabaseBackup(sourcePath, scope);
}
