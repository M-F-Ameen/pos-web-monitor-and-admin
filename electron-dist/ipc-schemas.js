"use strict";
/**
 * Zod schemas for runtime validation of IPC arguments.
 * Every mutation channel validates its arguments before forwarding
 * to service functions, preventing malformed/malicious data.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PagedQuerySchema = exports.ScopedDataSchema = exports.DataScopeSchema = exports.UpdateSettingsSchema = exports.TreasuryOpIdSchema = exports.CreateTreasuryOpSchema = exports.UpdateReturnStatusSchema = exports.CreateReturnsBatchSchema = exports.CreateReturnSchema = exports.ReturnIdSchema = exports.RefundSaleSchema = exports.UpdateSaleStatusSchema = exports.UpdateSaleSchema = exports.CreateSaleSchema = exports.SaleIdSchema = exports.SettleSupplierDebtAllSchema = exports.SettleSupplierDebtSchema = exports.CreateSupplierOperationSchema = exports.UpdateSupplierSchema = exports.CreateSupplierSchema = exports.SupplierIdSchema = exports.UpdateCustomerSchema = exports.CreateCustomerSchema = exports.CustomerIdSchema = exports.UpdateProductSchema = exports.CreateProductSchema = exports.ProductBarcodeSchema = exports.ProductIdSchema = exports.UpdateCategorySchema = exports.CreateCategorySchema = exports.CategoryIdSchema = exports.UpdateUserSchema = exports.CreateUserSchema = exports.UserIdSchema = exports.AuthLogoutSchema = exports.AuthLoginSchema = void 0;
const zod_1 = require("zod");
// ============================================
// Helpers
// ============================================
const nonEmptyString = zod_1.z.string().min(1);
const optionalString = zod_1.z.string().optional();
const id = nonEmptyString;
// ============================================
// Auth
// ============================================
exports.AuthLoginSchema = zod_1.z.tuple([
    nonEmptyString, // email
    nonEmptyString, // password
]);
exports.AuthLogoutSchema = zod_1.z.tuple([
    nonEmptyString, // userId
    zod_1.z.string().or(zod_1.z.undefined()), // shiftId
]);
// ============================================
// Users
// ============================================
exports.UserIdSchema = zod_1.z.tuple([id]);
exports.CreateUserSchema = zod_1.z.tuple([
    zod_1.z.object({
        fullName: nonEmptyString,
        email: nonEmptyString,
        password: nonEmptyString,
        role: zod_1.z.enum(["admin", "manager", "cashier", "pos"]),
        pagePermissions: zod_1.z.array(zod_1.z.string()).optional(),
    }),
]);
exports.UpdateUserSchema = zod_1.z.tuple([
    id, // id
    zod_1.z.object({
        fullName: optionalString,
        email: optionalString,
        password: optionalString,
        role: zod_1.z.enum(["admin", "manager", "cashier", "pos"]).optional(),
        pagePermissions: zod_1.z.array(zod_1.z.string()).optional(),
    }),
]);
// ============================================
// Categories
// ============================================
exports.CategoryIdSchema = zod_1.z.tuple([id]);
exports.CreateCategorySchema = zod_1.z.tuple([
    zod_1.z.object({
        name: nonEmptyString,
        image: zod_1.z.string().optional(),
    }),
]);
exports.UpdateCategorySchema = zod_1.z.tuple([
    id,
    zod_1.z.object({
        name: nonEmptyString,
        image: zod_1.z.string().optional(),
    }),
]);
// ============================================
// Products
// ============================================
exports.ProductIdSchema = zod_1.z.tuple([id]);
exports.ProductBarcodeSchema = zod_1.z.tuple([zod_1.z.string()]);
exports.CreateProductSchema = zod_1.z.tuple([
    zod_1.z.object({
        name: nonEmptyString,
        description: zod_1.z.string().optional(),
        size: zod_1.z.string().optional(),
        brand: zod_1.z.string().optional(),
        price: zod_1.z.number().min(0),
        cost: zod_1.z.number().min(0).optional(),
        originalPrice: zod_1.z.number().min(0).optional(),
        barcode: zod_1.z.string().optional(),
        categoryId: zod_1.z.string().optional(),
        stock: zod_1.z.number().int().optional(),
        minStock: zod_1.z.number().int().min(0).optional(),
        isActive: zod_1.z.boolean().optional(),
        image: zod_1.z.string().optional(),
    }),
]);
exports.UpdateProductSchema = zod_1.z.tuple([
    id,
    zod_1.z.object({
        name: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        size: zod_1.z.string().optional(),
        brand: zod_1.z.string().optional(),
        price: zod_1.z.number().min(0).optional(),
        cost: zod_1.z.number().min(0).optional(),
        originalPrice: zod_1.z.number().min(0).optional(),
        barcode: zod_1.z.string().optional(),
        categoryId: zod_1.z.string().optional(),
        stock: zod_1.z.number().int().optional(),
        minStock: zod_1.z.number().int().min(0).optional(),
        isActive: zod_1.z.boolean().optional(),
        image: zod_1.z.string().optional(),
    }),
]);
// ============================================
// Customers
// ============================================
exports.CustomerIdSchema = zod_1.z.tuple([id]);
exports.CreateCustomerSchema = zod_1.z.tuple([
    zod_1.z.object({
        customerId: zod_1.z.string().optional(),
        name: nonEmptyString,
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        debt: zod_1.z.number().min(0).optional(),
    }),
]);
exports.UpdateCustomerSchema = zod_1.z.tuple([
    id,
    zod_1.z.object({
        customerId: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        debt: zod_1.z.number().min(0).optional(),
    }),
]);
// ============================================
// Suppliers
// ============================================
exports.SupplierIdSchema = zod_1.z.tuple([id]);
exports.CreateSupplierSchema = zod_1.z.tuple([
    zod_1.z.object({
        supplierCode: zod_1.z.string().optional(),
        name: nonEmptyString,
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        debt: zod_1.z.number().min(0).optional(),
        totalPurchases: zod_1.z.number().int().min(0).optional(),
        totalPaid: zod_1.z.number().min(0).optional(),
    }),
]);
exports.UpdateSupplierSchema = zod_1.z.tuple([
    id,
    zod_1.z.object({
        supplierCode: zod_1.z.string().optional(),
        name: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
        debt: zod_1.z.number().min(0).optional(),
        totalPurchases: zod_1.z.number().int().min(0).optional(),
        totalPaid: zod_1.z.number().min(0).optional(),
    }),
]);
exports.CreateSupplierOperationSchema = zod_1.z.tuple([
    zod_1.z
        .object({
        supplierId: nonEmptyString,
        purchaseAmount: zod_1.z.number().positive(),
        paidAmount: zod_1.z.number().min(0),
        note: zod_1.z.string().optional(),
    })
        .refine((value) => value.paidAmount <= value.purchaseAmount, {
        message: "paidAmount must be less than or equal to purchaseAmount",
        path: ["paidAmount"],
    }),
]);
exports.SettleSupplierDebtSchema = zod_1.z.tuple([
    zod_1.z.object({
        supplierId: nonEmptyString,
        amount: zod_1.z.number().positive(),
        note: zod_1.z.string().optional(),
    }),
]);
exports.SettleSupplierDebtAllSchema = zod_1.z.tuple([
    id,
    zod_1.z.union([zod_1.z.string(), zod_1.z.undefined()]),
]);
// ============================================
// Sales
// ============================================
exports.SaleIdSchema = zod_1.z.tuple([id]);
const SaleItemSchema = zod_1.z.object({
    productId: nonEmptyString,
    productName: nonEmptyString,
    price: zod_1.z.number().min(0),
    quantity: zod_1.z.number().int().min(1),
    subtotal: zod_1.z.number().min(0),
    discount: zod_1.z.number().min(0).optional(),
    discountType: zod_1.z.string().optional(),
});
exports.CreateSaleSchema = zod_1.z.tuple([
    zod_1.z.object({
        receiptNumber: zod_1.z.string().optional(),
        customerId: zod_1.z
            .string()
            .nullable()
            .optional()
            .transform((v) => v ?? undefined),
        customerName: zod_1.z.string().optional(),
        subtotal: zod_1.z.number().min(0),
        increaseAmount: zod_1.z.number().min(0).optional(),
        discountAmount: zod_1.z.number().min(0),
        discountType: zod_1.z.string().optional(),
        discountValue: zod_1.z.number().min(0).optional(),
        taxRate: zod_1.z.number().min(0),
        taxAmount: zod_1.z.number().min(0),
        total: zod_1.z.number().min(0),
        paymentMethod: zod_1.z.enum(["cash", "card", "wallet"]).optional(),
        amountReceived: zod_1.z.number().min(0).optional(),
        changeGiven: zod_1.z.number().min(0).optional(),
        reference: zod_1.z.string().optional(),
        cashierId: zod_1.z.string().optional(),
        cashierName: zod_1.z.string().optional(),
        note: zod_1.z.string().optional(),
        items: zod_1.z.array(SaleItemSchema).min(1),
        allowNegativeStock: zod_1.z.boolean().optional(),
    }),
]);
exports.UpdateSaleSchema = zod_1.z.tuple([
    id,
    zod_1.z.object({
        receiptNumber: zod_1.z.string().optional(),
        customerName: zod_1.z.string().optional(),
        total: zod_1.z.number().min(0).optional(),
        subtotal: zod_1.z.number().min(0).optional(),
        paymentMethod: zod_1.z.enum(["cash", "card", "wallet"]).optional(),
        note: zod_1.z.string().optional(),
    }),
]);
exports.UpdateSaleStatusSchema = zod_1.z.tuple([
    id,
    zod_1.z.enum(["completed", "voided", "refunded"]),
]);
exports.RefundSaleSchema = zod_1.z.tuple([
    zod_1.z.object({
        saleId: nonEmptyString,
        reason: zod_1.z.string().optional(),
        processedById: zod_1.z.string().optional(),
        processedByName: zod_1.z.string().optional(),
    }),
]);
// ============================================
// Returns
// ============================================
exports.ReturnIdSchema = zod_1.z.tuple([id]);
exports.CreateReturnSchema = zod_1.z.tuple([
    zod_1.z.object({
        returnNumber: zod_1.z.string().optional(),
        saleId: zod_1.z
            .string()
            .nullable()
            .optional()
            .transform((v) => v ?? undefined),
        productId: zod_1.z.string().optional(),
        productName: nonEmptyString,
        quantity: zod_1.z.number().int().min(1),
        refundAmount: zod_1.z.number().min(0),
        reason: zod_1.z.string().optional(),
        status: zod_1.z.enum(["pending", "approved", "rejected"]).optional(),
        processedById: zod_1.z.string().optional(),
        processedByName: zod_1.z.string().optional(),
    }),
]);
exports.CreateReturnsBatchSchema = zod_1.z.tuple([
    zod_1.z.object({
        entries: zod_1.z.array(zod_1.z.object({
            saleId: zod_1.z.string().optional(),
            productId: zod_1.z.string().optional(),
            productName: nonEmptyString,
            quantity: zod_1.z.number().int().min(1),
            refundAmount: zod_1.z.number().min(0),
            reason: zod_1.z.string().optional(),
            status: zod_1.z.enum(["pending", "approved", "rejected"]).optional(),
            processedById: zod_1.z.string().optional(),
            processedByName: zod_1.z.string().optional(),
            processedBy: zod_1.z.string().optional(),
        })),
    }),
]);
exports.UpdateReturnStatusSchema = zod_1.z.tuple([
    id,
    zod_1.z.enum(["pending", "approved", "rejected"]),
]);
// ============================================
// Treasury
// ============================================
exports.CreateTreasuryOpSchema = zod_1.z.tuple([
    zod_1.z.object({
        type: zod_1.z.enum(["withdraw", "expense"]),
        name: nonEmptyString,
        amount: zod_1.z.number().positive(),
        userId: zod_1.z.string().optional(),
        user: zod_1.z.string().optional(),
        date: nonEmptyString,
    }),
]);
exports.TreasuryOpIdSchema = zod_1.z.tuple([id]);
// ============================================
// Settings
// ============================================
exports.UpdateSettingsSchema = zod_1.z.tuple([
    zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
]);
exports.DataScopeSchema = zod_1.z.enum(["system", "inventory", "operations"]);
exports.ScopedDataSchema = zod_1.z.tuple([exports.DataScopeSchema]);
// ============================================
// Paged query schemas (read operations)
// ============================================
exports.PagedQuerySchema = zod_1.z.tuple([
    zod_1.z
        .object({
        page: zod_1.z.number().int().min(1).optional(),
        pageSize: zod_1.z.number().int().min(1).max(100).optional(),
        search: zod_1.z.string().optional(),
    })
        .passthrough()
        .or(zod_1.z.undefined()),
]);
