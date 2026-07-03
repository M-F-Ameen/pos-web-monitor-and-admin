/**
 * Shared types used by both the Electron main process (database layer)
 * and the React renderer (UI). This is the single source of truth
 * for all data structures in the POS system.
 */

// ============================================
// USER & AUTH
// ============================================

export type UserRole = "admin" | "manager" | "cashier" | "pos";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  /** Optional per-user page access override (used for POS users). */
  pagePermissions: string[];
  isActive: boolean;
  createdAt: string;
}

/** Only used on the main-process side — never sent to renderer */
export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  shiftId?: string;
  error?: string;
}

export type UserShiftOperationType = "sale" | "return" | "withdraw" | "expense";

export interface UserShiftMetrics {
  totalSales: number;
  totalReturns: number;
  totalExpenses: number;
  totalWithdrawals: number;
  operationCount: number;
  netCash: number;
}

export interface UserShift {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  loginAt: string;
  logoutAt: string | null;
  startCash: number;
  endCash: number | null;
  status: "open" | "closed";
  metrics: UserShiftMetrics;
}

export interface UserShiftOperation {
  id: string;
  shiftId: string;
  type: UserShiftOperationType;
  reference: string;
  amount: number;
  createdAt: string;
  userId: string;
  userName: string;
}

export interface UsersListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface UsersPagedResult extends PagedResult<User> {
  adminsCount: number;
  totalCount: number;
}

export interface UserActivityReport {
  user: User;
  activeShift: UserShift | null;
  shifts: UserShift[];
  totals: UserShiftMetrics;
  shiftCount: number;
  currentCashNow: number;
}

// ============================================
// CATEGORY
// ============================================

export interface Category {
  id: string;
  name: string;
  image: string;
  createdAt: string;
}

// ============================================
// PRODUCT
// ============================================

export interface ProductsListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  activeOnly?: boolean;
  categoryId?: string;
}

export interface ProductsPagedResult extends PagedResult<Product> {
  totalValue: number;
  totalCount: number;
}

export interface ProductLite {
  id: string;
  name: string;
  productCode: string;
  barcode: string;
  categoryId: string;
  price: number;
  stock: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  size: string;
  brand: string;
  price: number;
  cost: number;
  originalPrice: number;
  productCode: string; // internal 5-digit code (different from barcode)
  barcode: string;
  categoryId: string;
  categoryName?: string; // joined from categories table
  stock: number;
  minStock: number;
  isActive: boolean;
  image: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CUSTOMER
// ============================================

export interface CustomersListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CustomersPagedResult extends PagedResult<Customer> {
  totalDebt: number;
  totalSpent: number;
  totalCount: number;
}

export interface Customer {
  id: string;
  customerId: string; // display ID (e.g. "C-0001")
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  debt: number;
  totalPurchases: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// SUPPLIER
// ============================================

export interface SuppliersListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface SuppliersPagedResult extends PagedResult<Supplier> {
  totalDebt: number;
  totalPaid: number;
  totalCount: number;
}

export interface Supplier {
  id: string;
  supplierCode: string; // display ID (e.g. "S-0001")
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  debt: number;
  totalPurchases: number;
  totalPaid: number;
  createdAt: string;
  updatedAt: string;
}

export type SupplierOperationType = "purchase" | "settlement";

export interface SupplierOperation {
  id: string;
  supplierId: string;
  type: SupplierOperationType;
  purchaseAmount: number;
  paidAmount: number;
  debtBefore: number;
  debtAfter: number;
  note: string;
  createdAt: string;
}

export interface CreateSupplierOperationInput {
  supplierId: string;
  purchaseAmount: number;
  paidAmount: number;
  note?: string;
}

export interface SettleSupplierDebtInput {
  supplierId: string;
  amount: number;
  note?: string;
}

export interface SupplierOperationResult {
  supplier: Supplier;
  operation: SupplierOperation;
}

// ============================================
// SALE & SALE ITEMS
// ============================================

export type PaymentMethod = "cash" | "card" | "wallet";
export type SaleStatus = "completed" | "voided" | "refunded";
export type ThemeMode = "dark" | "light";

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  discount: number;
  discountType: "percentage" | "fixed";
  subtotal: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  customerId: string | null;
  customerName: string;
  subtotal: number;
  increaseAmount: number;
  discountAmount: number;
  discountType: "percentage" | "fixed" | "";
  discountValue: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeGiven: number;
  reference: string;
  cashierId: string;
  cashierName: string;
  note: string;
  status: SaleStatus;
  items: SaleItem[];
  createdAt: string;
}

export interface SalesListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
  statuses?: SaleStatus[];
  includeItems?: boolean;
}

export interface SalesTimelineQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
  saleStatuses?: SaleStatus[];
  returnStatuses?: ReturnStatus[];
  includeSaleItems?: boolean;
  cashierId?: string;
}

// ============================================
// RETURN
// ============================================

export type ReturnStatus = "pending" | "approved" | "rejected";

export interface Return {
  id: string;
  returnNumber: string;
  saleId: string | null;
  productId: string;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason: string;
  status: ReturnStatus;
  processedById: string;
  processedBy: string;
  createdAt: string;
}

export interface ReturnsListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  fromDate?: string;
  toDate?: string;
  statuses?: ReturnStatus[];
  saleId?: string;
  productId?: string;
  processedById?: string;
}

export interface ReturnBatchEntryInput {
  saleId?: string;
  productId?: string;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason?: string;
  status?: ReturnStatus;
  processedById?: string;
  processedByName?: string;
  processedBy?: string;
}

export interface SaleRefundInput {
  saleId: string;
  reason?: string;
  processedById?: string;
  processedByName?: string;
}

export interface SaleRefundResult {
  sale: Sale;
  returns: Return[];
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type SalesTimelineRow =
  | {
      kind: "sale";
      id: string;
      createdAt: string;
      sale: Sale;
    }
  | {
      kind: "return";
      id: string;
      createdAt: string;
      returnRecord: Return;
    };

// ============================================
// TREASURY
// ============================================

export type ManualOperationType = "withdraw" | "expense";
export type TreasuryOperationType = "sale" | "return" | ManualOperationType;

export interface TreasuryOperation {
  id: string;
  type: ManualOperationType;
  name: string;
  amount: number;
  userId: string;
  user: string;
  date: string;
  createdAt: string;
}

export interface TreasurySummary {
  totalSales: number;
  totalReturns: number;
  totalWithdrawals: number;
  totalExpenses: number;
  currentCash: number;
  operations: TreasuryOperationRow[];
}

export interface TreasuryOperationRow {
  id: string;
  type: TreasuryOperationType;
  name: string;
  amount: number;
  userId: string;
  user: string;
  date: string;
  source: "system" | "manual";
}

// ============================================
// POS SETTINGS
// ============================================

export interface POSSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  taxRate: number;
  currency: string;
  currencySymbol: string;
  themeMode: ThemeMode;
  receiptFooter: string;
  defaultPaymentMethod: PaymentMethod;
  allowNegativeStock: boolean;
  requireCustomer: boolean;
  printReceiptAutomatically: boolean;
  receiptPrinterName: string;
  defaultProductImage: string;
}

export interface OperationsResetSummary {
  deletedSales: number;
  deletedReturns: number;
  deletedTreasuryOperations: number;
  resetCustomers: number;
  resetAt: string;
}

export type DataScope = "system" | "inventory" | "operations";

export interface DataResetSummary {
  scope: DataScope;
  affectedRows: Record<string, number>;
  resetAt: string;
  defaultsReseeded?: boolean;
}

export interface DataBackupResult {
  canceled: boolean;
  scope?: DataScope;
  backupPath?: string;
  fileSizeBytes?: number;
  checksumSha256?: string;
  createdAt?: string;
}

export interface DataRestoreResult {
  canceled: boolean;
  scope?: DataScope;
  sourcePath?: string;
  rollbackBackupPath?: string;
  restoredAt?: string;
  requiresReload?: boolean;
}

export interface AutoBackupStatus {
  enabled: boolean;
  intervalMs: number;
  backupDirectory: string;
  lastBackupAt: string | null;
  nextBackupAt: string | null;
}

// ============================================
// DASHBOARD / STATS
// ============================================

export interface DashboardStats {
  todaySales: number;
  todayRevenue: number;
  todayReturns: number;
  totalProducts: number;
  lowStockProducts: number;
  totalCustomers: number;
}

export interface ReportsQuery {
  fromDate?: string;
  toDate?: string;
  topProductsLimit?: number;
  lowStockLimit?: number;
  debtCustomersLimit?: number;
  dailyRowsLimit?: number;
}

export interface ReportsProductSummaryRow {
  key: string;
  name: string;
  category: string;
  soldQty: number;
  returnedQty: number;
  salesAmount: number;
  refundAmount: number;
  netRevenue: number;
}

export interface ReportsDailySummaryRow {
  dateKey: string;
  orders: number;
  units: number;
  grossSales: number;
  refunds: number;
  netRevenue: number;
}

export interface ReportsDebtCustomerRow {
  id: string;
  name: string;
  phone: string;
  totalPurchases: number;
  totalSpent: number;
  debt: number;
  debtRatio: number;
}

export interface ReportsLowStockRow {
  id: string;
  name: string;
  categoryName: string;
  stock: number;
  alertThreshold: number;
  stockValue: number;
}

export interface ReportsSummaryPayload {
  grossSales: number;
  totalRefunds: number;
  netRevenue: number;
  totalOrders: number;
  soldUnits: number;
  inventoryUnits: number;
  inventoryValue: number;
  totalCustomerDebt: number;
  debtCustomersCount: number;
  topProducts: ReportsProductSummaryRow[];
  lowStockProducts: ReportsLowStockRow[];
  debtCustomers: ReportsDebtCustomerRow[];
  dailyRows: ReportsDailySummaryRow[];
}

export interface ReportsNetRevenuePayload {
  grossSales: number;
  totalRefunds: number;
  netRevenue: number;
}

// ============================================
// PRINTERS / PRINTING
// ============================================

export interface InstalledPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

export type ReceiptPrinterSource =
  | "user-override"
  | "xp-80c"
  | "default"
  | "none";

export interface ReceiptPrintResult {
  success: boolean;
  printerName: string | null;
  source: ReceiptPrinterSource;
  usedFallback: boolean;
  warning?: string;
  error?: string;
}

export interface PrinterListResult {
  printers: InstalledPrinter[];
  userOverride: string | null;
  recommendedPrinterName: string | null;
  selectedPrinterName: string | null;
  defaultPrinterName: string | null;
  xp80cAvailable: boolean;
}

export interface ReceiptPrintOptions {
  preferredPrinterName?: string;
  fallbackToDefault?: boolean;
}
