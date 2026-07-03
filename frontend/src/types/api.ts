import { z } from 'zod';

export const StatusSchema = z.enum(['pending', 'completed', 'cancelled', 'processing', 'open', 'closed', 'in_progress', 'approved']);
export type Status = z.infer<typeof StatusSchema>;

export const PaymentMethodSchema = z.enum(['cash', 'card', 'check', 'online', 'mixed']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const SaleSchema = z.object({
  id: z.string(),
  receipt_number: z.string(),
  created_at: z.string(),
  customer_id: z.string().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  cashier_id: z.string(),
  cashier_name: z.string(),
  payment_method: z.string(),
  subtotal: z.number(),
  total: z.number(),
  tax_amount: z.number(),
  discount_amount: z.number(),
  discount_type: z.string(),
  discount_value: z.number(),
  increase_amount: z.number().optional(),
  amount_received: z.number(),
  change_given: z.number(),
  status: z.string(),
  note: z.string().optional().nullable(),
  reference: z.string().optional(),
  items: z.any().optional(),
});
export type Sale = z.infer<typeof SaleSchema>;

export const SalesListSchema = z.object({
  items: z.array(SaleSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});
export type SalesList = z.infer<typeof SalesListSchema>;

export const ReturnReasonSchema = z.enum(['damaged', 'wrong_item', 'customer_request', 'expired', 'other']);
export type ReturnReason = z.infer<typeof ReturnReasonSchema>;

export const ReturnSchema = z.object({
  id: z.string(),
  return_number: z.string(),
  created_at: z.string(),
  sale_id: z.string().optional().nullable(),
  product_id: z.string(),
  product_name: z.string(),
  quantity: z.number(),
  refund_amount: z.number(),
  reason: z.string(),
  status: z.string(),
  processed_by: z.string(),
  processed_by_id: z.string().optional(),
});
export type Return = z.infer<typeof ReturnSchema>;

export const ReturnsListSchema = z.object({
  items: z.array(ReturnSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});
export type ReturnsList = z.infer<typeof ReturnsListSchema>;

export const TransactionTypeSchema = z.enum(['sale', 'return', 'withdrawal', 'expense', 'deposit']);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TreasuryTransactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: z.string(),
  name: z.string(),
  amount: z.number(),
  user_id: z.string(),
  user_name: z.string(),
  source: z.string(),
});
export type TreasuryTransaction = z.infer<typeof TreasuryTransactionSchema>;



export const TreasurySchema = z.object({
  totalSales: z.number(),
  totalReturns: z.number(),
  totalWithdrawals: z.number(),
  totalExpenses: z.number(),
  currentCash: z.number(),
  operations: z.array(TreasuryTransactionSchema),
});
export type Treasury = z.infer<typeof TreasurySchema>;

export const ShiftSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userRole: z.string(),
  loginAt: z.string(),
  logoutAt: z.string().nullable(),
  startCash: z.number(),
  endCash: z.number().nullable(),
  status: z.string(),
  metrics: z.object({
    totalSales: z.number(),
    totalReturns: z.number(),
    totalExpenses: z.number(),
    totalWithdrawals: z.number(),
    operationCount: z.number(),
    netCash: z.number(),
  }),
});
export type Shift = z.infer<typeof ShiftSchema>;

export const ShiftsListSchema = z.object({
  items: z.array(ShiftSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});
export type ShiftsList = z.infer<typeof ShiftsListSchema>;

export const ReportKPISchema = z.object({
  grossSales: z.number(),
  totalRefunds: z.number(),
  netRevenue: z.number(),
  totalOrders: z.number(),
  soldUnits: z.number(),
  inventoryUnits: z.number(),
  inventoryValue: z.number(),
  totalCustomerDebt: z.number(),
  debtCustomersCount: z.number(),
});
export type ReportKPI = z.infer<typeof ReportKPISchema>;

export const TopProductSchema = z.object({
  key: z.string(),
  name: z.string(),
  category: z.string(),
  soldQty: z.number(),
  returnedQty: z.number(),
  salesAmount: z.number(),
  refundAmount: z.number(),
  netRevenue: z.number(),
});
export type TopProduct = z.infer<typeof TopProductSchema>;

export const DailySummarySchema = z.object({
  dateKey: z.string(),
  orders: z.number(),
  units: z.number(),
  grossSales: z.number(),
  refunds: z.number(),
  netRevenue: z.number(),
});
export type DailySummary = z.infer<typeof DailySummarySchema>;

export const ReportsSchema = z.object({
  grossSales: z.number(),
  totalRefunds: z.number(),
  netRevenue: z.number(),
  totalOrders: z.number(),
  soldUnits: z.number(),
  inventoryUnits: z.number(),
  inventoryValue: z.number(),
  totalCustomerDebt: z.number(),
  debtCustomersCount: z.number(),
  topProducts: z.array(TopProductSchema),
  dailyRows: z.array(DailySummarySchema),
});
export type Reports = z.infer<typeof ReportsSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional().nullable(),
  debt: z.number(),
  totalPurchases: z.number(),
  totalSpent: z.number(),
  created_at: z.string(),
  notes: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomersListSchema = z.object({
  items: z.array(CustomerSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});
export type CustomersList = z.infer<typeof CustomersListSchema>;

export const OverviewSchema = z.object({
  todaySales: z.number(),
  todayRevenue: z.number(),
  todayReturns: z.number(),
  totalProducts: z.number(),
  lowStockProducts: z.number(),
  totalCustomers: z.number(),
});
export type Overview = z.infer<typeof OverviewSchema>;

export const InventoryItemSchema = z.object({
  id: z.string(),
  productName: z.string(),
  barcode: z.string().optional(),
  category: z.string(),
  stock: z.number(),
  minStock: z.number(),
  unitPrice: z.number(),
  unitCost: z.number(),
  stockValue: z.number(),
  isLowStock: z.boolean(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;

export const InventorySummarySchema = z.object({
  totalProducts: z.number(),
  totalUnits: z.number(),
  inventoryValue: z.number(),
  lowStockCount: z.number(),
  items: z.array(InventoryItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});
export type InventorySummary = z.infer<typeof InventorySummarySchema>;

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const DateRangeFilterSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
});
export type DateRangeFilter = z.infer<typeof DateRangeFilterSchema>;

export type FilterOption = {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: any;
};
