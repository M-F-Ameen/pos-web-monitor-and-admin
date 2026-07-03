import { contextBridge, ipcRenderer } from "electron";
import type {
  AutoBackupStatus,
  CloudSyncSettings,
  DataScope,
  PrinterListResult,
  ProductLite,
  ReportsNetRevenuePayload,
  ReportsQuery,
  ReportsSummaryPayload,
  ReceiptPrintOptions,
  ReceiptPrintResult,
} from "./shared/types";

/**
 * Preload script — secure IPC bridge between main process and renderer.
 * Every database operation goes through these typed channels.
 */

type PrintPageSizeMicrons = {
  width: number;
  height: number;
};

type PrintHtmlOptions = {
  printerName?: string;
  printerNameCandidates?: string[];
  pageSizeMicrons?: PrintPageSizeMicrons;
  silent?: boolean;
};

const electronAPI = {
  // ---- App ----
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  getPlatform: (): Promise<string> => ipcRenderer.invoke("app:getPlatform"),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: (): Promise<boolean> =>
    ipcRenderer.invoke("window:toggleMaximize"),
  closeWindow: (): Promise<void> => ipcRenderer.invoke("window:close"),
  isWindowMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke("window:isMaximized"),
  toggleFullscreenWindow: (): Promise<boolean> =>
    ipcRenderer.invoke("window:toggleFullscreen"),
  isWindowFullscreen: (): Promise<boolean> =>
    ipcRenderer.invoke("window:isFullscreen"),
  printHtml: (html: string, options?: PrintHtmlOptions): Promise<boolean> =>
    ipcRenderer.invoke("app:printHtml", html, options),
  listPrinters: (): Promise<PrinterListResult> =>
    ipcRenderer.invoke("printers:list"),
  printReceipt: (
    html: string,
    options?: ReceiptPrintOptions,
  ): Promise<ReceiptPrintResult> =>
    ipcRenderer.invoke("printers:printReceipt", html, options),
  printTestReceipt: (
    options?: ReceiptPrintOptions,
  ): Promise<ReceiptPrintResult> =>
    ipcRenderer.invoke("printers:printTestReceipt", options),

  // ---- Auth ----
  login: (email: string, password: string) =>
    ipcRenderer.invoke("auth:login", email, password),
  logout: (userId: string, shiftId?: string) =>
    ipcRenderer.invoke("auth:logout", userId, shiftId),

  // ---- Users ----
  listUsers: () => ipcRenderer.invoke("users:list"),
  listUsersPaged: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("users:listPaged", query),
  getUserById: (id: string) => ipcRenderer.invoke("users:getById", id),
  getUserActivityById: (id: string) =>
    ipcRenderer.invoke("users:getActivityById", id),
  getUserShiftOperations: (shiftId: string) =>
    ipcRenderer.invoke("users:getShiftOperations", shiftId),
  createUser: (data: {
    fullName: string;
    email: string;
    password: string;
    role: string;
    pagePermissions?: string[];
  }) => ipcRenderer.invoke("users:create", data),
  updateUser: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke("users:update", id, data),
  deleteUser: (id: string) => ipcRenderer.invoke("users:delete", id),

  // ---- Categories ----
  listCategories: () => ipcRenderer.invoke("categories:list"),
  getCategoryById: (id: string) => ipcRenderer.invoke("categories:getById", id),
  createCategory: (data: { name: string }) =>
    ipcRenderer.invoke("categories:create", data),
  updateCategory: (id: string, data: { name: string }) =>
    ipcRenderer.invoke("categories:update", id, data),
  deleteCategory: (id: string) => ipcRenderer.invoke("categories:delete", id),
  deleteAllCategories: () => ipcRenderer.invoke("categories:deleteAll"),

  // ---- Products ----
  listProducts: (activeOnly?: boolean) =>
    ipcRenderer.invoke("products:list", activeOnly),
  listProductsLite: (activeOnly?: boolean): Promise<ProductLite[]> =>
    ipcRenderer.invoke("products:listLite", activeOnly),
  listProductsPaged: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("products:listPaged", query),
  getProductById: (id: string) => ipcRenderer.invoke("products:getById", id),
  getProductByBarcode: (barcode: string) =>
    ipcRenderer.invoke("products:getByBarcode", barcode),
  createProduct: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("products:create", data),
  updateProduct: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke("products:update", id, data),
  deleteProduct: (id: string) => ipcRenderer.invoke("products:delete", id),
  deleteAllProducts: () => ipcRenderer.invoke("products:deleteAll"),

  // ---- Customers ----
  listCustomers: () => ipcRenderer.invoke("customers:list"),
  listCustomersPaged: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("customers:listPaged", query),
  getCustomerById: (id: string) => ipcRenderer.invoke("customers:getById", id),
  createCustomer: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("customers:create", data),
  updateCustomer: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke("customers:update", id, data),
  deleteCustomer: (id: string) => ipcRenderer.invoke("customers:delete", id),
  deleteAllCustomers: () => ipcRenderer.invoke("customers:deleteAll"),

  // ---- Suppliers ----
  listSuppliers: () => ipcRenderer.invoke("suppliers:list"),
  listSuppliersPaged: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("suppliers:listPaged", query),
  getSupplierById: (id: string) => ipcRenderer.invoke("suppliers:getById", id),
  createSupplier: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("suppliers:create", data),
  updateSupplier: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke("suppliers:update", id, data),
  deleteSupplier: (id: string) => ipcRenderer.invoke("suppliers:delete", id),
  deleteAllSuppliers: () => ipcRenderer.invoke("suppliers:deleteAll"),
  listSupplierOperations: (supplierId: string) =>
    ipcRenderer.invoke("suppliers:listOperations", supplierId),
  createSupplierOperation: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("suppliers:createOperation", data),
  settleSupplierDebt: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("suppliers:settleDebt", data),
  settleSupplierDebtAll: (supplierId: string, note?: string) =>
    ipcRenderer.invoke("suppliers:settleDebtAll", supplierId, note),

  // ---- Sales ----
  listSales: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("sales:list", query),
  listSalesPaged: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("sales:listPaged", query),
  listSalesTimelinePaged: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("sales:listTimelinePaged", query),
  getSaleById: (id: string) => ipcRenderer.invoke("sales:getById", id),
  createSale: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("sales:create", data),
  updateSale: (id: string, data: Record<string, unknown>) =>
    ipcRenderer.invoke("sales:update", id, data),
  updateSaleStatus: (id: string, status: string) =>
    ipcRenderer.invoke("sales:updateStatus", id, status),
  refundSale: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("sales:refund", data),
  deleteSale: (id: string) => ipcRenderer.invoke("sales:delete", id),
  deleteAllSales: () => ipcRenderer.invoke("sales:deleteAll"),

  // ---- Returns ----
  listReturns: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("returns:list", query),
  listReturnsPaged: (query?: Record<string, unknown>) =>
    ipcRenderer.invoke("returns:listPaged", query),
  getReturnById: (id: string) => ipcRenderer.invoke("returns:getById", id),
  createReturn: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("returns:create", data),
  createReturnsBatch: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("returns:createBatch", data),
  updateReturnStatus: (id: string, status: string) =>
    ipcRenderer.invoke("returns:updateStatus", id, status),
  deleteReturn: (id: string) => ipcRenderer.invoke("returns:delete", id),
  deleteAllReturns: () => ipcRenderer.invoke("returns:deleteAll"),

  // ---- Treasury ----
  getTreasurySummary: () => ipcRenderer.invoke("treasury:getSummary"),
  listTreasuryOps: () => ipcRenderer.invoke("treasury:listOps"),
  createTreasuryOp: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("treasury:createOp", data),
  deleteTreasuryOp: (id: string) => ipcRenderer.invoke("treasury:deleteOp", id),
  deleteAllTreasuryOps: () => ipcRenderer.invoke("treasury:deleteAllOps"),

  // ---- Reports ----
  getReportsNetRevenue: (
    query?: ReportsQuery,
  ): Promise<ReportsNetRevenuePayload> =>
    ipcRenderer.invoke("reports:getNetRevenue", query),
  getReportsSummary: (query?: ReportsQuery): Promise<ReportsSummaryPayload> =>
    ipcRenderer.invoke("reports:getSummary", query),

  // ---- Settings ----
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (data: Record<string, unknown>) =>
    ipcRenderer.invoke("settings:update", data),
  resetData: (scope: DataScope) =>
    ipcRenderer.invoke("settings:resetData", scope),
  resetOperations: () => ipcRenderer.invoke("settings:resetOperations"),
  getAutoBackupStatus: (): Promise<AutoBackupStatus> =>
    ipcRenderer.invoke("settings:getAutoBackupStatus"),
  createAutoBackup: (scope?: DataScope) =>
    ipcRenderer.invoke("settings:createAutoBackup", scope),
  createBackup: (scope?: DataScope) =>
    ipcRenderer.invoke("settings:createBackup", scope),
  restoreBackup: (scope?: DataScope) =>
    ipcRenderer.invoke("settings:restoreBackup", scope),

  // ---- Cloud Sync ----
  getCloudSyncSettings: (): Promise<CloudSyncSettings> =>
    ipcRenderer.invoke("cloud:getSettings"),
  saveCloudSyncSettings: (data: Partial<CloudSyncSettings>): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("cloud:saveSettings", data),
  syncNow: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("cloud:syncNow"),
  testCloudConnection: (serverUrl: string, apiKey: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("cloud:testConnection", serverUrl, apiKey),
} as const;

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
