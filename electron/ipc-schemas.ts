/**
 * Zod schemas for runtime validation of IPC arguments.
 * Every mutation channel validates its arguments before forwarding
 * to service functions, preventing malformed/malicious data.
 */

import { z } from "zod";

// ============================================
// Helpers
// ============================================

const nonEmptyString = z.string().min(1);
const optionalString = z.string().optional();
const id = nonEmptyString;

// ============================================
// Auth
// ============================================

export const AuthLoginSchema = z.tuple([
  nonEmptyString, // email
  nonEmptyString, // password
]);

export const AuthLogoutSchema = z.tuple([
  nonEmptyString, // userId
  z.string().or(z.undefined()), // shiftId
]);

// ============================================
// Users
// ============================================

export const UserIdSchema = z.tuple([id]);

export const CreateUserSchema = z.tuple([
  z.object({
    fullName: nonEmptyString,
    email: nonEmptyString,
    password: nonEmptyString,
    role: z.enum(["admin", "manager", "cashier", "pos"]),
    pagePermissions: z.array(z.string()).optional(),
  }),
]);

export const UpdateUserSchema = z.tuple([
  id, // id
  z.object({
    fullName: optionalString,
    email: optionalString,
    password: optionalString,
    role: z.enum(["admin", "manager", "cashier", "pos"]).optional(),
    pagePermissions: z.array(z.string()).optional(),
  }),
]);

// ============================================
// Categories
// ============================================

export const CategoryIdSchema = z.tuple([id]);

export const CreateCategorySchema = z.tuple([
  z.object({
    name: nonEmptyString,
    image: z.string().optional(),
  }),
]);

export const UpdateCategorySchema = z.tuple([
  id,
  z.object({
    name: nonEmptyString,
    image: z.string().optional(),
  }),
]);

// ============================================
// Products
// ============================================

export const ProductIdSchema = z.tuple([id]);
export const ProductBarcodeSchema = z.tuple([z.string()]);

export const CreateProductSchema = z.tuple([
  z.object({
    name: nonEmptyString,
    description: z.string().optional(),
    size: z.string().optional(),
    brand: z.string().optional(),
    price: z.number().min(0),
    cost: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    barcode: z.string().optional(),
    categoryId: z.string().optional(),
    stock: z.number().int().optional(),
    minStock: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    image: z.string().optional(),
  }),
]);

export const UpdateProductSchema = z.tuple([
  id,
  z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    size: z.string().optional(),
    brand: z.string().optional(),
    price: z.number().min(0).optional(),
    cost: z.number().min(0).optional(),
    originalPrice: z.number().min(0).optional(),
    barcode: z.string().optional(),
    categoryId: z.string().optional(),
    stock: z.number().int().optional(),
    minStock: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    image: z.string().optional(),
  }),
]);

// ============================================
// Customers
// ============================================

export const CustomerIdSchema = z.tuple([id]);

export const CreateCustomerSchema = z.tuple([
  z.object({
    customerId: z.string().optional(),
    name: nonEmptyString,
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    debt: z.number().min(0).optional(),
  }),
]);

export const UpdateCustomerSchema = z.tuple([
  id,
  z.object({
    customerId: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    debt: z.number().min(0).optional(),
  }),
]);

// ============================================
// Suppliers
// ============================================

export const SupplierIdSchema = z.tuple([id]);

export const CreateSupplierSchema = z.tuple([
  z.object({
    supplierCode: z.string().optional(),
    name: nonEmptyString,
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    debt: z.number().min(0).optional(),
    totalPurchases: z.number().int().min(0).optional(),
    totalPaid: z.number().min(0).optional(),
  }),
]);

export const UpdateSupplierSchema = z.tuple([
  id,
  z.object({
    supplierCode: z.string().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    notes: z.string().optional(),
    debt: z.number().min(0).optional(),
    totalPurchases: z.number().int().min(0).optional(),
    totalPaid: z.number().min(0).optional(),
  }),
]);

export const CreateSupplierOperationSchema = z.tuple([
  z
    .object({
      supplierId: nonEmptyString,
      purchaseAmount: z.number().positive(),
      paidAmount: z.number().min(0),
      note: z.string().optional(),
    })
    .refine((value) => value.paidAmount <= value.purchaseAmount, {
      message: "paidAmount must be less than or equal to purchaseAmount",
      path: ["paidAmount"],
    }),
]);

export const SettleSupplierDebtSchema = z.tuple([
  z.object({
    supplierId: nonEmptyString,
    amount: z.number().positive(),
    note: z.string().optional(),
  }),
]);

export const SettleSupplierDebtAllSchema = z.tuple([
  id,
  z.union([z.string(), z.undefined()]),
]);

// ============================================
// Sales
// ============================================

export const SaleIdSchema = z.tuple([id]);

const SaleItemSchema = z.object({
  productId: nonEmptyString,
  productName: nonEmptyString,
  price: z.number().min(0),
  quantity: z.number().int().min(1),
  subtotal: z.number().min(0),
  discount: z.number().min(0).optional(),
  discountType: z.string().optional(),
});

export const CreateSaleSchema = z.tuple([
  z.object({
    receiptNumber: z.string().optional(),
    customerId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
    customerName: z.string().optional(),
    subtotal: z.number().min(0),
    increaseAmount: z.number().min(0).optional(),
    discountAmount: z.number().min(0),
    discountType: z.string().optional(),
    discountValue: z.number().min(0).optional(),
    taxRate: z.number().min(0),
    taxAmount: z.number().min(0),
    total: z.number().min(0),
    paymentMethod: z.enum(["cash", "card", "wallet"]).optional(),
    amountReceived: z.number().min(0).optional(),
    changeGiven: z.number().min(0).optional(),
    reference: z.string().optional(),
    cashierId: z.string().optional(),
    cashierName: z.string().optional(),
    note: z.string().optional(),
    items: z.array(SaleItemSchema).min(1),
    allowNegativeStock: z.boolean().optional(),
  }),
]);

export const UpdateSaleSchema = z.tuple([
  id,
  z.object({
    receiptNumber: z.string().optional(),
    customerName: z.string().optional(),
    total: z.number().min(0).optional(),
    subtotal: z.number().min(0).optional(),
    paymentMethod: z.enum(["cash", "card", "wallet"]).optional(),
    note: z.string().optional(),
  }),
]);

export const UpdateSaleStatusSchema = z.tuple([
  id,
  z.enum(["completed", "voided", "refunded"]),
]);

export const RefundSaleSchema = z.tuple([
  z.object({
    saleId: nonEmptyString,
    reason: z.string().optional(),
    processedById: z.string().optional(),
    processedByName: z.string().optional(),
  }),
]);

// ============================================
// Returns
// ============================================

export const ReturnIdSchema = z.tuple([id]);

export const CreateReturnSchema = z.tuple([
  z.object({
    returnNumber: z.string().optional(),
    saleId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? undefined),
    productId: z.string().optional(),
    productName: nonEmptyString,
    quantity: z.number().int().min(1),
    refundAmount: z.number().min(0),
    reason: z.string().optional(),
    status: z.enum(["pending", "approved", "rejected"]).optional(),
    processedById: z.string().optional(),
    processedByName: z.string().optional(),
  }),
]);

export const CreateReturnsBatchSchema = z.tuple([
  z.object({
    entries: z.array(
      z.object({
        saleId: z.string().optional(),
        productId: z.string().optional(),
        productName: nonEmptyString,
        quantity: z.number().int().min(1),
        refundAmount: z.number().min(0),
        reason: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected"]).optional(),
        processedById: z.string().optional(),
        processedByName: z.string().optional(),
        processedBy: z.string().optional(),
      }),
    ),
  }),
]);

export const UpdateReturnStatusSchema = z.tuple([
  id,
  z.enum(["pending", "approved", "rejected"]),
]);

// ============================================
// Treasury
// ============================================

export const CreateTreasuryOpSchema = z.tuple([
  z.object({
    type: z.enum(["withdraw", "expense"]),
    name: nonEmptyString,
    amount: z.number().positive(),
    userId: z.string().optional(),
    user: z.string().optional(),
    date: nonEmptyString,
  }),
]);

export const TreasuryOpIdSchema = z.tuple([id]);

// ============================================
// Settings
// ============================================

export const UpdateSettingsSchema = z.tuple([
  z.record(z.string(), z.unknown()),
]);

export const DataScopeSchema = z.enum(["system", "inventory", "operations"]);
export const ScopedDataSchema = z.tuple([DataScopeSchema]);

// ============================================
// Paged query schemas (read operations)
// ============================================

export const PagedQuerySchema = z.tuple([
  z
    .object({
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      search: z.string().optional(),
    })
    .passthrough()
    .or(z.undefined()),
]);
