import type { Customer, Discount, POSSettings } from "../../app/pos/types";
import type { CartItemProps } from "../../components/pos/CartItem";
import type { Customer as DBCustomer } from "../../services/db";

type WindowWithWebkitAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export const POS_DISPLAY_CURRENCY = "جنيه";

export const DEFAULT_POS_SETTINGS: POSSettings = {
  currency: POS_DISPLAY_CURRENCY,
  taxRate: 5,
  storeName: "متجر التبغ",
  storeAddress: "شارع الملك فهد، الرياض",
  storePhone: "+966 50 123 4567",
  receiptFooter: "نشكركم على تسوقكم معنا",
  printReceiptAutomatically: true,
  enableBarcode: true,
  receiptPrinterName: "",
};

export function mapDbCustomerToPosCustomer(customer: DBCustomer): Customer {
  return {
    id: String(customer.id),
    name: customer.name,
    phone: customer.phone || undefined,
    email: customer.email || undefined,
    address: customer.address || undefined,
    totalPurchases: customer.totalPurchases,
    totalSpent: customer.totalSpent,
  };
}

export function arabicToWestern(str: string): string {
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  let result = str;

  arabicNumerals.forEach((arabic, index) => {
    result = result.replace(new RegExp(arabic, "g"), index.toString());
  });

  return result;
}

export function westernToArabic(str: string): string {
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return str.replace(/\d/g, (digit) => arabicNumerals[Number.parseInt(digit, 10)]);
}

export function parsePrice(priceStr: string): number {
  const normalized = arabicToWestern(priceStr).replace(/[^\d.]/g, "");
  return parseFloat(normalized) || 0;
}

export function normalizeBarcodeValue(value: string): string {
  return arabicToWestern(value).trim().toUpperCase();
}

export function formatPrice(amount: number): string {
  return `${POS_DISPLAY_CURRENCY} ${amount.toFixed(2)}`;
}

export function roundToMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getPriceIncreaseValue(item: CartItemProps): number {
  const rawValue = item.priceIncrease ?? 0;
  if (!Number.isFinite(rawValue)) {
    return 0;
  }

  return Math.max(0, rawValue);
}

export function getUnitPriceWithIncrease(item: CartItemProps): number {
  const basePrice = parsePrice(item.price);
  return roundToMoney(basePrice + getPriceIncreaseValue(item));
}

export function calculateDiscountAmount(
  subtotal: number,
  discount: Discount | null,
): number {
  if (!discount || subtotal <= 0) {
    return 0;
  }

  const safeDiscountValue = Math.max(0, discount.value);
  if (safeDiscountValue <= 0) {
    return 0;
  }

  const rawDiscount =
    discount.type === "percentage"
      ? subtotal * (Math.min(100, safeDiscountValue) / 100)
      : safeDiscountValue;

  return roundToMoney(Math.min(subtotal, rawDiscount));
}

export function allocateDiscountAcrossLineSubtotals(
  lineSubtotals: number[],
  discountAmount: number,
): number[] {
  if (lineSubtotals.length === 0) {
    return [];
  }

  const safeSubtotals = lineSubtotals.map((value) =>
    roundToMoney(Math.max(0, value)),
  );
  const totalSubtotal = roundToMoney(
    safeSubtotals.reduce((sum, value) => sum + value, 0),
  );
  const safeDiscount = roundToMoney(Math.max(0, discountAmount));

  if (totalSubtotal <= 0 || safeDiscount <= 0) {
    return safeSubtotals.map(() => 0);
  }

  let remainingDiscount = Math.min(safeDiscount, totalSubtotal);
  const allocations = safeSubtotals.map(() => 0);

  for (let index = 0; index < safeSubtotals.length; index += 1) {
    const lineSubtotal = safeSubtotals[index];
    if (lineSubtotal <= 0 || remainingDiscount <= 0) {
      continue;
    }

    const isLastLine = index === safeSubtotals.length - 1;
    if (isLastLine) {
      const finalAllocation = roundToMoney(
        Math.min(lineSubtotal, remainingDiscount),
      );
      allocations[index] = finalAllocation;
      remainingDiscount = roundToMoney(remainingDiscount - finalAllocation);
      continue;
    }

    const proportionalShare = roundToMoney(
      (lineSubtotal / totalSubtotal) * safeDiscount,
    );
    const lineAllocation = roundToMoney(
      Math.min(lineSubtotal, remainingDiscount, proportionalShare),
    );
    allocations[index] = lineAllocation;
    remainingDiscount = roundToMoney(remainingDiscount - lineAllocation);
  }

  return allocations;
}

export function playSaleSuccessTone(): void {
  if (typeof window === "undefined") {
    return;
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as WindowWithWebkitAudioContext).webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  try {
    const audioContext = new AudioContextConstructor();
    const now = audioContext.currentTime;
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    const oscillator = audioContext.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
    oscillator.connect(gainNode);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
    oscillator.onended = () => {
      void audioContext.close().catch(() => {});
    };
  } catch {
    // Ignore audio errors such as blocked autoplay policies.
  }
}

export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `TXN-${timestamp}-${random}`.toUpperCase();
}

export function getProductsPerPage(viewportWidth: number): number {
  if (viewportWidth <= 640) return 6;
  if (viewportWidth <= 900) return 8;
  if (viewportWidth <= 1440) return 15;
  return 21;
}
