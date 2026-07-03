"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSuggestedBackupDirectory = getSuggestedBackupDirectory;
exports.getSuggestedBackupPath = getSuggestedBackupPath;
exports.createDatabaseBackup = createDatabaseBackup;
exports.createBackup = createBackup;
exports.restoreDatabaseBackup = restoreDatabaseBackup;
exports.restoreBackup = restoreBackup;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const database_1 = require("../database");
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
];
const BACKUP_METADATA_TABLE = "backup_metadata";
const BACKUP_METADATA_FORMAT_KEY = "format";
const BACKUP_METADATA_SCOPE_KEY = "scope";
const BACKUP_METADATA_CREATED_AT_KEY = "createdAt";
const BACKUP_FORMAT_SCOPED_V1 = "scoped-v1";
const OPERATIONS_CUSTOMERS_FINANCIALS_TABLE = "backup_customers_financials";
const SCOPED_BACKUP_TABLES = {
    inventory: ["categories", "products", "suppliers", "supplier_operations"],
    operations: ["sales", "sale_items", "returns", "treasury_ops", "user_shifts"],
};
const SCOPED_CLEAR_ORDER = {
    inventory: ["supplier_operations", "products", "suppliers", "categories"],
    operations: ["sale_items", "returns", "sales", "treasury_ops", "user_shifts"],
};
const SCOPED_RESTORE_ORDER = {
    inventory: ["categories", "products", "suppliers", "supplier_operations"],
    operations: ["sales", "sale_items", "returns", "treasury_ops", "user_shifts"],
};
let operationInProgress = false;
function quoteIdentifier(name) {
    return `"${name.replace(/"/g, '""')}"`;
}
function formatTimestampForFileName(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
function normalizeBackupDestinationPath(filePath) {
    const absolutePath = node_path_1.default.resolve(filePath.trim());
    if (node_path_1.default.extname(absolutePath)) {
        return absolutePath;
    }
    return `${absolutePath}.db`;
}
async function safeUnlink(targetPath) {
    try {
        await promises_1.default.unlink(targetPath);
    }
    catch (error) {
        const code = error.code;
        if (code !== "ENOENT") {
            throw error;
        }
    }
}
async function assertReadableFile(filePath) {
    let stat;
    try {
        stat = await promises_1.default.stat(filePath);
    }
    catch (error) {
        const code = error.code;
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
function tableExists(database, tableName) {
    const row = database
        .prepare(`
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `)
        .get(tableName);
    return Boolean(row);
}
function listTableColumns(database, tableName) {
    if (!tableExists(database, tableName)) {
        return [];
    }
    const rows = database
        .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
        .all();
    return rows.map((row) => row.name);
}
function assertQuickCheck(database) {
    const quickCheck = database.pragma("quick_check(1)", {
        simple: true,
    });
    if (typeof quickCheck !== "string" || quickCheck.toLowerCase() !== "ok") {
        throw new Error("ملف النسخة الاحتياطية تالف أو غير مكتمل.");
    }
}
function getMetadataValue(database, key) {
    if (!tableExists(database, BACKUP_METADATA_TABLE)) {
        return null;
    }
    const row = database
        .prepare(`SELECT value FROM ${quoteIdentifier(BACKUP_METADATA_TABLE)} WHERE key = ?`)
        .get(key);
    return row?.value ?? null;
}
function readScopedBackupScope(database) {
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
function validateBackupFileSchema(filePath) {
    let backupDb = null;
    try {
        backupDb = new better_sqlite3_1.default(filePath, {
            readonly: true,
            fileMustExist: true,
        });
        assertQuickCheck(backupDb);
        const tableRows = backupDb
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all();
        const tableNames = new Set(tableRows.map((row) => row.name));
        const missingTables = REQUIRED_TABLES.filter((table) => !tableNames.has(table));
        if (missingTables.length > 0) {
            throw new Error(`ملف النسخة الاحتياطية لا يحتوي على بنية قاعدة البيانات المطلوبة: ${missingTables.join(", ")}`);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`تعذّر التحقق من ملف النسخة الاحتياطية: ${error.message}`);
        }
        throw error;
    }
    finally {
        backupDb?.close();
    }
}
function validateScopedBackupFileSchema(filePath, expectedScope) {
    let backupDb = null;
    try {
        backupDb = new better_sqlite3_1.default(filePath, {
            readonly: true,
            fileMustExist: true,
        });
        assertQuickCheck(backupDb);
        const actualScope = readScopedBackupScope(backupDb);
        if (actualScope !== expectedScope) {
            throw new Error(`نوع النسخة غير مطابق. المطلوب: ${expectedScope}، الموجود: ${actualScope ?? "غير معروف"}.`);
        }
        const requiredTables = [
            ...SCOPED_BACKUP_TABLES[expectedScope],
            ...(expectedScope === "operations"
                ? [OPERATIONS_CUSTOMERS_FINANCIALS_TABLE]
                : []),
        ];
        const tableRows = backupDb
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all();
        const tableNames = new Set(tableRows.map((row) => row.name));
        const missingTables = requiredTables.filter((table) => !tableNames.has(table));
        if (missingTables.length > 0) {
            throw new Error(`ملف النسخة لا يحتوي على الجداول المطلوبة لنطاق ${expectedScope}: ${missingTables.join(", ")}`);
        }
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`تعذّر التحقق من النسخة الجزئية: ${error.message}`);
        }
        throw error;
    }
    finally {
        backupDb?.close();
    }
}
async function calculateFileChecksumSha256(filePath) {
    const fileBuffer = await promises_1.default.readFile(filePath);
    return node_crypto_1.default.createHash("sha256").update(fileBuffer).digest("hex");
}
async function replaceDatabaseFile(sourceFilePath, databasePath) {
    const tempRestorePath = `${databasePath}.restore.tmp`;
    await safeUnlink(tempRestorePath);
    try {
        await promises_1.default.copyFile(sourceFilePath, tempRestorePath);
        await safeUnlink(databasePath);
        await safeUnlink(`${databasePath}-wal`);
        await safeUnlink(`${databasePath}-shm`);
        await promises_1.default.rename(tempRestorePath, databasePath);
    }
    finally {
        await safeUnlink(tempRestorePath);
    }
}
async function withOperationLock(operation) {
    if (operationInProgress) {
        throw new Error("توجد عملية نسخ احتياطي أو استعادة قيد التنفيذ حالياً.");
    }
    operationInProgress = true;
    try {
        return await operation();
    }
    finally {
        operationInProgress = false;
    }
}
function copyTableSchema(sourceDb, targetDb, tableName) {
    const row = sourceDb
        .prepare(`
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `)
        .get(tableName);
    if (!row?.sql) {
        throw new Error(`تعذّر نسخ بنية جدول ${tableName}.`);
    }
    targetDb.exec(row.sql);
}
function copyTableRows(sourceDb, targetDb, tableName) {
    const columns = listTableColumns(sourceDb, tableName);
    if (columns.length === 0) {
        return 0;
    }
    const quotedColumns = columns.map((column) => quoteIdentifier(column));
    const selectStmt = sourceDb.prepare(`SELECT ${quotedColumns.join(", ")} FROM ${quoteIdentifier(tableName)}`);
    const insertStmt = targetDb.prepare(`INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns.join(", ")}) VALUES (${columns
        .map(() => "?")
        .join(", ")})`);
    let copiedRows = 0;
    for (const row of selectStmt.iterate()) {
        const values = columns.map((column) => row[column]);
        insertStmt.run(...values);
        copiedRows += 1;
    }
    return copiedRows;
}
function restoreTableRows(sourceDb, targetDb, tableName) {
    const sourceColumns = listTableColumns(sourceDb, tableName);
    const destinationColumnsSet = new Set(listTableColumns(targetDb, tableName));
    const compatibleColumns = sourceColumns.filter((column) => destinationColumnsSet.has(column));
    if (compatibleColumns.length === 0) {
        return 0;
    }
    const quotedColumns = compatibleColumns.map((column) => quoteIdentifier(column));
    const selectStmt = sourceDb.prepare(`SELECT ${quotedColumns.join(", ")} FROM ${quoteIdentifier(tableName)}`);
    const insertStmt = targetDb.prepare(`INSERT INTO ${quoteIdentifier(tableName)} (${quotedColumns.join(", ")}) VALUES (${compatibleColumns
        .map(() => "?")
        .join(", ")})`);
    let restoredRows = 0;
    for (const row of selectStmt.iterate()) {
        const values = compatibleColumns.map((column) => row[column]);
        insertStmt.run(...values);
        restoredRows += 1;
    }
    return restoredRows;
}
function writeScopedBackupMetadata(snapshotDb, scope) {
    snapshotDb.exec(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(BACKUP_METADATA_TABLE)} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
    const upsertMetadata = snapshotDb.prepare(`INSERT OR REPLACE INTO ${quoteIdentifier(BACKUP_METADATA_TABLE)} (key, value) VALUES (?, ?)`);
    upsertMetadata.run(BACKUP_METADATA_FORMAT_KEY, BACKUP_FORMAT_SCOPED_V1);
    upsertMetadata.run(BACKUP_METADATA_SCOPE_KEY, scope);
    upsertMetadata.run(BACKUP_METADATA_CREATED_AT_KEY, new Date().toISOString());
}
function writeOperationsCustomersFinancialsSnapshot(sourceDb, snapshotDb) {
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
    const insertStmt = snapshotDb.prepare(`
    INSERT INTO ${quoteIdentifier(OPERATIONS_CUSTOMERS_FINANCIALS_TABLE)}
      (customer_id, debt, total_purchases, total_spent)
    VALUES (?, ?, ?, ?)
  `);
    for (const row of selectStmt.iterate()) {
        insertStmt.run(row.customer_id, row.debt ?? 0, row.total_purchases ?? 0, row.total_spent ?? 0);
    }
}
function restoreOperationsCustomersFinancials(sourceDb, targetDb) {
    if (!tableExists(sourceDb, OPERATIONS_CUSTOMERS_FINANCIALS_TABLE) ||
        !tableExists(targetDb, "customers")) {
        return 0;
    }
    targetDb
        .prepare(`
      UPDATE customers
      SET debt = 0,
          total_purchases = 0,
          total_spent = 0,
          updated_at = datetime('now','localtime')
    `)
        .run();
    const selectStmt = sourceDb.prepare(`
    SELECT customer_id, debt, total_purchases, total_spent
    FROM ${quoteIdentifier(OPERATIONS_CUSTOMERS_FINANCIALS_TABLE)}
  `);
    const updateStmt = targetDb.prepare(`
    UPDATE customers
    SET debt = ?,
        total_purchases = ?,
        total_spent = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `);
    let updatedRows = 0;
    for (const row of selectStmt.iterate()) {
        updatedRows += updateStmt.run(row.debt ?? 0, row.total_purchases ?? 0, row.total_spent ?? 0, row.customer_id).changes;
    }
    return updatedRows;
}
async function createScopedDatabaseBackup(destinationPath, scope) {
    return withOperationLock(async () => {
        const finalPath = normalizeBackupDestinationPath(destinationPath);
        await promises_1.default.mkdir(node_path_1.default.dirname(finalPath), { recursive: true });
        const tempPath = `${finalPath}.tmp`;
        await safeUnlink(tempPath);
        let moved = false;
        let snapshotDb = null;
        try {
            snapshotDb = new better_sqlite3_1.default(tempPath);
            snapshotDb.pragma("journal_mode = DELETE");
            snapshotDb.pragma("synchronous = FULL");
            snapshotDb.pragma("foreign_keys = OFF");
            const sourceDb = (0, database_1.getDb)();
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
            await promises_1.default.rename(tempPath, finalPath);
            moved = true;
        }
        finally {
            snapshotDb?.close();
            if (!moved) {
                await safeUnlink(tempPath);
            }
        }
        const stat = await promises_1.default.stat(finalPath);
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
function buildRollbackBackupPath() {
    const fileName = `tobacco_pos_pre_restore_${formatTimestampForFileName(new Date())}.db`;
    return node_path_1.default.join(getSuggestedBackupDirectory(), fileName);
}
async function createRollbackSnapshot() {
    await promises_1.default.mkdir(getSuggestedBackupDirectory(), { recursive: true });
    const rollbackPath = buildRollbackBackupPath();
    const rollbackTempPath = `${rollbackPath}.tmp`;
    await safeUnlink(rollbackTempPath);
    await safeUnlink(rollbackPath);
    await (0, database_1.getDb)().backup(rollbackTempPath);
    await promises_1.default.rename(rollbackTempPath, rollbackPath);
    return { rollbackPath, rollbackTempPath };
}
async function restoreScopedDatabaseBackup(sourcePath, scope) {
    return withOperationLock(async () => {
        const normalizedSourcePath = node_path_1.default.resolve(sourcePath.trim());
        await assertReadableFile(normalizedSourcePath);
        validateScopedBackupFileSchema(normalizedSourcePath, scope);
        const { rollbackPath, rollbackTempPath } = await createRollbackSnapshot();
        let backupDb = null;
        try {
            backupDb = new better_sqlite3_1.default(normalizedSourcePath, {
                readonly: true,
                fileMustExist: true,
            });
            assertQuickCheck(backupDb);
            const mainDb = (0, database_1.getDb)();
            const applyRestore = mainDb.transaction(() => {
                for (const tableName of SCOPED_CLEAR_ORDER[scope]) {
                    if (tableExists(mainDb, tableName)) {
                        mainDb.prepare(`DELETE FROM ${quoteIdentifier(tableName)}`).run();
                    }
                }
                for (const tableName of SCOPED_RESTORE_ORDER[scope]) {
                    if (tableExists(backupDb, tableName) && tableExists(mainDb, tableName)) {
                        restoreTableRows(backupDb, mainDb, tableName);
                    }
                }
                if (scope === "operations") {
                    restoreOperationsCustomersFinancials(backupDb, mainDb);
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
        }
        finally {
            backupDb?.close();
            await safeUnlink(rollbackTempPath);
        }
    });
}
function getSuggestedBackupDirectory() {
    if (!electron_1.app.isPackaged) {
        return node_path_1.default.join(electron_1.app.getAppPath(), "backups");
    }
    return node_path_1.default.join(electron_1.app.getPath("documents"), "TobaccoPOS Backups");
}
function getSuggestedBackupPath(scope = "system") {
    const scopePrefix = scope === "system" ? "system" : scope;
    const fileName = `tobacco_pos_${scopePrefix}_backup_${formatTimestampForFileName(new Date())}.db`;
    return node_path_1.default.join(getSuggestedBackupDirectory(), fileName);
}
async function createDatabaseBackup(destinationPath) {
    return withOperationLock(async () => {
        const finalPath = normalizeBackupDestinationPath(destinationPath);
        await promises_1.default.mkdir(node_path_1.default.dirname(finalPath), { recursive: true });
        const tempPath = `${finalPath}.tmp`;
        await safeUnlink(tempPath);
        let moved = false;
        try {
            await (0, database_1.getDb)().backup(tempPath);
            await safeUnlink(finalPath);
            await promises_1.default.rename(tempPath, finalPath);
            moved = true;
        }
        finally {
            if (!moved) {
                await safeUnlink(tempPath);
            }
        }
        const stat = await promises_1.default.stat(finalPath);
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
async function createBackup(destinationPath, scope = "system") {
    if (scope === "system") {
        const result = await createDatabaseBackup(destinationPath);
        return {
            ...result,
            scope: "system",
        };
    }
    return createScopedDatabaseBackup(destinationPath, scope);
}
async function restoreDatabaseBackup(sourcePath) {
    return withOperationLock(async () => {
        const normalizedSourcePath = node_path_1.default.resolve(sourcePath.trim());
        const databasePath = (0, database_1.getDatabasePath)();
        if (normalizedSourcePath === node_path_1.default.resolve(databasePath)) {
            throw new Error("لا يمكن الاستعادة من ملف قاعدة البيانات النشط حالياً.");
        }
        await assertReadableFile(normalizedSourcePath);
        validateBackupFileSchema(normalizedSourcePath);
        await promises_1.default.mkdir(node_path_1.default.dirname(databasePath), { recursive: true });
        const { rollbackPath, rollbackTempPath } = await createRollbackSnapshot();
        (0, database_1.closeDatabase)();
        try {
            await replaceDatabaseFile(normalizedSourcePath, databasePath);
            (0, database_1.initDatabase)();
            return {
                canceled: false,
                sourcePath: normalizedSourcePath,
                rollbackBackupPath: rollbackPath,
                restoredAt: new Date().toISOString(),
                requiresReload: true,
            };
        }
        catch (restoreError) {
            const restoreMessage = restoreError instanceof Error
                ? restoreError.message
                : "Unknown restore error";
            try {
                await replaceDatabaseFile(rollbackPath, databasePath);
                (0, database_1.initDatabase)();
            }
            catch (rollbackError) {
                const rollbackMessage = rollbackError instanceof Error
                    ? rollbackError.message
                    : "Unknown rollback error";
                throw new Error(`فشل الاستعادة (${restoreMessage}) وتعذرت إعادة قاعدة البيانات السابقة (${rollbackMessage}).`);
            }
            throw new Error(`فشل استعادة النسخة الاحتياطية، وتمت إعادة قاعدة البيانات السابقة تلقائياً. (${restoreMessage})`);
        }
        finally {
            await safeUnlink(rollbackTempPath);
        }
    });
}
async function restoreBackup(sourcePath, scope = "system") {
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
