import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type {
  POSState,
  POSAction,
  CartItem,
  Customer,
  Discount,
  Transaction,
  PaymentInfo,
  POSSettings,
  DiscountType,
} from "./types";

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_SETTINGS: POSSettings = {
  storeName: "متجر التبغ",
  storeAddress: "شارع الملك فهد، الرياض",
  storePhone: "+966 11 123 4567",
  taxRate: 5, // Direct tax rate for simpler usage
  taxConfig: {
    rate: 5,
    name: "ضريبة القيمة المضافة",
    isIncluded: false,
  },
  currency: "LE",
  currencySymbol: "ج.م",
  receiptFooter: "شكراً لزيارتكم - نتطلع لخدمتكم مجدداً",
  defaultPaymentMethod: "cash",
  allowNegativeStock: false,
  requireCustomer: false,
  printReceiptAutomatically: false,
  receiptPrinterName: "",
};

/**
 * Get tax rate from settings safely
 */
function getTaxRate(settings: POSSettings): number {
  return settings.taxRate ?? settings.taxConfig?.rate ?? 5;
}

const INITIAL_STATE: POSState = {
  cart: {
    items: [],
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    total: 0,
  },
  selectedCustomer: null,
  appliedDiscount: null,
  settings: DEFAULT_SETTINGS,
  isPaymentModalOpen: false,
  isCustomerModalOpen: false,
  isDiscountModalOpen: false,
  isReceiptModalOpen: false,
  isSettingsModalOpen: false,
  currentTransaction: null,
  isBarcodeListening: true,
  barcodeBuffer: "",
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateCartTotals(
  items: CartItem[],
  discount: Discount | null,
  taxRate: number,
): {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
} {
  // Calculate subtotal with item-level discounts
  const subtotal = items.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const itemDiscount = item.discount
      ? item.discountType === "percentage"
        ? itemTotal * (item.discount / 100)
        : item.discount * item.quantity
      : 0;
    return sum + (itemTotal - itemDiscount);
  }, 0);

  // Calculate cart-level discount
  let discountAmount = 0;
  if (discount) {
    if (discount.type === "percentage") {
      discountAmount = subtotal * (discount.value / 100);
      if (discount.maxDiscount) {
        discountAmount = Math.min(discountAmount, discount.maxDiscount);
      }
    } else {
      discountAmount = discount.value;
    }
  }

  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const total = afterDiscount + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

let _frontendReceiptCounter = 0;
function generateReceiptNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  _frontendReceiptCounter = (_frontendReceiptCounter + 1) % 1000;
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  const counter = _frontendReceiptCounter.toString().padStart(3, "0");
  return `INV-${dateStr}-${counter}${random}`;
}

// ============================================
// REDUCER
// ============================================

function posReducer(state: POSState, action: POSAction): POSState {
  switch (action.type) {
    case "ADD_TO_CART": {
      const existingIndex = state.cart.items.findIndex(
        (item) => item.productId === action.payload.productId,
      );

      let newItems: CartItem[];
      if (existingIndex >= 0) {
        newItems = state.cart.items.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item,
        );
      } else {
        newItems = [...state.cart.items, action.payload];
      }

      const totals = calculateCartTotals(
        newItems,
        state.appliedDiscount,
        getTaxRate(state.settings),
      );

      return {
        ...state,
        cart: {
          ...state.cart,
          items: newItems,
          ...totals,
        },
      };
    }

    case "REMOVE_FROM_CART": {
      const newItems = state.cart.items.filter(
        (item) => item.productId !== action.payload,
      );
      const totals = calculateCartTotals(
        newItems,
        state.appliedDiscount,
        getTaxRate(state.settings),
      );

      return {
        ...state,
        cart: {
          ...state.cart,
          items: newItems,
          ...totals,
        },
      };
    }

    case "UPDATE_QUANTITY": {
      const newItems = state.cart.items
        .map((item) =>
          item.productId === action.payload.productId
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item,
        )
        .filter((item) => item.quantity > 0);

      const totals = calculateCartTotals(
        newItems,
        state.appliedDiscount,
        getTaxRate(state.settings),
      );

      return {
        ...state,
        cart: {
          ...state.cart,
          items: newItems,
          ...totals,
        },
      };
    }

    case "UPDATE_ITEM_DISCOUNT": {
      const newItems = state.cart.items.map((item) =>
        item.productId === action.payload.productId
          ? {
              ...item,
              discount: action.payload.discount,
              discountType: action.payload.discountType,
            }
          : item,
      );

      const totals = calculateCartTotals(
        newItems,
        state.appliedDiscount,
        getTaxRate(state.settings),
      );

      return {
        ...state,
        cart: {
          ...state.cart,
          items: newItems,
          ...totals,
        },
      };
    }

    case "CLEAR_CART": {
      return {
        ...state,
        cart: {
          items: [],
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          total: 0,
        },
        selectedCustomer: null,
        appliedDiscount: null,
      };
    }

    case "SET_CUSTOMER": {
      return {
        ...state,
        selectedCustomer: action.payload,
        cart: {
          ...state.cart,
          customerId: action.payload?.id,
          customerName: action.payload?.name,
        },
      };
    }

    case "APPLY_DISCOUNT": {
      const totals = calculateCartTotals(
        state.cart.items,
        action.payload,
        getTaxRate(state.settings),
      );

      return {
        ...state,
        appliedDiscount: action.payload,
        cart: {
          ...state.cart,
          ...totals,
        },
      };
    }

    case "SET_CART_NOTE": {
      return {
        ...state,
        cart: {
          ...state.cart,
          note: action.payload,
        },
      };
    }

    case "UPDATE_SETTINGS": {
      const newSettings = { ...state.settings, ...action.payload };
      // Recalculate totals if tax rate changed
      const totals = calculateCartTotals(
        state.cart.items,
        state.appliedDiscount,
        getTaxRate(newSettings),
      );

      return {
        ...state,
        settings: newSettings,
        cart: {
          ...state.cart,
          ...totals,
        },
      };
    }

    case "OPEN_MODAL": {
      const modalKey =
        `is${action.payload.charAt(0).toUpperCase()}${action.payload.slice(1)}ModalOpen` as keyof POSState;
      return {
        ...state,
        [modalKey]: true,
      };
    }

    case "CLOSE_MODAL": {
      const modalKey =
        `is${action.payload.charAt(0).toUpperCase()}${action.payload.slice(1)}ModalOpen` as keyof POSState;
      return {
        ...state,
        [modalKey]: false,
      };
    }

    case "COMPLETE_TRANSACTION": {
      return {
        ...state,
        currentTransaction: action.payload,
        isPaymentModalOpen: false,
        isReceiptModalOpen: true,
      };
    }

    case "RESET_TRANSACTION": {
      return {
        ...state,
        cart: {
          items: [],
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          total: 0,
        },
        selectedCustomer: null,
        appliedDiscount: null,
        currentTransaction: null,
        isReceiptModalOpen: false,
      };
    }

    case "SET_BARCODE_LISTENING": {
      return {
        ...state,
        isBarcodeListening: action.payload,
      };
    }

    case "UPDATE_BARCODE_BUFFER": {
      return {
        ...state,
        barcodeBuffer: action.payload,
      };
    }

    case "CLEAR_BARCODE_BUFFER": {
      return {
        ...state,
        barcodeBuffer: "",
      };
    }

    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface POSContextValue {
  state: POSState;
  dispatch: React.Dispatch<POSAction>;
  // Cart actions
  addToCart: (item: Omit<CartItem, "discount" | "discountType">) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateItemDiscount: (
    productId: string,
    discount: number,
    discountType: DiscountType,
  ) => void;
  clearCart: () => void;
  // Customer actions
  setCustomer: (customer: Customer | null) => void;
  openCustomerModal: () => void;
  closeCustomerModal: () => void;
  // Discount actions
  applyDiscount: (discount: Discount | null) => void;
  openDiscountModal: () => void;
  closeDiscountModal: () => void;
  // Payment actions
  openPaymentModal: () => void;
  closePaymentModal: () => void;
  processPayment: (paymentInfo: PaymentInfo) => Transaction;
  // Receipt actions
  openReceiptModal: () => void;
  closeReceiptModal: () => void;
  resetTransaction: () => void;
  // Settings actions
  updateSettings: (settings: Partial<POSSettings>) => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  // Barcode actions
  handleBarcodeScanned: (barcode: string) => void;
  // Utility
  formatPrice: (amount: number) => string;
}

const POSContext = createContext<POSContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

const SETTINGS_STORAGE_KEY = "tobacco_pos_settings_v1";

function loadSettings(): POSSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

export function POSProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(posReducer, {
    ...INITIAL_STATE,
    settings: loadSettings(),
  });

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
  }, [state.settings]);

  // Format price with currency
  const formatPrice = useCallback(
    (amount: number): string => {
      return `${amount.toFixed(2)} ${state.settings.currency}`;
    },
    [state.settings.currency],
  );

  // Cart actions
  const addToCart = useCallback(
    (item: Omit<CartItem, "discount" | "discountType">) => {
      dispatch({
        type: "ADD_TO_CART",
        payload: { ...item, discount: 0, discountType: "percentage" },
      });
    },
    [],
  );

  const removeFromCart = useCallback((productId: string) => {
    dispatch({ type: "REMOVE_FROM_CART", payload: productId });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { productId, quantity } });
  }, []);

  const updateItemDiscount = useCallback(
    (productId: string, discount: number, discountType: DiscountType) => {
      dispatch({
        type: "UPDATE_ITEM_DISCOUNT",
        payload: { productId, discount, discountType },
      });
    },
    [],
  );

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
  }, []);

  // Customer actions
  const setCustomer = useCallback((customer: Customer | null) => {
    dispatch({ type: "SET_CUSTOMER", payload: customer });
  }, []);

  const openCustomerModal = useCallback(() => {
    dispatch({ type: "OPEN_MODAL", payload: "customer" });
  }, []);

  const closeCustomerModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL", payload: "customer" });
  }, []);

  // Discount actions
  const applyDiscount = useCallback((discount: Discount | null) => {
    dispatch({ type: "APPLY_DISCOUNT", payload: discount });
  }, []);

  const openDiscountModal = useCallback(() => {
    dispatch({ type: "OPEN_MODAL", payload: "discount" });
  }, []);

  const closeDiscountModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL", payload: "discount" });
  }, []);

  // Payment actions
  const openPaymentModal = useCallback(() => {
    dispatch({ type: "OPEN_MODAL", payload: "payment" });
  }, []);

  const closePaymentModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL", payload: "payment" });
  }, []);

  const processPayment = useCallback(
    (paymentInfo: PaymentInfo): Transaction => {
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        receiptNumber: generateReceiptNumber(),
        timestamp: new Date().toISOString(),
        items: [...state.cart.items],
        customerId: state.selectedCustomer?.id,
        customer: state.selectedCustomer ?? undefined,
        subtotal: state.cart.subtotal,
        taxRate: getTaxRate(state.settings),
        taxAmount: state.cart.taxAmount,
        discount: state.appliedDiscount ?? undefined,
        discountAmount: state.cart.discountAmount,
        total: state.cart.total,
        payment: paymentInfo,
        status: "completed",
        cashierId: "",
        cashierName: "",
        note: state.cart.note,
      };

      dispatch({ type: "COMPLETE_TRANSACTION", payload: transaction });
      return transaction;
    },
    [state.cart, state.selectedCustomer, state.appliedDiscount, state.settings],
  );

  // Receipt actions
  const openReceiptModal = useCallback(() => {
    dispatch({ type: "OPEN_MODAL", payload: "receipt" });
  }, []);

  const closeReceiptModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL", payload: "receipt" });
  }, []);

  const resetTransaction = useCallback(() => {
    dispatch({ type: "RESET_TRANSACTION" });
  }, []);

  // Settings actions
  const updateSettings = useCallback((settings: Partial<POSSettings>) => {
    dispatch({ type: "UPDATE_SETTINGS", payload: settings });
  }, []);

  const openSettingsModal = useCallback(() => {
    dispatch({ type: "OPEN_MODAL", payload: "settings" });
  }, []);

  const closeSettingsModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL", payload: "settings" });
  }, []);

  // Barcode handler
  const handleBarcodeScanned = useCallback(
    async (barcode: string) => {
      try {
        const { products } = await import("../../services/db");
        const product = await products.getByBarcode(barcode);
        if (product) {
          addToCart({
            productId: String(product.id),
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.image || "",
          });
        }
      } catch (err) {
        console.error("Barcode lookup failed:", err);
      }
    },
    [addToCart],
  );

  const value: POSContextValue = {
    state,
    dispatch,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateItemDiscount,
    clearCart,
    setCustomer,
    openCustomerModal,
    closeCustomerModal,
    applyDiscount,
    openDiscountModal,
    closeDiscountModal,
    openPaymentModal,
    closePaymentModal,
    processPayment,
    openReceiptModal,
    closeReceiptModal,
    resetTransaction,
    updateSettings,
    openSettingsModal,
    closeSettingsModal,
    handleBarcodeScanned,
    formatPrice,
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
}

// ============================================
// HOOK
// ============================================

export function usePOS() {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error("usePOS must be used within a POSProvider");
  }
  return context;
}
