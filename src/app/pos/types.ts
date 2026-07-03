/**
 * POS Types - Core data structures for the POS system
 * These types will be used consistently throughout the application
 * and will map to backend API responses later.
 */

// ============================================
// PRODUCT TYPES
// ============================================

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  category: string;
  barcode?: string;
  sku?: string;
  image?: string;
  stock?: number;
  isActive?: boolean;
}

// ============================================
// CART TYPES
// ============================================

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  discount?: number; // Percentage or fixed amount
  discountType?: "percentage" | "fixed";
  category?: string;
  image?: string;
  note?: string;
}

export interface Cart {
  items: CartItem[];
  customerId?: string;
  customerName?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  note?: string;
}

// ============================================
// CUSTOMER TYPES
// ============================================

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalPurchases?: number;
  totalSpent?: number;
  lastPurchaseDate?: string;
  createdAt?: string;
}

// ============================================
// PAYMENT TYPES
// ============================================

export type PaymentMethod = "cash" | "card" | "wallet";

export interface PaymentInfo {
  method: PaymentMethod;
  amount: number;
  received?: number; // For cash payments
  change?: number; // For cash payments
  reference?: string; // For card/wallet transactions
}

// ============================================
// TRANSACTION/RECEIPT TYPES
// ============================================

export type TransactionStatus = "pending" | "completed" | "voided" | "refunded";

export interface Transaction {
  id: string;
  receiptNumber?: string;
  timestamp: string; // ISO date string
  items: CartItem[];
  customerId?: string;
  customer?: Customer;
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  discount?: Discount;
  discountAmount?: number;
  total: number;
  payment: PaymentInfo;
  status?: TransactionStatus;
  cashierId?: string;
  cashierName?: string;
  note?: string;
}

// ============================================
// DISCOUNT TYPES
// ============================================

export type DiscountType = "percentage" | "fixed";
export type DiscountTarget = "cart" | "item";

export interface Discount {
  id?: string;
  name?: string;
  type: DiscountType;
  value: number;
  reason?: string;
  target?: DiscountTarget;
  minPurchase?: number;
  maxDiscount?: number;
  isActive?: boolean;
}

// ============================================
// SETTINGS TYPES
// ============================================

export interface TaxConfig {
  rate: number; // Percentage (e.g., 5 for 5%)
  name: string; // e.g., "VAT", "Sales Tax"
  isIncluded: boolean; // Whether tax is included in prices
}

export interface POSSettings {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  taxRate?: number; // Direct tax rate percentage for simpler usage
  taxConfig?: TaxConfig;
  currency: string;
  currencySymbol?: string;
  receiptFooter?: string;
  defaultPaymentMethod?: PaymentMethod;
  allowNegativeStock?: boolean;
  requireCustomer?: boolean;
  printReceiptAutomatically?: boolean;
  enableBarcode?: boolean;
  receiptPrinterName?: string;
}

// ============================================
// STATE TYPES
// ============================================

export interface POSState {
  // Cart state
  cart: Cart;
  // Selected customer
  selectedCustomer: Customer | null;
  // Applied discount
  appliedDiscount: Discount | null;
  // Settings
  settings: POSSettings;
  // UI state
  isPaymentModalOpen: boolean;
  isCustomerModalOpen: boolean;
  isDiscountModalOpen: boolean;
  isReceiptModalOpen: boolean;
  isSettingsModalOpen: boolean;
  // Current transaction (after payment)
  currentTransaction: Transaction | null;
  // Barcode scanning
  isBarcodeListening: boolean;
  barcodeBuffer: string;
}

// ============================================
// ACTION TYPES
// ============================================

export type POSAction =
  | { type: "ADD_TO_CART"; payload: CartItem }
  | { type: "REMOVE_FROM_CART"; payload: string } // productId
  | {
      type: "UPDATE_QUANTITY";
      payload: { productId: string; quantity: number };
    }
  | {
      type: "UPDATE_ITEM_DISCOUNT";
      payload: {
        productId: string;
        discount: number;
        discountType: DiscountType;
      };
    }
  | { type: "CLEAR_CART" }
  | { type: "SET_CUSTOMER"; payload: Customer | null }
  | { type: "APPLY_DISCOUNT"; payload: Discount | null }
  | { type: "SET_CART_NOTE"; payload: string }
  | { type: "UPDATE_SETTINGS"; payload: Partial<POSSettings> }
  | {
      type: "OPEN_MODAL";
      payload: "payment" | "customer" | "discount" | "receipt" | "settings";
    }
  | {
      type: "CLOSE_MODAL";
      payload: "payment" | "customer" | "discount" | "receipt" | "settings";
    }
  | { type: "COMPLETE_TRANSACTION"; payload: Transaction }
  | { type: "RESET_TRANSACTION" }
  | { type: "SET_BARCODE_LISTENING"; payload: boolean }
  | { type: "UPDATE_BARCODE_BUFFER"; payload: string }
  | { type: "CLEAR_BARCODE_BUFFER" };
