import { getDb, seedDatabase } from "../database";
import type {
  CloudSyncSettings,
  DataResetSummary,
  DataScope,
  OperationsResetSummary,
  POSSettings,
} from "../shared/types";

// ============================================
// Settings Service
// ============================================

const DEFAULT_CLOUD_SYNC: CloudSyncSettings = {
  enabled: false,
  serverUrl: "",
  apiKey: "",
  syncInterval: 5,
  lastSyncAt: null,
  lastSyncStatus: null,
};

const DEFAULTS: POSSettings = {
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

export function getSettings(): POSSettings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];

  const stored: Record<string, string> = {};
  for (const row of rows) {
    stored[row.key] = row.value;
  }

  let cloudSync: CloudSyncSettings = DEFAULT_CLOUD_SYNC;
  try {
    if (stored.cloudSync) {
      const parsed = JSON.parse(stored.cloudSync);
      cloudSync = { ...DEFAULT_CLOUD_SYNC, ...parsed };
    }
  } catch {
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
    defaultPaymentMethod:
      (stored.defaultPaymentMethod as POSSettings["defaultPaymentMethod"]) ??
      DEFAULTS.defaultPaymentMethod,
    allowNegativeStock: stored.allowNegativeStock === "true",
    requireCustomer: stored.requireCustomer === "true",
    printReceiptAutomatically: stored.printReceiptAutomatically === "true",
    receiptPrinterName:
      stored.receiptPrinterName ?? DEFAULTS.receiptPrinterName,
    defaultProductImage:
      stored.defaultProductImage ?? DEFAULTS.defaultProductImage,
    cloudSync,
  };
}

export function updateSettings(data: Partial<POSSettings>): POSSettings {
  const db = getDb();
  const upsert = db.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
  );

  const incoming = data as Record<string, unknown>;
  if (incoming.__resetOperations === true) {
    resetOperationsData();
    return getSettings();
  }
  if (
    typeof incoming.__resetDataScope === "string" &&
    (incoming.__resetDataScope === "system" ||
      incoming.__resetDataScope === "inventory" ||
      incoming.__resetDataScope === "operations")
  ) {
    resetData(incoming.__resetDataScope);
    return getSettings();
  }

  const txn = db.transaction(() => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (key === "cloudSync") {
          upsert.run(key, JSON.stringify(value));
        } else {
          upsert.run(key, String(value));
        }
      }
    }
  });

  txn();
  return getSettings();
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function tableExists(tableName: string): boolean {
  const db = getDb();
  const row = db
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

function countRows(tableName: string): number {
  if (!tableExists(tableName)) {
    return 0;
  }
  const db = getDb();
  const row = db
    .prepare(`SELECT COUNT(*) as count FROM ${quoteIdentifier(tableName)}`)
    .get() as { count: number };
  return row.count;
}

function clearTable(tableName: string): void {
  if (!tableExists(tableName)) {
    return;
  }
  const db = getDb();
  db.prepare(`DELETE FROM ${quoteIdentifier(tableName)}`).run();
}

function resetInventoryData(): DataResetSummary {
  const db = getDb();

  const txn = db.transaction(() => {
    const affectedRows: Record<string, number> = {
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
    } satisfies DataResetSummary;
  });

  return txn();
}

/**
 * Reset operational data so the business can start a fresh cycle.
 * Keeps master data (products, categories, customers, users, settings) intact.
 */
function resetOperationsDataSummary(): DataResetSummary {
  const db = getDb();

  const txn = db.transaction(() => {
    const affectedRows: Record<string, number> = {
      saleItems: countRows("sale_items"),
      sales: countRows("sales"),
      returns: countRows("returns"),
      treasuryOperations: countRows("treasury_ops"),
      userShifts: countRows("user_shifts"),
    };

    // Reset customer financial aggregates (debt + purchase history).
    const resetCustomersFinancials = tableExists("customers")
      ? db
          .prepare(
            `
        UPDATE customers
        SET debt = 0,
            total_purchases = 0,
            total_spent = 0,
            updated_at = datetime('now','localtime')
        WHERE debt <> 0 OR total_purchases <> 0 OR total_spent <> 0
      `,
          )
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
    } satisfies DataResetSummary;
  });

  return txn();
}

function resetSystemData(): DataResetSummary {
  const db = getDb();

  const txn = db.transaction(() => {
    const affectedRows: Record<string, number> = {
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
  seedDatabase();

  return {
    scope: "system",
    affectedRows,
    resetAt: new Date().toISOString(),
    defaultsReseeded: true,
  };
}

export function resetData(scope: DataScope): DataResetSummary {
  if (scope === "system") {
    return resetSystemData();
  }
  if (scope === "inventory") {
    return resetInventoryData();
  }
  return resetOperationsDataSummary();
}

export function resetOperationsData(): OperationsResetSummary {
  const summary = resetOperationsDataSummary();
  return {
    deletedSales: summary.affectedRows.sales ?? 0,
    deletedReturns: summary.affectedRows.returns ?? 0,
    deletedTreasuryOperations: summary.affectedRows.treasuryOperations ?? 0,
    resetCustomers: summary.affectedRows.customersFinancials ?? 0,
    resetAt: summary.resetAt,
  };
}
