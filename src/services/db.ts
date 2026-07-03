/**
 * Frontend Database Service
 *
 * Thin wrapper around window.electronAPI for use in React components.
 * Provides a clean async API that all pages use instead of localStorage.
 *
 * If electronAPI is not available (browser-only dev mode), falls back
 * to localStorage so the app can still be tested in a browser.
 */

// Re-export shared types for easy imports from React components
export type {
  User,
  AuthResult,
  Category,
  Product,
  ProductLite,
  Customer,
  Supplier,
  SupplierOperation,
  CreateSupplierOperationInput,
  SettleSupplierDebtInput,
  SupplierOperationResult,
  Sale,
  SaleItem,
  Return,
  TreasuryOperation,
  TreasurySummary,
  TreasuryOperationRow,
  POSSettings,
  ThemeMode,
  PaymentMethod,
  SaleStatus,
  ReturnStatus,
  UserRole,
  ManualOperationType,
  TreasuryOperationType,
  DashboardStats,
  DataScope,
  DataResetSummary,
  OperationsResetSummary,
  UserShift,
  UserShiftMetrics,
  UserShiftOperation,
  UserActivityReport,
  UserShiftOperationType,
  InstalledPrinter,
  PrinterListResult,
  ReceiptPrintOptions,
  ReceiptPrintResult,
  DataBackupResult,
  DataRestoreResult,
  AutoBackupStatus,
  PagedResult,
  SalesListQuery,
  SalesTimelineQuery,
  SalesTimelineRow,
  ReturnsListQuery,
  SaleRefundInput,
  SaleRefundResult,
  ReturnBatchEntryInput,
  ReportsQuery,
  ReportsNetRevenuePayload,
  ReportsSummaryPayload,
  ProductsListQuery,
  ProductsPagedResult,
  CustomersListQuery,
  CustomersPagedResult,
  SuppliersListQuery,
  SuppliersPagedResult,
  UsersListQuery,
  UsersPagedResult,
} from "../../electron/shared/types";
import type {
  DataBackupResult,
  DataRestoreResult,
  DataScope,
  DataResetSummary,
  OperationsResetSummary,
  AutoBackupStatus,
  PrinterListResult,
  ReceiptPrintOptions,
  ReceiptPrintResult,
  PagedResult,
  Sale,
  Return,
  SalesListQuery,
  SalesTimelineQuery,
  SalesTimelineRow,
  ReturnsListQuery,
  SaleRefundInput,
  SaleRefundResult,
  ReturnBatchEntryInput,
  ReportsQuery,
  ReportsNetRevenuePayload,
  ReportsSummaryPayload,
  ProductLite,
  ProductsListQuery,
  ProductsPagedResult,
  CustomersListQuery,
  CustomersPagedResult,
  UsersListQuery,
  UsersPagedResult,
  SuppliersListQuery,
  SuppliersPagedResult,
  SupplierOperation,
  CreateSupplierOperationInput,
  SettleSupplierDebtInput,
  SupplierOperationResult,
} from "../../electron/shared/types";

function api() {
  return window.electronAPI;
}

function isElectron(): boolean {
  return !!window.electronAPI;
}

const READ_CACHE_TTL_MS = 30_000;
const readCache = new Map<string, { expiresAt: number; value: unknown }>();

function getCachedValue<T>(key: string): T | undefined {
  const cached = readCache.get(key);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    readCache.delete(key);
    return undefined;
  }

  return cached.value as T;
}

function setCachedValue<T>(
  key: string,
  value: T,
  ttlMs = READ_CACHE_TTL_MS,
): T {
  readCache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
  return value;
}

async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = READ_CACHE_TTL_MS,
): Promise<T> {
  const cached = getCachedValue<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const value = await loader();
  return setCachedValue(key, value, ttlMs);
}

function invalidateCache(prefixes: string | string[]): void {
  const prefixList = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const key of readCache.keys()) {
    if (prefixList.some((prefix) => key.startsWith(prefix))) {
      readCache.delete(key);
    }
  }
}

function invalidateAllCache(): void {
  readCache.clear();
}

// ============================================
// Auth
// ============================================

export const auth = {
  login: async (email: string, password: string) => {
    const a = api();
    if (!a) {
      // Browser fallback — accept any credentials (dev only)
      return {
        success: true,
        shiftId: `shift-dev-${Date.now()}`,
        user: {
          id: "dev",
          fullName: "Developer",
          email,
          role: "admin" as const,
          pagePermissions: [],
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      };
    }
    return a.login(email, password);
  },
  logout: async (userId: string, shiftId?: string) =>
    api()?.logout(userId, shiftId) ?? true,
};

// ============================================
// Users
// ============================================

export const users = {
  list: async () => withCache("users:list", async () => api()?.listUsers() ?? []),
  listPaged: async (query?: UsersListQuery): Promise<UsersPagedResult> =>
    api()?.listUsersPaged(query) ?? {
      items: [],
      total: 0,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalPages: 1,
      adminsCount: 0,
      totalCount: 0,
    },
  getById: async (id: string) => api()?.getUserById(id) ?? null,
  getActivityById: async (id: string) => api()?.getUserActivityById(id) ?? null,
  getShiftOperations: async (shiftId: string) =>
    api()?.getUserShiftOperations(shiftId) ?? [],
  create: async (data: {
    fullName: string;
    email: string;
    password: string;
    role: string;
    pagePermissions?: string[];
  }) => {
    const result = (await api()?.createUser(data)) ?? null;
    invalidateCache("users:");
    return result;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const result = (await api()?.updateUser(id, data)) ?? null;
    invalidateCache("users:");
    return result;
  },
  delete: async (id: string) => {
    const result = (await api()?.deleteUser(id)) ?? false;
    invalidateCache("users:");
    return result;
  },
};

// ============================================
// Categories
// ============================================

export const categories = {
  list: async () =>
    withCache("categories:list", async () => api()?.listCategories() ?? []),
  getById: async (id: string) => api()?.getCategoryById(id) ?? null,
  create: async (data: { name: string; image?: string }) => {
    const result = (await api()?.createCategory(data)) ?? null;
    invalidateCache(["categories:", "products:"]);
    return result;
  },
  update: async (id: string, data: { name: string; image?: string }) => {
    const result = (await api()?.updateCategory(id, data)) ?? null;
    invalidateCache(["categories:", "products:"]);
    return result;
  },
  delete: async (id: string) => {
    const result = (await api()?.deleteCategory(id)) ?? false;
    invalidateCache(["categories:", "products:"]);
    return result;
  },
  deleteAll: async () => {
    const result = (await api()?.deleteAllCategories()) ?? 0;
    invalidateCache(["categories:", "products:"]);
    return result;
  },
};

// ============================================
// Products
// ============================================

export const products = {
  list: async (activeOnly?: boolean) =>
    withCache(
      `products:list:${activeOnly ? "active" : "all"}`,
      async () => api()?.listProducts(activeOnly) ?? [],
    ),
  listLite: async (activeOnly?: boolean): Promise<ProductLite[]> =>
    withCache(
      `products:listLite:${activeOnly ? "active" : "all"}`,
      async () => api()?.listProductsLite(activeOnly) ?? [],
    ),
  listPaged: async (query?: ProductsListQuery): Promise<ProductsPagedResult> =>
    api()?.listProductsPaged(query) ?? {
      items: [],
      total: 0,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalPages: 1,
      totalValue: 0,
      totalCount: 0,
    },
  getById: async (id: string) => api()?.getProductById(id) ?? null,
  getByBarcode: async (barcode: string) =>
    api()?.getProductByBarcode(barcode) ?? null,
  create: async (data: Record<string, unknown>) => {
    const result = (await api()?.createProduct(data)) ?? null;
    invalidateCache("products:");
    return result;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const result = (await api()?.updateProduct(id, data)) ?? null;
    invalidateCache("products:");
    return result;
  },
  delete: async (id: string) => {
    const result = (await api()?.deleteProduct(id)) ?? false;
    invalidateCache("products:");
    return result;
  },
  deleteAll: async () => {
    const result = (await api()?.deleteAllProducts()) ?? 0;
    invalidateCache("products:");
    return result;
  },
};

// ============================================
// Customers
// ============================================

export const customers = {
  list: async () =>
    withCache("customers:list", async () => api()?.listCustomers() ?? []),
  listPaged: async (
    query?: CustomersListQuery,
  ): Promise<CustomersPagedResult> =>
    api()?.listCustomersPaged(query) ?? {
      items: [],
      total: 0,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalPages: 1,
      totalDebt: 0,
      totalSpent: 0,
      totalCount: 0,
    },
  getById: async (id: string) => api()?.getCustomerById(id) ?? null,
  create: async (data: Record<string, unknown>) => {
    const result = (await api()?.createCustomer(data)) ?? null;
    invalidateCache("customers:");
    return result;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const result = (await api()?.updateCustomer(id, data)) ?? null;
    invalidateCache("customers:");
    return result;
  },
  delete: async (id: string) => {
    const result = (await api()?.deleteCustomer(id)) ?? false;
    invalidateCache("customers:");
    return result;
  },
  deleteAll: async () => {
    const result = (await api()?.deleteAllCustomers()) ?? 0;
    invalidateCache("customers:");
    return result;
  },
};

// ============================================
// Suppliers
// ============================================

export const suppliers = {
  list: async () => api()?.listSuppliers() ?? [],
  listPaged: async (
    query?: SuppliersListQuery,
  ): Promise<SuppliersPagedResult> =>
    api()?.listSuppliersPaged(query) ?? {
      items: [],
      total: 0,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalPages: 1,
      totalDebt: 0,
      totalPaid: 0,
      totalCount: 0,
    },
  getById: async (id: string) => api()?.getSupplierById(id) ?? null,
  create: async (data: Record<string, unknown>) => {
    const result = (await api()?.createSupplier(data)) ?? null;
    invalidateCache("suppliers:");
    return result;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const result = (await api()?.updateSupplier(id, data)) ?? null;
    invalidateCache("suppliers:");
    return result;
  },
  delete: async (id: string) => {
    const result = (await api()?.deleteSupplier(id)) ?? false;
    invalidateCache("suppliers:");
    return result;
  },
  deleteAll: async () => {
    const result = (await api()?.deleteAllSuppliers()) ?? 0;
    invalidateCache("suppliers:");
    return result;
  },
  listOperations: async (supplierId: string): Promise<SupplierOperation[]> =>
    api()?.listSupplierOperations(supplierId) ?? [],
  createOperation: async (
    data: CreateSupplierOperationInput,
  ): Promise<SupplierOperationResult | null> => {
    const result = (await api()?.createSupplierOperation(data)) ?? null;
    invalidateCache("suppliers:");
    return result;
  },
  settleDebt: async (
    data: SettleSupplierDebtInput,
  ): Promise<SupplierOperationResult | null> => {
    const result = (await api()?.settleSupplierDebt(data)) ?? null;
    invalidateCache("suppliers:");
    return result;
  },
  settleDebtAll: async (
    supplierId: string,
    note?: string,
  ): Promise<SupplierOperationResult | null> => {
    const result = (await api()?.settleSupplierDebtAll(supplierId, note)) ?? null;
    invalidateCache("suppliers:");
    return result;
  },
};

// ============================================
// Sales
// ============================================

export const sales = {
  list: async (query?: SalesListQuery) => api()?.listSales(query) ?? [],
  listPaged: async (query?: SalesListQuery): Promise<PagedResult<Sale>> =>
    api()?.listSalesPaged(query) ?? {
      items: [],
      total: 0,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalPages: 1,
    },
  listTimelinePaged: async (
    query?: SalesTimelineQuery,
  ): Promise<PagedResult<SalesTimelineRow>> =>
    api()?.listSalesTimelinePaged(query) ?? {
      items: [],
      total: 0,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalPages: 1,
    },
  getById: async (id: string) => api()?.getSaleById(id) ?? null,
  create: async (data: Record<string, unknown>) => {
    const result = (await api()?.createSale(data)) ?? null;
    invalidateCache(["sales:", "products:", "customers:", "treasury:"]);
    return result;
  },
  update: async (id: string, data: Record<string, unknown>) => {
    const result = (await api()?.updateSale(id, data)) ?? null;
    invalidateCache(["sales:", "products:", "customers:", "treasury:"]);
    return result;
  },
  updateStatus: async (id: string, status: string) => {
    const result = (await api()?.updateSaleStatus(id, status)) ?? null;
    invalidateCache(["sales:", "products:", "customers:", "treasury:"]);
    return result;
  },
  refund: async (data: SaleRefundInput): Promise<SaleRefundResult | null> => {
    const result = (await api()?.refundSale(data)) ?? null;
    invalidateCache([
      "sales:",
      "returns:",
      "products:",
      "customers:",
      "treasury:",
    ]);
    return result;
  },
  delete: async (id: string) => {
    const result = (await api()?.deleteSale(id)) ?? false;
    invalidateCache(["sales:", "products:", "customers:", "treasury:"]);
    return result;
  },
  deleteAll: async () => {
    const result = (await api()?.deleteAllSales()) ?? 0;
    invalidateCache(["sales:", "products:", "customers:", "treasury:"]);
    return result;
  },
};

// ============================================
// Returns
// ============================================

export const returns = {
  list: async (query?: ReturnsListQuery) => api()?.listReturns(query) ?? [],
  listPaged: async (query?: ReturnsListQuery): Promise<PagedResult<Return>> =>
    api()?.listReturnsPaged(query) ?? {
      items: [],
      total: 0,
      page: query?.page ?? 1,
      pageSize: query?.pageSize ?? 20,
      totalPages: 1,
    },
  getById: async (id: string) => api()?.getReturnById(id) ?? null,
  create: async (data: Record<string, unknown>) => {
    const result = (await api()?.createReturn(data)) ?? null;
    invalidateCache(["returns:", "products:", "sales:", "treasury:"]);
    return result;
  },
  createBatch: async (entries: ReturnBatchEntryInput[]) => {
    const result = (await api()?.createReturnsBatch({ entries })) ?? [];
    invalidateCache(["returns:", "products:", "sales:", "treasury:"]);
    return result;
  },
  updateStatus: async (id: string, status: string) => {
    const result = (await api()?.updateReturnStatus(id, status)) ?? null;
    invalidateCache(["returns:", "products:", "sales:", "treasury:"]);
    return result;
  },
  delete: async (id: string) => {
    const result = (await api()?.deleteReturn(id)) ?? false;
    invalidateCache(["returns:", "products:", "sales:", "treasury:"]);
    return result;
  },
  deleteAll: async () => {
    const result = (await api()?.deleteAllReturns()) ?? 0;
    invalidateCache(["returns:", "products:", "sales:", "treasury:"]);
    return result;
  },
};

// ============================================
// Reports
// ============================================

export const reports = {
  getNetRevenue: async (
    query?: ReportsQuery,
  ): Promise<ReportsNetRevenuePayload> =>
    api()?.getReportsNetRevenue(query) ?? {
      grossSales: 0,
      totalRefunds: 0,
      netRevenue: 0,
    },
  getSummary: async (query?: ReportsQuery): Promise<ReportsSummaryPayload> =>
    api()?.getReportsSummary(query) ?? {
      grossSales: 0,
      totalRefunds: 0,
      netRevenue: 0,
      totalOrders: 0,
      soldUnits: 0,
      inventoryUnits: 0,
      inventoryValue: 0,
      totalCustomerDebt: 0,
      debtCustomersCount: 0,
      topProducts: [],
      lowStockProducts: [],
      debtCustomers: [],
      dailyRows: [],
    },
};

// ============================================
// Treasury
// ============================================

export const treasury = {
  getSummary: async () =>
    api()?.getTreasurySummary() ?? {
      totalSales: 0,
      totalReturns: 0,
      totalWithdrawals: 0,
      totalExpenses: 0,
      currentCash: 0,
      operations: [],
    },
  listOps: async () => api()?.listTreasuryOps() ?? [],
  createOp: async (data: Record<string, unknown>) => {
    const result = (await api()?.createTreasuryOp(data)) ?? null;
    invalidateCache("treasury:");
    return result;
  },
  deleteOp: async (id: string) => {
    const result = (await api()?.deleteTreasuryOp(id)) ?? false;
    invalidateCache("treasury:");
    return result;
  },
  deleteAllOps: async () => {
    const result = (await api()?.deleteAllTreasuryOps()) ?? 0;
    invalidateCache("treasury:");
    return result;
  },
};

// ============================================
// Settings
// ============================================

export const settings = {
  get: async () =>
    api()?.getSettings() ?? {
      storeName: "متجر التبغ",
      storeAddress: "",
      storePhone: "",
      taxRate: 5,
      currency: "LE",
      currencySymbol: "ج.م",
      themeMode: "dark" as const,
      receiptFooter: "",
      defaultPaymentMethod: "cash" as const,
      allowNegativeStock: false,
      requireCustomer: false,
      printReceiptAutomatically: false,
      receiptPrinterName: "",
      defaultProductImage: "",
    },
  update: async (data: Record<string, unknown>) => {
    const result = (await api()?.updateSettings(data)) ?? null;
    invalidateCache("settings:");
    return result;
  },
  resetData: async (scope: DataScope): Promise<DataResetSummary> => {
    const bridge = api();
    if (!bridge) {
      throw new Error("Electron bridge is unavailable.");
    }

    if (typeof bridge.resetData === "function") {
      const result = await bridge.resetData(scope);
      invalidateAllCache();
      return result;
    }

    if (
      scope === "operations" &&
      typeof bridge.resetOperations === "function"
    ) {
      const operationsSummary = await bridge.resetOperations();
      invalidateAllCache();
      return {
        scope: "operations",
        affectedRows: {
          sales: operationsSummary.deletedSales,
          returns: operationsSummary.deletedReturns,
          treasuryOperations: operationsSummary.deletedTreasuryOperations,
          customersFinancials: operationsSummary.resetCustomers,
        },
        resetAt: operationsSummary.resetAt,
      };
    }

    if (typeof bridge.updateSettings === "function") {
      await bridge.updateSettings({ __resetDataScope: scope });
      invalidateAllCache();
      return {
        scope,
        affectedRows: {},
        resetAt: new Date().toISOString(),
      };
    }

    throw new Error(
      "Reset API is not active in this session. Restart the app and try again.",
    );
  },
  resetOperations: async (): Promise<OperationsResetSummary> => {
    const resetSummary = await settings.resetData("operations");
    return {
      deletedSales: resetSummary.affectedRows.sales ?? 0,
      deletedReturns: resetSummary.affectedRows.returns ?? 0,
      deletedTreasuryOperations:
        resetSummary.affectedRows.treasuryOperations ?? 0,
      resetCustomers: resetSummary.affectedRows.customersFinancials ?? 0,
      resetAt: resetSummary.resetAt,
    };
  },
  createBackup: async (
    scope: DataScope = "system",
  ): Promise<DataBackupResult> => {
    const bridge = api();
    if (!bridge?.createBackup) {
      throw new Error("Electron bridge is unavailable.");
    }
    return bridge.createBackup(scope);
  },
  createAutoBackup: async (
    scope: DataScope = "system",
  ): Promise<DataBackupResult> => {
    const bridge = api();
    if (!bridge?.createAutoBackup) {
      throw new Error(
        "ميزة النسخ الاحتياطي التلقائي غير متاحة. أعد تشغيل التطبيق ثم حاول مرة أخرى.",
      );
    }
    return bridge.createAutoBackup(scope);
  },
  restoreBackup: async (
    scope: DataScope = "system",
  ): Promise<DataRestoreResult> => {
    const bridge = api();
    if (!bridge?.restoreBackup) {
      throw new Error(
        "ميزة الاستعادة غير متاحة. أعد تشغيل التطبيق ثم حاول مرة أخرى.",
      );
    }
    const result = await bridge.restoreBackup(scope);
    invalidateAllCache();
    return result;
  },
  getAutoBackupStatus: async (): Promise<AutoBackupStatus | null> => {
    const bridge = api();
    if (!bridge?.getAutoBackupStatus) {
      return null;
    }
    return bridge.getAutoBackupStatus();
  },
};

// ============================================
// Printers
// ============================================

export const printers = {
  list: async (): Promise<PrinterListResult> => {
    const bridge = api();
    if (!bridge?.listPrinters) {
      return {
        printers: [],
        userOverride: null,
        recommendedPrinterName: null,
        selectedPrinterName: null,
        defaultPrinterName: null,
        xp80cAvailable: false,
      };
    }
    return bridge.listPrinters();
  },
  printReceipt: async (
    html: string,
    options?: ReceiptPrintOptions,
  ): Promise<ReceiptPrintResult> => {
    const bridge = api();
    if (!bridge?.printReceipt) {
      return {
        success: false,
        printerName: null,
        source: "none",
        usedFallback: false,
        error: "Electron bridge is unavailable.",
      };
    }
    return bridge.printReceipt(html, options);
  },
  printTestReceipt: async (
    options?: ReceiptPrintOptions,
  ): Promise<ReceiptPrintResult> => {
    const bridge = api();
    if (!bridge?.printTestReceipt) {
      return {
        success: false,
        printerName: null,
        source: "none",
        usedFallback: false,
        error: "Electron bridge is unavailable.",
      };
    }
    return bridge.printTestReceipt(options);
  },
};

// ============================================
// Utility: check if running inside Electron
// ============================================

export { isElectron };
