/**
 * Global type declarations for the Electron preload bridge.
 *
 * The `electronAPI` object is exposed via contextBridge in electron/preload.ts.
 * All database CRUD operations are available through this typed interface.
 */

import type {
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
  Return,
  TreasuryOperation,
  TreasurySummary,
  POSSettings,
  CloudSyncSettings,
  DataScope,
  DataResetSummary,
  OperationsResetSummary,
  DataBackupResult,
  DataRestoreResult,
  UserActivityReport,
  UserShiftOperation,
  PrinterListResult,
  ReceiptPrintOptions,
  ReceiptPrintResult,
  PagedResult,
  ProductsListQuery,
  ProductsPagedResult,
  CustomersListQuery,
  CustomersPagedResult,
  SuppliersListQuery,
  SuppliersPagedResult,
  UsersListQuery,
  UsersPagedResult,
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
  AutoBackupStatus,
} from "../../electron/shared/types";

export {};

type ElectronPrintPageSizeMicrons = {
  width: number;
  height: number;
};

type ElectronPrintHtmlOptions = {
  printerName?: string;
  printerNameCandidates?: string[];
  pageSizeMicrons?: ElectronPrintPageSizeMicrons;
  silent?: boolean;
};

declare global {
  interface Window {
    electronAPI?: {
      // ---- App ----
      getVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      minimizeWindow: () => Promise<void>;
      toggleMaximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
      isWindowMaximized: () => Promise<boolean>;
      toggleFullscreenWindow: () => Promise<boolean>;
      isWindowFullscreen: () => Promise<boolean>;
      printHtml: (
        html: string,
        options?: ElectronPrintHtmlOptions,
      ) => Promise<boolean>;
      listPrinters: () => Promise<PrinterListResult>;
      printReceipt: (
        html: string,
        options?: ReceiptPrintOptions,
      ) => Promise<ReceiptPrintResult>;
      printTestReceipt: (
        options?: ReceiptPrintOptions,
      ) => Promise<ReceiptPrintResult>;

      // ---- Auth ----
      login: (email: string, password: string) => Promise<AuthResult>;
      logout: (userId: string, shiftId?: string) => Promise<boolean>;

      // ---- Users ----
      listUsers: () => Promise<User[]>;
      listUsersPaged: (query?: UsersListQuery) => Promise<UsersPagedResult>;
      getUserById: (id: string) => Promise<User | null>;
      getUserActivityById: (id: string) => Promise<UserActivityReport | null>;
      getUserShiftOperations: (
        shiftId: string,
      ) => Promise<UserShiftOperation[]>;
      createUser: (data: {
        fullName: string;
        email: string;
        password: string;
        role: string;
        pagePermissions?: string[];
      }) => Promise<User>;
      updateUser: (
        id: string,
        data: Record<string, unknown>,
      ) => Promise<User | null>;
      deleteUser: (id: string) => Promise<boolean>;

      // ---- Categories ----
      listCategories: () => Promise<Category[]>;
      getCategoryById: (id: string) => Promise<Category | null>;
      createCategory: (data: { name: string }) => Promise<Category>;
      updateCategory: (
        id: string,
        data: { name: string },
      ) => Promise<Category | null>;
      deleteCategory: (id: string) => Promise<boolean>;
      deleteAllCategories: () => Promise<number>;

      // ---- Products ----
      listProducts: (activeOnly?: boolean) => Promise<Product[]>;
      listProductsLite: (activeOnly?: boolean) => Promise<ProductLite[]>;
      listProductsPaged: (
        query?: ProductsListQuery,
      ) => Promise<ProductsPagedResult>;
      getProductById: (id: string) => Promise<Product | null>;
      getProductByBarcode: (barcode: string) => Promise<Product | null>;
      createProduct: (data: Record<string, unknown>) => Promise<Product>;
      updateProduct: (
        id: string,
        data: Record<string, unknown>,
      ) => Promise<Product | null>;
      deleteProduct: (id: string) => Promise<boolean>;
      deleteAllProducts: () => Promise<number>;

      // ---- Customers ----
      listCustomers: () => Promise<Customer[]>;
      listCustomersPaged: (
        query?: CustomersListQuery,
      ) => Promise<CustomersPagedResult>;
      getCustomerById: (id: string) => Promise<Customer | null>;
      createCustomer: (data: Record<string, unknown>) => Promise<Customer>;
      updateCustomer: (
        id: string,
        data: Record<string, unknown>,
      ) => Promise<Customer | null>;
      deleteCustomer: (id: string) => Promise<boolean>;
      deleteAllCustomers: () => Promise<number>;

      // ---- Suppliers ----
      listSuppliers: () => Promise<Supplier[]>;
      listSuppliersPaged: (
        query?: SuppliersListQuery,
      ) => Promise<SuppliersPagedResult>;
      getSupplierById: (id: string) => Promise<Supplier | null>;
      createSupplier: (data: Record<string, unknown>) => Promise<Supplier>;
      updateSupplier: (
        id: string,
        data: Record<string, unknown>,
      ) => Promise<Supplier | null>;
      deleteSupplier: (id: string) => Promise<boolean>;
      deleteAllSuppliers: () => Promise<number>;
      listSupplierOperations: (
        supplierId: string,
      ) => Promise<SupplierOperation[]>;
      createSupplierOperation: (
        data: CreateSupplierOperationInput,
      ) => Promise<SupplierOperationResult>;
      settleSupplierDebt: (
        data: SettleSupplierDebtInput,
      ) => Promise<SupplierOperationResult>;
      settleSupplierDebtAll: (
        supplierId: string,
        note?: string,
      ) => Promise<SupplierOperationResult>;

      // ---- Sales ----
      listSales: (query?: SalesListQuery) => Promise<Sale[]>;
      listSalesPaged: (query?: SalesListQuery) => Promise<PagedResult<Sale>>;
      listSalesTimelinePaged: (
        query?: SalesTimelineQuery,
      ) => Promise<PagedResult<SalesTimelineRow>>;
      getSaleById: (id: string) => Promise<Sale | null>;
      createSale: (data: Record<string, unknown>) => Promise<Sale>;
      updateSale: (
        id: string,
        data: Record<string, unknown>,
      ) => Promise<Sale | null>;
      updateSaleStatus: (id: string, status: string) => Promise<Sale | null>;
      refundSale: (data: SaleRefundInput) => Promise<SaleRefundResult>;
      deleteSale: (id: string) => Promise<boolean>;
      deleteAllSales: () => Promise<number>;

      // ---- Returns ----
      listReturns: (query?: ReturnsListQuery) => Promise<Return[]>;
      listReturnsPaged: (
        query?: ReturnsListQuery,
      ) => Promise<PagedResult<Return>>;
      getReturnById: (id: string) => Promise<Return | null>;
      createReturn: (data: Record<string, unknown>) => Promise<Return>;
      createReturnsBatch: (data: {
        entries: ReturnBatchEntryInput[];
      }) => Promise<Return[]>;
      updateReturnStatus: (
        id: string,
        status: string,
      ) => Promise<Return | null>;
      deleteReturn: (id: string) => Promise<boolean>;
      deleteAllReturns: () => Promise<number>;

      // ---- Treasury ----
      getTreasurySummary: () => Promise<TreasurySummary>;
      listTreasuryOps: () => Promise<TreasuryOperation[]>;
      createTreasuryOp: (
        data: Record<string, unknown>,
      ) => Promise<TreasuryOperation>;
      deleteTreasuryOp: (id: string) => Promise<boolean>;
      deleteAllTreasuryOps: () => Promise<number>;

      // ---- Reports ----
      getReportsNetRevenue: (
        query?: ReportsQuery,
      ) => Promise<ReportsNetRevenuePayload>;
      getReportsSummary: (
        query?: ReportsQuery,
      ) => Promise<ReportsSummaryPayload>;

      // ---- Settings ----
      getSettings: () => Promise<POSSettings>;
      updateSettings: (data: Record<string, unknown>) => Promise<POSSettings>;
      resetData: (scope: DataScope) => Promise<DataResetSummary>;
      resetOperations: () => Promise<OperationsResetSummary>;
      createAutoBackup: (scope?: DataScope) => Promise<DataBackupResult>;
      createBackup: (scope?: DataScope) => Promise<DataBackupResult>;
      restoreBackup: (scope?: DataScope) => Promise<DataRestoreResult>;
      getAutoBackupStatus: () => Promise<AutoBackupStatus>;

      // ---- Cloud Sync ----
      getCloudSyncSettings: () => Promise<CloudSyncSettings>;
      saveCloudSyncSettings: (
        data: Record<string, unknown>,
      ) => Promise<{ success: boolean }>;
      syncNow: () => Promise<{ success: boolean; error?: string }>;
      testCloudConnection: (
        serverUrl: string,
        apiKey: string,
      ) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
