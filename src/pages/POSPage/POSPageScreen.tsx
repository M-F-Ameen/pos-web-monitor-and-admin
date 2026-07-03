import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { isAppPage } from "../../app/access";
import { buildSidebarNavItems } from "../../app/appSidebarNav";
import { useAuth } from "../../app/AuthContext";
import type {
  Customer,
  Discount,
  PaymentInfo,
  Transaction,
  POSSettings,
} from "../../app/pos/types";
import { useDefaultImage } from "../../app/DefaultImageContext";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { OrderPanel } from "../../components/layout/OrderPanel";
import type { OrderType } from "../../components/layout/OrderPanel";
import { CategoryChip } from "../../components/pos/CategoryChip";
import type { CartItemProps } from "../../components/pos/CartItem";
import { ProductCard } from "../../components/pos/ProductCard";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import {
  products as productsService,
  categories as categoriesService,
  customers as customersService,
  sales as salesService,
  returns as returnsService,
  settings as settingsService,
  type ReceiptPrintResult,
  type Product as DBProduct,
  type Category as DBCategory,
} from "../../services/db";
import { printTransactionReceipt } from "../../services/receiptPrinter";
import { POSPageOverlays } from "./POSPageOverlays";
import {
  POS_DISPLAY_CURRENCY,
  DEFAULT_POS_SETTINGS,
  allocateDiscountAcrossLineSubtotals,
  calculateDiscountAmount,
  formatPrice,
  generateTransactionId,
  getPriceIncreaseValue,
  getProductsPerPage,
  getUnitPriceWithIncrease,
  mapDbCustomerToPosCustomer,
  normalizeBarcodeValue,
  parsePrice,
  playSaleSuccessTone,
  roundToMoney,
  westernToArabic,
} from "./posPage.utils";
import "./POSPage.css";


export function POSPage() {
  const navigate = useNavigate();
  const { role, user: authUser, logout } = useAuth();
  const defaultImage = useDefaultImage();
  const [productSearchValue, setProductSearchValue] = useState("");
  const [debouncedProductSearchValue, setDebouncedProductSearchValue] =
    useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentProductsPage, setCurrentProductsPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(() =>
    typeof window !== "undefined" ? getProductsPerPage(window.innerWidth) : 21,
  );
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [cartItems, setCartItems] = useState<CartItemProps[]>([]);
  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(null);
  const [barcodeInputValue, setBarcodeInputValue] = useState("");
  const [barcodeError, setBarcodeError] = useState("");
  const [barcodeSuccessMessage, setBarcodeSuccessMessage] = useState("");
  const [barcodeSuccessPing, setBarcodeSuccessPing] = useState(0);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeFeedbackTimerRef = useRef<number | null>(null);
  const [showSaleSuccessPopup, setShowSaleSuccessPopup] = useState(false);
  const [saleSuccessPopupKey, setSaleSuccessPopupKey] = useState(0);
  const [showReturnSuccessPopup, setShowReturnSuccessPopup] = useState(false);
  const [returnSuccessPopupKey, setReturnSuccessPopupKey] = useState(0);
  const saleSuccessPopupTimerRef = useRef<number | null>(null);
  const returnSuccessPopupTimerRef = useRef<number | null>(null);
  const receiptPrintNoticeTimerRef = useRef<number | null>(null);
  const [receiptPrintNotice, setReceiptPrintNotice] = useState<{
    type: "warning" | "error";
    text: string;
  } | null>(null);

  // DB-loaded data
  const [visibleProducts, setVisibleProducts] = useState<DBProduct[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [totalProductsPages, setTotalProductsPages] = useState(1);
  const [dbCategories, setDbCategories] = useState<DBCategory[]>([]);
  const [posSettings, setPosSettings] =
    useState<POSSettings>(DEFAULT_POS_SETTINGS);

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [isPriceIncreaseModalOpen, setIsPriceIncreaseModalOpen] =
    useState(false);
  const [cartPriceIncreaseAmount, setCartPriceIncreaseAmount] = useState(0);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isReturnConfirmOpen, setIsReturnConfirmOpen] = useState(false);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [isQuickPrintQueued, setIsQuickPrintQueued] = useState(false);
  const scannerEnabled =
    posSettings.enableBarcode &&
    !isPaymentModalOpen &&
    !isCustomerModalOpen &&
    !isDiscountModalOpen &&
    !isPriceIncreaseModalOpen &&
    !isReturnConfirmOpen;

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const isCustomersLoadInFlightRef = useRef(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(
    null,
  );

  const loadCustomers = useCallback(async () => {
    if (isCustomersLoadInFlightRef.current) {
      return;
    }

    isCustomersLoadInFlightRef.current = true;
    setIsCustomersLoading(true);
    try {
      const custs = await customersService.list();
      setCustomers(custs.map(mapDbCustomerToPosCustomer));
    } catch (err) {
      console.error("Failed to load POS customers:", err);
    } finally {
      isCustomersLoadInFlightRef.current = false;
      setIsCustomersLoading(false);
    }
  }, []);

  // Load static POS data from DB
  const loadStaticData = useCallback(async () => {
    try {
      const [cats, settings] = await Promise.all([
        categoriesService.list(),
        settingsService.get(),
      ]);
      setDbCategories(cats);
      if (settings) {
        setPosSettings({
          ...DEFAULT_POS_SETTINGS,
          storeName: settings.storeName ?? DEFAULT_POS_SETTINGS.storeName,
          storeAddress:
            settings.storeAddress ?? DEFAULT_POS_SETTINGS.storeAddress,
          storePhone: settings.storePhone ?? DEFAULT_POS_SETTINGS.storePhone,
          taxRate: settings.taxRate ?? DEFAULT_POS_SETTINGS.taxRate,
          currency: POS_DISPLAY_CURRENCY,
          receiptFooter:
            settings.receiptFooter ?? DEFAULT_POS_SETTINGS.receiptFooter,
          printReceiptAutomatically:
            settings.printReceiptAutomatically ??
            DEFAULT_POS_SETTINGS.printReceiptAutomatically,
          receiptPrinterName:
            settings.receiptPrinterName ??
            DEFAULT_POS_SETTINGS.receiptPrinterName,
        });
      }
    } catch (err) {
      console.error("Failed to load POS data:", err);
    }
  }, []);

  useEffect(() => {
    void loadStaticData();
  }, [loadStaticData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedProductSearchValue(productSearchValue);
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, [productSearchValue]);

  const loadVisibleProducts = useCallback(async () => {
    try {
      const result = await productsService.listPaged({
        page: currentProductsPage,
        pageSize: productsPerPage,
        search: debouncedProductSearchValue.trim() || undefined,
        activeOnly: true,
        categoryId: selectedCategory === "all" ? undefined : selectedCategory,
      });
      setVisibleProducts(result.items);
      setTotalProductsCount(result.total);
      setTotalProductsPages(result.totalPages);
    } catch (err) {
      console.error("Failed to load POS products:", err);
      setVisibleProducts([]);
      setTotalProductsCount(0);
      setTotalProductsPages(1);
    }
  }, [
    currentProductsPage,
    productsPerPage,
    debouncedProductSearchValue,
    selectedCategory,
  ]);

  useEffect(() => {
    void loadVisibleProducts();
  }, [loadVisibleProducts]);

  useEffect(() => {
    if (!isCustomerModalOpen || customers.length > 0) {
      return;
    }

    void loadCustomers();
  }, [customers.length, isCustomerModalOpen, loadCustomers]);

  useEffect(() => {
    if (cartItems.length === 0 && appliedDiscount) {
      setAppliedDiscount(null);
    }
  }, [appliedDiscount, cartItems.length]);

  useEffect(() => {
    if (cartItems.length === 0 && isPriceIncreaseModalOpen) {
      setIsPriceIncreaseModalOpen(false);
    }
  }, [cartItems.length, isPriceIncreaseModalOpen]);

  useEffect(() => {
    if (cartItems.length === 0 && cartPriceIncreaseAmount !== 0) {
      setCartPriceIncreaseAmount(0);
    }
  }, [cartItems.length, cartPriceIncreaseAmount]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 0;
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, safeQuantity) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const handleApplyPriceIncreases = useCallback(
    (
      increasesByProductId: Record<string, number>,
      cartIncreaseAmount: number,
    ) => {
      setCartItems((prev) =>
        prev.map((item) => {
          const productId = item.productId;
          if (!productId) {
            return item;
          }

          const nextIncrease = increasesByProductId[productId];
          if (!Number.isFinite(nextIncrease)) {
            return item;
          }

          return {
            ...item,
            priceIncrease: roundToMoney(Math.max(0, nextIncrease)),
          };
        }),
      );
      setCartPriceIncreaseAmount(
        roundToMoney(
          Number.isFinite(cartIncreaseAmount) ? Math.max(0, cartIncreaseAmount) : 0,
        ),
      );
    },
    [],
  );

  const hasPriceIncrease = useMemo(
    () =>
      cartItems.some((item) => getPriceIncreaseValue(item) > 0) ||
      cartPriceIncreaseAmount > 0,
    [cartItems, cartPriceIncreaseAmount],
  );

  const displayCartItems = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        price: formatPrice(getUnitPriceWithIncrease(item)),
      })),
    [cartItems],
  );

  const priceIncreaseItems = useMemo(
    () =>
      cartItems
        .filter(
          (item): item is CartItemProps & { productId: string } =>
            typeof item.productId === "string" && item.productId.length > 0,
        )
        .map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: parsePrice(item.price),
          increase: getPriceIncreaseValue(item),
        })),
    [cartItems],
  );

  // Calculate cart totals dynamically with discount support
  const cartTotals = useMemo(() => {
    const itemsIncreaseAmount = roundToMoney(
      cartItems.reduce(
        (sum, item) => sum + getPriceIncreaseValue(item) * item.quantity,
        0,
      ),
    );
    const cartLevelIncreaseAmount = roundToMoney(
      Math.max(0, cartPriceIncreaseAmount),
    );
    const increaseAmount = roundToMoney(
      itemsIncreaseAmount + cartLevelIncreaseAmount,
    );
    const itemsSubtotalAmount = roundToMoney(
      cartItems.reduce((sum, item) => {
        const price = getUnitPriceWithIncrease(item);
        return sum + price * item.quantity;
      }, 0),
    );
    const subtotalAmount = roundToMoney(itemsSubtotalAmount + cartLevelIncreaseAmount);
    const discountAmount = calculateDiscountAmount(
      subtotalAmount,
      appliedDiscount,
    );
    const totalAmount = roundToMoney(Math.max(0, subtotalAmount - discountAmount));

    return {
      subtotal: formatPrice(subtotalAmount),
      subtotalNum: subtotalAmount,
      increaseAmount: formatPrice(increaseAmount),
      increaseAmountNum: increaseAmount,
      discountAmount: formatPrice(discountAmount),
      discountAmountNum: discountAmount,
      total: formatPrice(totalAmount),
      totalNum: totalAmount,
    };
  }, [appliedDiscount, cartItems, cartPriceIncreaseAmount]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    dbCategories.forEach((category) => {
      map.set(String(category.id), category.name);
    });
    return map;
  }, [dbCategories]);

  useEffect(() => {
    const handleResize = () => {
      setProductsPerPage(getProductsPerPage(window.innerWidth));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setCurrentProductsPage(1);
  }, [productsPerPage, debouncedProductSearchValue, selectedCategory]);

  useEffect(() => {
    setCurrentProductsPage((prev) => Math.min(prev, totalProductsPages));
  }, [totalProductsPages]);

  const addProductToCart = useCallback(
    (product: DBProduct) => {
      const productId = String(product.id);
      const category = categoryNameById.get(String(product.categoryId));
      setCartItems((prev) => {
        const existing = prev.find((item) => item.productId === productId);
        if (existing) {
          return prev.map((item) =>
            item.productId === productId
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }

        return [
          ...prev,
          {
            productId,
            name: product.name,
            category,
            price: formatPrice(product.price),
            originalPrice: product.originalPrice
              ? formatPrice(product.originalPrice)
              : undefined,
            image: product.image || defaultImage,
            quantity: 1,
            priceIncrease: 0,
            onQuantityChange: (quantity) => updateQuantity(productId, quantity),
          },
        ];
      });
    },
    [categoryNameById, updateQuantity],
  );

  // Handle barcode scan
  const handleBarcodeScan = useCallback(
    (rawBarcode: string) => {
      const barcode = normalizeBarcodeValue(rawBarcode);
      if (!barcode) return;

      void (async () => {
        const product = await productsService.getByBarcode(barcode);
        if (!product) {
          setBarcodeInputValue(barcode);
          setBarcodeSuccessMessage("");
          setBarcodeError(`لا يوجد منتج لهذا الباركود: ${barcode}`);
          return;
        }

        addProductToCart(product);
        setBarcodeInputValue("");
        setBarcodeError("");
        setBarcodeSuccessMessage(`تمت إضافة المنتج إلى السلة: ${product.name}`);
        setBarcodeSuccessPing((prev) => prev + 1);
        if (barcodeFeedbackTimerRef.current !== null) {
          window.clearTimeout(barcodeFeedbackTimerRef.current);
          barcodeFeedbackTimerRef.current = null;
        }
        barcodeFeedbackTimerRef.current = window.setTimeout(() => {
          setBarcodeSuccessMessage("");
          barcodeFeedbackTimerRef.current = null;
        }, 900);
      })().catch((err) => {
        console.error("Failed to load product by barcode:", err);
        setBarcodeInputValue(barcode);
        setBarcodeSuccessMessage("");
        setBarcodeError(`تعذر قراءة الباركود: ${barcode}`);
      });
    },
    [addProductToCart],
  );

  const focusBarcodeInput = useCallback(() => {
    if (!scannerEnabled) return;
    barcodeInputRef.current?.focus();
  }, [scannerEnabled]);

  const clearBarcodeFeedbackTimer = useCallback(() => {
    if (barcodeFeedbackTimerRef.current !== null) {
      window.clearTimeout(barcodeFeedbackTimerRef.current);
      barcodeFeedbackTimerRef.current = null;
    }
  }, []);

  const clearSaleSuccessPopupTimer = useCallback(() => {
    if (saleSuccessPopupTimerRef.current !== null) {
      window.clearTimeout(saleSuccessPopupTimerRef.current);
      saleSuccessPopupTimerRef.current = null;
    }
  }, []);

  const clearReturnSuccessPopupTimer = useCallback(() => {
    if (returnSuccessPopupTimerRef.current !== null) {
      window.clearTimeout(returnSuccessPopupTimerRef.current);
      returnSuccessPopupTimerRef.current = null;
    }
  }, []);

  const clearReceiptPrintNoticeTimer = useCallback(() => {
    if (receiptPrintNoticeTimerRef.current !== null) {
      window.clearTimeout(receiptPrintNoticeTimerRef.current);
      receiptPrintNoticeTimerRef.current = null;
    }
  }, []);

  const showReceiptPrintNotice = useCallback(
    (type: "warning" | "error", text: string) => {
      clearReceiptPrintNoticeTimer();
      setReceiptPrintNotice({ type, text });
      receiptPrintNoticeTimerRef.current = window.setTimeout(() => {
        setReceiptPrintNotice(null);
        receiptPrintNoticeTimerRef.current = null;
      }, 6000);
    },
    [clearReceiptPrintNoticeTimer],
  );

  const handleReceiptPrintResult = useCallback(
    (result: ReceiptPrintResult) => {
      if (!result.success) {
        const reason = result.error ? ` (${result.error})` : "";
        showReceiptPrintNotice("error", `فشل طباعة الإيصال.${reason}`);
        return;
      }

      if (result.warning) {
        showReceiptPrintNotice("warning", result.warning);
      }
    },
    [showReceiptPrintNotice],
  );

  const handleAutoReceiptPrint = useCallback(
    async (transaction: Transaction, settings: POSSettings) => {
      const printResult = await printTransactionReceipt(transaction, settings);
      handleReceiptPrintResult(printResult);
    },
    [handleReceiptPrintResult],
  );

  const triggerSaleSuccessFeedback = useCallback(() => {
    playSaleSuccessTone();
    clearSaleSuccessPopupTimer();
    setSaleSuccessPopupKey((prev) => prev + 1);
    setShowSaleSuccessPopup(true);
    saleSuccessPopupTimerRef.current = window.setTimeout(() => {
      setShowSaleSuccessPopup(false);
      saleSuccessPopupTimerRef.current = null;
    }, 1400);
  }, [clearSaleSuccessPopupTimer]);

  const triggerReturnSuccessFeedback = useCallback(() => {
    clearReturnSuccessPopupTimer();
    setReturnSuccessPopupKey((prev) => prev + 1);
    setShowReturnSuccessPopup(true);
    returnSuccessPopupTimerRef.current = window.setTimeout(() => {
      setShowReturnSuccessPopup(false);
      returnSuccessPopupTimerRef.current = null;
    }, 1600);
  }, [clearReturnSuccessPopupTimer]);

  useEffect(
    () => () => clearBarcodeFeedbackTimer(),
    [clearBarcodeFeedbackTimer],
  );

  useEffect(
    () => () => clearSaleSuccessPopupTimer(),
    [clearSaleSuccessPopupTimer],
  );

  useEffect(
    () => () => clearReturnSuccessPopupTimer(),
    [clearReturnSuccessPopupTimer],
  );

  useEffect(
    () => () => clearReceiptPrintNoticeTimer(),
    [clearReceiptPrintNoticeTimer],
  );

  useEffect(() => {
    focusBarcodeInput();
  }, [focusBarcodeInput]);

  const submitBarcodeInput = useCallback(() => {
    const barcode = normalizeBarcodeValue(barcodeInputValue);
    if (!barcode) return;
    handleBarcodeScan(barcode);
  }, [barcodeInputValue, handleBarcodeScan]);

  // Barcode scanner hook
  useBarcodeScanner({
    onBarcode: handleBarcodeScan,
    enabled: scannerEnabled,
    endChars: ["Enter", "Tab"],
    minLength: 3,
    captureFromInputs: true,
  });

  // Handle adding new customer
  const handleAddCustomer = useCallback(
    async (customerData: Omit<Customer, "id">) => {
      try {
        const created = await customersService.create({
          name: customerData.name,
          phone: customerData.phone || "",
          email: customerData.email || "",
        });
        if (created) {
          const newCustomer = mapDbCustomerToPosCustomer(created);
          setCustomers((prev) => [...prev, newCustomer]);
          setSelectedCustomer(newCustomer);
        }
      } catch (err) {
        console.error("Failed to add customer:", err);
      }
      setIsCustomerModalOpen(false);
    },
    [],
  );

  const handleOpenCustomerModal = useCallback(() => {
    setIsCustomerModalOpen(true);
    if (customers.length === 0) {
      void loadCustomers();
    }
  }, [customers.length, loadCustomers]);

  const applyProductStockDelta = useCallback(
    (adjustments: Array<{ productId: string; quantityDelta: number }>) => {
      if (adjustments.length === 0) return;

      const deltaByProductId = new Map<string, number>();
      for (const adjustment of adjustments) {
        const productId = adjustment.productId.trim();
        if (!productId) continue;
        const currentDelta = deltaByProductId.get(productId) ?? 0;
        deltaByProductId.set(
          productId,
          currentDelta + adjustment.quantityDelta,
        );
      }

      if (deltaByProductId.size === 0) return;

      setVisibleProducts((previous) =>
        previous.map((product) => {
          const productId = String(product.id);
          const delta = deltaByProductId.get(productId);
          if (!delta) return product;
          return {
            ...product,
            stock: Number(product.stock ?? 0) + delta,
          };
        }),
      );
    },
    [],
  );

  const applyCustomerSaleSummaryDelta = useCallback(
    (customerId: string | null | undefined, saleTotal: number) => {
      const normalizedCustomerId = customerId?.trim();
      if (!normalizedCustomerId || !Number.isFinite(saleTotal)) return;
      const normalizedSaleTotal = Math.max(0, saleTotal);

      setCustomers((previous) =>
        previous.map((customer) => {
          if (customer.id !== normalizedCustomerId) return customer;
          return {
            ...customer,
            totalPurchases: (customer.totalPurchases ?? 0) + 1,
            totalSpent: (customer.totalSpent ?? 0) + normalizedSaleTotal,
          };
        }),
      );
    },
    [],
  );

  // Handle payment processing
  const handleProcessPayment = useCallback(
    async (paymentInfo: PaymentInfo): Promise<boolean> => {
      if (cartItems.length === 0) {
        showReceiptPrintNotice("error", "لا توجد منتجات في السلة لإتمام عملية البيع.");
        return false;
      }

      const amountReceived =
        paymentInfo.method === "cash"
          ? Math.max(0, paymentInfo.received ?? 0)
          : paymentInfo.amount;
      const outstandingAmount =
        selectedCustomer && amountReceived < cartTotals.totalNum
          ? Math.max(0, cartTotals.totalNum - amountReceived)
          : 0;

      const normalizedPaymentInfo: PaymentInfo =
        paymentInfo.method === "cash"
          ? {
              ...paymentInfo,
              received: amountReceived,
              change: Math.max(0, paymentInfo.change ?? 0),
            }
          : paymentInfo;
      const normalizedDiscount = appliedDiscount
        ? {
            ...appliedDiscount,
            value:
              appliedDiscount.type === "fixed"
                ? cartTotals.discountAmountNum
                : Math.max(0, appliedDiscount.value),
          }
        : undefined;

      // Build sale items from cart, with cart-level increase and discount distributed across lines.
      const lineBaseSubtotals = cartItems.map((item) =>
        roundToMoney(getUnitPriceWithIncrease(item) * item.quantity),
      );
      const cartIncreaseAllocations = allocateDiscountAcrossLineSubtotals(
        lineBaseSubtotals,
        cartPriceIncreaseAmount,
      );
      const lineItems = cartItems.map((item, index) => {
        const baseUnitPrice = getUnitPriceWithIncrease(item);
        const lineIncrease = roundToMoney(
          Math.max(0, cartIncreaseAllocations[index] ?? 0),
        );
        const lineSubtotal = roundToMoney(
          roundToMoney(baseUnitPrice * item.quantity) + lineIncrease,
        );
        const unitPrice =
          item.quantity > 0
            ? roundToMoney(lineSubtotal / item.quantity)
            : baseUnitPrice;

        return {
          productId: item.productId ?? "",
          productName: item.name,
          price: unitPrice,
          quantity: item.quantity,
          lineSubtotal,
        };
      });
      const lineDiscounts = allocateDiscountAcrossLineSubtotals(
        lineItems.map((item) => item.lineSubtotal),
        cartTotals.discountAmountNum,
      );
      const saleItems = lineItems.map((item, index) => {
        const lineDiscount = roundToMoney(Math.max(0, lineDiscounts[index] ?? 0));
        return {
          productId: item.productId,
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
          discount: lineDiscount,
          discountType: "fixed" as const,
          subtotal: item.lineSubtotal,
        };
      });

      const missingProduct = saleItems.find((item) => !item.productId);
      if (missingProduct) {
        showReceiptPrintNotice(
          "error",
          `تعذر العثور على المنتج "${missingProduct.productName}" في قاعدة البيانات. أعد تحميل الصفحة وحاول مرة أخرى.`,
        );
        return false;
      }

      // Create transaction record for receipt
      const transaction: Transaction = {
        id: generateTransactionId(),
        timestamp: new Date().toISOString(),
        items: lineItems.map((item) => ({
          productId: item.productId,
          name: item.productName,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: cartTotals.subtotalNum,
        discount: normalizedDiscount,
        discountAmount: cartTotals.discountAmountNum,
        taxRate: 0,
        taxAmount: 0,
        total: cartTotals.totalNum,
        payment: normalizedPaymentInfo,
        customer: selectedCustomer || undefined,
      };

      // Persist sale to DB (fail-fast: do not clear cart or show receipt on failure).
      try {
        await salesService.create({
          receiptNumber: transaction.id,
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer?.name || "",
          subtotal: cartTotals.subtotalNum,
          increaseAmount: cartTotals.increaseAmountNum,
          discountAmount: cartTotals.discountAmountNum,
          discountType: normalizedDiscount?.type ?? "",
          discountValue: normalizedDiscount?.value ?? 0,
          taxRate: 0,
          taxAmount: 0,
          total: cartTotals.totalNum,
          paymentMethod: paymentInfo.method,
          amountReceived,
          changeGiven: paymentInfo.change || 0,
          reference: paymentInfo.reference || "",
          cashierId: authUser?.id?.toString() || "",
          cashierName: authUser?.fullName || "",
          note:
            outstandingAmount > 0
              ? `PARTIAL_PAYMENT_OUTSTANDING ${outstandingAmount.toFixed(2)} ${posSettings.currency}`
              : "",
          status: "completed",
          items: saleItems,
        });
      } catch (err) {
        console.error("Failed to persist sale:", err);
        const reason =
          err instanceof Error && err.message ? ` (${err.message})` : "";
        showReceiptPrintNotice("error", `تعذر حفظ عملية البيع.${reason}`);
        return false;
      }

      applyProductStockDelta(
        saleItems.map((item) => ({
          productId: item.productId,
          quantityDelta: -item.quantity,
        })),
      );
      applyCustomerSaleSummaryDelta(selectedCustomer?.id, cartTotals.totalNum);

      triggerSaleSuccessFeedback();
      void handleAutoReceiptPrint(transaction, posSettings);

      // Save transaction for receipt
      setLastTransaction(transaction);

      // Close payment modal and show receipt
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);

      // Clear cart and reset state
      setCartItems([]);
      setAppliedDiscount(null);
      setCartPriceIncreaseAmount(0);
      setSelectedCustomer(null);
      return true;
    },
    [
      cartItems,
      cartTotals,
      selectedCustomer,
      appliedDiscount,
      cartPriceIncreaseAmount,
      posSettings,
      authUser,
      applyProductStockDelta,
      applyCustomerSaleSummaryDelta,
      handleAutoReceiptPrint,
      showReceiptPrintNotice,
      triggerSaleSuccessFeedback,
    ],
  );

  // Handle proceed button
  const handleProceed = useCallback(() => {
    if (cartItems.length === 0) {
      return;
    }
    setIsPaymentModalOpen(true);
  }, [cartItems]);

  // Handle quick print receipt (cash payment)
  const handleQuickPrintReceipt = useCallback(() => {
    if (cartItems.length === 0) {
      return;
    }

    // Create cash payment info
    const cashPaymentInfo: PaymentInfo = {
      method: "cash",
      amount: cartTotals.totalNum,
      received: cartTotals.totalNum,
      change: 0,
    };

    // Process payment with cash
    void handleProcessPayment(cashPaymentInfo);
  }, [cartItems, cartTotals.totalNum, handleProcessPayment]);

  const queueQuickPrintReceipt = useCallback(() => {
    setIsQuickPrintQueued(true);
  }, []);

  useEffect(() => {
    if (!isQuickPrintQueued) {
      return;
    }
    setIsQuickPrintQueued(false);
    handleQuickPrintReceipt();
  }, [handleQuickPrintReceipt, isQuickPrintQueued]);

  const openReturnConfirmation = useCallback(() => {
    if (cartItems.length === 0 || isProcessingReturn) {
      return;
    }
    setIsReturnConfirmOpen(true);
  }, [cartItems.length, isProcessingReturn]);

  const closeReturnConfirmation = useCallback(() => {
    if (isProcessingReturn) {
      return;
    }
    setIsReturnConfirmOpen(false);
  }, [isProcessingReturn]);

  const handleConfirmReturn = useCallback(async () => {
    if (isProcessingReturn) {
      return;
    }

    if (cartItems.length === 0) {
      setIsReturnConfirmOpen(false);
      return;
    }

    setIsProcessingReturn(true);

    try {
      const lineBaseSubtotals = cartItems.map((item) =>
        roundToMoney(getUnitPriceWithIncrease(item) * item.quantity),
      );
      const cartIncreaseAllocations = allocateDiscountAcrossLineSubtotals(
        lineBaseSubtotals,
        cartPriceIncreaseAmount,
      );

      const returnPayloads = cartItems.map((item, index) => {
        if (!item.productId) {
          throw new Error(`تعذر العثور على المنتج: ${item.name}`);
        }

        return {
          saleId: undefined,
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          refundAmount: roundToMoney(
            roundToMoney(getUnitPriceWithIncrease(item) * item.quantity) +
              Math.max(0, cartIncreaseAllocations[index] ?? 0),
          ),
          reason: "POS_RETURN",
          status: "approved" as const,
          processedById: authUser?.id?.toString() || "",
          processedByName: authUser?.fullName || "",
        };
      });

      await returnsService.createBatch(returnPayloads);
      applyProductStockDelta(
        returnPayloads.map((entry) => ({
          productId: entry.productId,
          quantityDelta: entry.quantity,
        })),
      );

      setIsReturnConfirmOpen(false);
      setCartItems([]);
      setCartPriceIncreaseAmount(0);
      setSelectedCustomer(null);
      setBarcodeInputValue("");
      setBarcodeError("");
      setBarcodeSuccessMessage("");
      clearBarcodeFeedbackTimer();
      triggerReturnSuccessFeedback();
    } catch (err) {
      console.error("Failed to process POS return:", err);
      const reason =
        err instanceof Error && err.message ? ` (${err.message})` : "";
      showReceiptPrintNotice("error", `فشل تنفيذ عملية المرتجع.${reason}`);
    } finally {
      setIsProcessingReturn(false);
    }
  }, [
    authUser,
    cartItems,
    cartPriceIncreaseAmount,
    isProcessingReturn,
    applyProductStockDelta,
    clearBarcodeFeedbackTimer,
    showReceiptPrintNotice,
    triggerReturnSuccessFeedback,
  ]);

  const barcodeStatusClassName = barcodeError
    ? "pos-page__barcode-status pos-page__barcode-status--error"
    : barcodeSuccessMessage
      ? "pos-page__barcode-status pos-page__barcode-status--success"
      : "pos-page__barcode-status pos-page__barcode-status--ready";

  const barcodeInputClassName = barcodeError
    ? "pos-page__barcode-input pos-page__barcode-input--error"
    : barcodeSuccessMessage
      ? `pos-page__barcode-input ${
          barcodeSuccessPing % 2 === 0
            ? "pos-page__barcode-input--success-a"
            : "pos-page__barcode-input--success-b"
        }`
      : "pos-page__barcode-input";

  const barcodeStatusText =
    barcodeError || barcodeSuccessMessage || "جاهز لمسح الباركود...";

  return (
    <div className="pos-page">
      <NavSidebar
        items={buildSidebarNavItems("pos", role)}
        collapsed={false}
        onItemClick={(id) => {
          if (isAppPage(id)) {
            navigate(`/${id}`);
            return;
          }
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />
      <main className="pos-page__main">
        <div className="pos-page__barcode">
          <div className="pos-page__barcode-row">
            <div className="pos-page__barcode-field">
              <input
                id="pos-barcode-input"
                ref={barcodeInputRef}
                type="text"
                className={barcodeInputClassName}
                value={barcodeInputValue}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder=" ... "
                aria-describedby="pos-barcode-status"
                disabled={!scannerEnabled}
                onChange={(event) => {
                  setBarcodeInputValue(event.target.value);
                  if (barcodeError) {
                    setBarcodeError("");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.stopPropagation();
                  submitBarcodeInput();
                }}
                onBlur={(event) => {
                  if (!scannerEnabled) return;

                  const nextTarget = event.relatedTarget as HTMLElement | null;
                  if (
                    nextTarget &&
                    (nextTarget.tagName === "INPUT" ||
                      nextTarget.tagName === "TEXTAREA" ||
                      nextTarget.isContentEditable)
                  ) {
                    return;
                  }

                  window.setTimeout(() => {
                    if (document.activeElement === document.body) {
                      barcodeInputRef.current?.focus();
                    }
                  }, 0);
                }}
              />
              <span
                id="pos-barcode-status"
                className={barcodeStatusClassName}
                aria-live="polite"
                role={barcodeError ? "alert" : undefined}
              >
                {barcodeStatusText}
              </span>
            </div>
            <div className="pos-page__product-search-field">
              <input
                id="pos-product-search-input"
                type="search"
                className="pos-page__product-search-input"
                value={productSearchValue}
                inputMode="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="بحث بالاسم أو الكود الداخلي"
                aria-label="بحث المنتجات بالاسم أو الكود الداخلي"
                onChange={(event) => {
                  setProductSearchValue(event.target.value);
                }}
              />
            </div>
          </div>
        </div>
        <div className="pos-page__content">
          <div className="pos-page__categories-scroll">
            <div className="pos-page__categories">
              <CategoryChip
                key="all"
                label="الكل"
                selected={selectedCategory === "all"}
                onClick={() => setSelectedCategory("all")}
              />
              {dbCategories.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  label={cat.name}
                  image={cat.image || defaultImage}
                  selected={selectedCategory === String(cat.id)}
                  onClick={() => setSelectedCategory(String(cat.id))}
                />
              ))}
            </div>
          </div>
          <div className="pos-page__products" role="list">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                name={product.name}
                description={product.description || undefined}
                price={formatPrice(product.price)}
                originalPrice={
                  product.originalPrice
                    ? formatPrice(product.originalPrice)
                    : undefined
                }
                image={product.image || defaultImage}
                onAddToCart={() => addProductToCart(product)}
              />
            ))}
          </div>
          <div
            className="pos-page__products-pagination"
            aria-label="Products pagination"
          >
            <button
              type="button"
              className="pos-page__pagination-button"
              onClick={() =>
                setCurrentProductsPage((prev) => Math.max(1, prev - 1))
              }
              disabled={currentProductsPage === 1}
            >
              السابق
            </button>
            <span className="pos-page__pagination-status">
              {westernToArabic(String(currentProductsPage))} /{" "}
              {westernToArabic(String(totalProductsPages))}
            </span>
            <button
              type="button"
              className="pos-page__pagination-button"
              onClick={() =>
                setCurrentProductsPage((prev) =>
                  Math.min(totalProductsPages, prev + 1),
                )
              }
              disabled={currentProductsPage === totalProductsPages}
            >
              التالي
            </button>
            <span className="pos-page__pagination-total">
              {westernToArabic(String(totalProductsCount))} منتج
            </span>
          </div>
        </div>
      </main>
      <OrderPanel
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        items={displayCartItems}
        subtotal={cartTotals.subtotal}
        discount={cartTotals.discountAmount}
        total={cartTotals.total}
        onClearAll={() => {
          setCartItems([]);
          setAppliedDiscount(null);
          setCartPriceIncreaseAmount(0);
          setSelectedCustomer(null);
          setIsPriceIncreaseModalOpen(false);
        }}
        onPrintReceipt={handleQuickPrintReceipt}
        onProceed={handleProceed}
        onReturn={openReturnConfirmation}
        disableReturn={cartItems.length === 0 || isProcessingReturn}
        onCustomerClick={handleOpenCustomerModal}
        onDiscountClick={() => setIsDiscountModalOpen(true)}
        onPriceIncreaseClick={() => setIsPriceIncreaseModalOpen(true)}
        hasDiscount={cartTotals.discountAmountNum > 0}
        hasPriceIncrease={hasPriceIncrease}
        selectedCustomer={selectedCustomer}
      />

      <POSPageOverlays
        allowPartialCashPayment={!!selectedCustomer}
        cartItemCount={cartItems.length}
        currentDiscount={appliedDiscount}
        customerList={customers}
        currency={POS_DISPLAY_CURRENCY}
        customerLoading={isCustomersLoading}
        customerModalOpen={isCustomerModalOpen}
        discountModalOpen={isDiscountModalOpen}
        onAddCustomer={handleAddCustomer}
        onApplyDiscount={setAppliedDiscount}
        onApplyPriceIncreases={handleApplyPriceIncreases}
        onCloseCustomerModal={() => setIsCustomerModalOpen(false)}
        onCloseDiscountModal={() => setIsDiscountModalOpen(false)}
        onClosePaymentModal={() => setIsPaymentModalOpen(false)}
        onClosePriceIncreaseModal={() => setIsPriceIncreaseModalOpen(false)}
        onCloseReceiptModal={() => setIsReceiptModalOpen(false)}
        onCloseReturnConfirm={closeReturnConfirmation}
        onConfirmReturn={handleConfirmReturn}
        onPrintResult={handleReceiptPrintResult}
        onProcessPayment={handleProcessPayment}
        onQueueQuickPrintReceipt={queueQuickPrintReceipt}
        onSelectCustomer={setSelectedCustomer}
        paymentModalOpen={isPaymentModalOpen}
        posSettings={posSettings}
        priceIncreaseItems={priceIncreaseItems}
        priceIncreaseModalOpen={isPriceIncreaseModalOpen}
        processingReturn={isProcessingReturn}
        receiptModalOpen={isReceiptModalOpen}
        receiptPrintNotice={receiptPrintNotice}
        returnConfirmOpen={isReturnConfirmOpen}
        returnSuccessPopupKey={returnSuccessPopupKey}
        returnTotalLabel={cartTotals.total}
        saleSuccessPopupKey={saleSuccessPopupKey}
        selectedCustomer={selectedCustomer}
        selectedTransaction={lastTransaction}
        showReturnSuccessPopup={showReturnSuccessPopup}
        showSaleSuccessPopup={showSaleSuccessPopup}
        subtotalValue={cartTotals.subtotalNum}
        totalValue={cartTotals.totalNum}
        cartIncreaseAmount={cartPriceIncreaseAmount}
      />
    </div>
  );
}
