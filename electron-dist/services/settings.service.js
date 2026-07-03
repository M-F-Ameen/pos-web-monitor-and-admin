"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
exports.resetData = resetData;
exports.resetOperationsData = resetOperationsData;
const database_1 = require("../database");
// ============================================
// Settings Service
// ============================================
const DEFAULT_CLOUD_SYNC = {
    enabled: false,
    serverUrl: "",
    apiKey: "",
    syncInterval: 5,
    lastSyncAt: null,
    lastSyncStatus: null,
};
const DEFAULTS = {
    storeName: "متجر التبغ",
    storeAddress: "شارع الملك فهد، الرياض",
    storePhone: "+966 50 123 4567",
    taxRate: 5,
    currency: "LE",
    currencySymbol: "ج.م",
    themeMode: "dark",
    receiptFooter: "نشكركم على تسوقكم معنا",
    defaultPaymentMethod: "cash",
    allowNegativeStock: false,
    requireCustomer: false,
    printReceiptAutomatically: false,
    receiptPrinterName: "",
    defaultProductImage: "",
    cloudSync: DEFAULT_CLOUD_SYNC,
};
function getSettings() {
    const db = (0, database_1.getDb)();
    const rows = db.prepare("SELECT key, value FROM settings").all();
    const stored = {};
    for (const row of rows) {
        stored[row.key] = row.value;
    }
    let cloudSync = DEFAULT_CLOUD_SYNC;
    try {
        if (stored.cloudSync) {
            const parsed = JSON.parse(stored.cloudSync);
            cloudSync = { ...DEFAULT_CLOUD_SYNC, ...parsed };
        }
    }
    catch {
        // ignore invalid JSON
    }
    return {
        storeName: stored.storeName ?? DEFAULTS.storeName,
        storeAddress: stored.storeAddress ?? DEFAULTS.storeAddress,
        storePhone: stored.storePhone ?? DEFAULTS.storePhone,
        taxRate: stored.taxRate ? Number(stored.taxRate) : DEFAULTS.taxRate,
        currency: stored.currency ?? DEFAULTS.currency,
        currencySymbol: stored.currencySymbol ?? DEFAULTS.currencySymbol,
        themeMode: stored.themeMode === "light" ? "light" : DEFAULTS.themeMode,
        receiptFooter: stored.receiptFooter ?? DEFAULTS.receiptFooter,
        defaultPaymentMethod: stored.defaultPaymentMethod ??
            DEFAULTS.defaultPaymentMethod,
        allowNegativeStock: stored.allowNegativeStock === "true",
        requireCustomer: stored.requireCustomer === "true",
        printReceiptAutomatically: stored.printReceiptAutomatically === "true",
        receiptPrinterName: stored.receiptPrinterName ?? DEFAULTS.receiptPrinterName,
        defaultProductImage: stored.defaultProductImage ?? DEFAULTS.defaultProductImage,
        cloudSync,
    };
}
function updateSettings(data) {
    const db = (0, database_1.getDb)();
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    const incoming = data;
    if (incoming.__resetOperations === true) {
        resetOperationsData();
        return getSettings();
    }
    if (typeof incoming.__resetDataScope === "string" &&
        (incoming.__resetDataScope === "system" ||
            incoming.__resetDataScope === "inventory" ||
            incoming.__resetDataScope === "operations")) {
        resetData(incoming.__resetDataScope);
        return getSettings();
    }
    const txn = db.transaction(() => {
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined) {
                if (key === "cloudSync") {
                    upsert.run(key, JSON.stringify(value));
                }
                else {
                    upsert.run(key, String(value));
                }
            }
        }
    });
    txn();
    return getSettings();
}
function quoteIdentifier(name) {
    return `"${name.replace(/"/g, '""')}"`;
}
function tableExists(tableName) {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare(`
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `)
        .get(tableName);
    return Boolean(row);
}
function countRows(tableName) {
    if (!tableExists(tableName)) {
        return 0;
    }
    const db = (0, database_1.getDb)();
    const row = db
        .prepare(`SELECT COUNT(*) as count FROM ${quoteIdentifier(tableName)}`)
        .get();
    return row.count;
}
function clearTable(tableName) {
    if (!tableExists(tableName)) {
        return;
    }
    const db = (0, database_1.getDb)();
    db.prepare(`DELETE FROM ${quoteIdentifier(tableName)}`).run();
}
function resetInventoryData() {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        const affectedRows = {
            products: countRows("products"),
            categories: countRows("categories"),
            suppliers: countRows("suppliers"),
            supplierOperations: countRows("supplier_operations"),
        };
        clearTable("supplier_operations");
        clearTable("products");
        clearTable("suppliers");
        clearTable("categories");
        return {
            scope: "inventory",
            affectedRows,
            resetAt: new Date().toISOString(),
        };
    });
    return txn();
}
/**
 * Reset operational data so the business can start a fresh cycle.
 * Keeps master data (products, categories, customers, users, settings) intact.
 */
function resetOperationsDataSummary() {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        const affectedRows = {
            saleItems: countRows("sale_items"),
            sales: countRows("sales"),
            returns: countRows("returns"),
            treasuryOperations: countRows("treasury_ops"),
            userShifts: countRows("user_shifts"),
        };
        // Reset customer financial aggregates (debt + purchase history).
        const resetCustomersFinancials = tableExists("customers")
            ? db
                .prepare(`
        UPDATE customers
        SET debt = 0,
            total_purchases = 0,
            total_spent = 0,
            updated_at = datetime('now','localtime')
        WHERE debt <> 0 OR total_purchases <> 0 OR total_spent <> 0
      `)
                .run().changes
            : 0;
        affectedRows.customersFinancials = resetCustomersFinancials;
        // Clear all operation tables.
        clearTable("sale_items");
        clearTable("returns");
        clearTable("sales");
        clearTable("treasury_ops");
        clearTable("user_shifts");
        return {
            scope: "operations",
            affectedRows,
            resetAt: new Date().toISOString(),
        };
    });
    return txn();
}
function resetSystemData() {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        const affectedRows = {
            saleItems: countRows("sale_items"),
            sales: countRows("sales"),
            returns: countRows("returns"),
            treasuryOperations: countRows("treasury_ops"),
            userShifts: countRows("user_shifts"),
            products: countRows("products"),
            categories: countRows("categories"),
            suppliers: countRows("suppliers"),
            supplierOperations: countRows("supplier_operations"),
            customers: countRows("customers"),
            users: countRows("users"),
            settings: countRows("settings"),
        };
        clearTable("sale_items");
        clearTable("returns");
        clearTable("sales");
        clearTable("treasury_ops");
        clearTable("user_shifts");
        clearTable("supplier_operations");
        clearTable("products");
        clearTable("categories");
        clearTable("suppliers");
        clearTable("customers");
        clearTable("users");
        clearTable("settings");
        return affectedRows;
    });
    const affectedRows = txn();
    (0, database_1.seedDatabase)();
    return {
        scope: "system",
        affectedRows,
        resetAt: new Date().toISOString(),
        defaultsReseeded: true,
    };
}
function resetData(scope) {
    if (scope === "system") {
        return resetSystemData();
    }
    if (scope === "inventory") {
        return resetInventoryData();
    }
    return resetOperationsDataSummary();
}
function resetOperationsData() {
    const summary = resetOperationsDataSummary();
    return {
        deletedSales: summary.affectedRows.sales ?? 0,
        deletedReturns: summary.affectedRows.returns ?? 0,
        deletedTreasuryOperations: summary.affectedRows.treasuryOperations ?? 0,
        resetCustomers: summary.affectedRows.customersFinancials ?? 0,
        resetAt: summary.resetAt,
    };
}
