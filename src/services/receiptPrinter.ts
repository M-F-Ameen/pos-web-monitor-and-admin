import type { POSSettings, Transaction } from "../app/pos/types";
import { printers, type ReceiptPrintResult, type Return, type Sale } from "./db";

/** Receipt paper: 80mm roll, printable width ~72.1mm, length 297mm */
const THERMAL_RECEIPT_WIDTH_MM = 72.1;
const THERMAL_RECEIPT_HEIGHT_MM = 297;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAmount(value: number, currency: string): string {
  return `${value.toFixed(2)} ${currency}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatGregorianDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function formatGregorianTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatGregorianDateTime(date: Date): string {
  return `${formatGregorianDate(date)} ${formatGregorianTime(date)}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatGregorianDateTime(date);
}

function formatDateOnly(value: string): string {
  const plainDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = plainDateMatch
    ? new Date(
        Number(plainDateMatch[1]),
        Number(plainDateMatch[2]) - 1,
        Number(plainDateMatch[3]),
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatGregorianDate(date);
}

function formatTimeOnly(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatGregorianTime(date);
}

function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case "cash":
      return "نقدي";
    case "card":
      return "بطاقة";
    case "wallet":
      return "محفظة";
    default:
      return method;
  }
}

function getSaleStatusLabel(status: Sale["status"]): string {
  switch (status) {
    case "completed":
      return "مكتمل";
    case "refunded":
      return "مرتجع";
    case "voided":
      return "ملغي";
    default:
      return status;
  }
}

export function buildReceiptHtml(
  transaction: Transaction,
  settings: POSSettings,
): string {
  const currency = settings.currency || "LE";
  const storeName = escapeHtml(settings.storeName || "متجر التبغ");
  const storeAddress = settings.storeAddress
    ? `<div class="receipt__meta-line">${escapeHtml(settings.storeAddress)}</div>`
    : "";
  const storePhone = settings.storePhone
    ? `<div class="receipt__meta-line">${escapeHtml(settings.storePhone)}</div>`
    : "";
  const customerLine = transaction.customer?.name
    ? `<div class="receipt__meta-line">العميل: ${escapeHtml(transaction.customer.name)}</div>`
    : "";
  const footerText = settings.receiptFooter
    ? escapeHtml(settings.receiptFooter)
    : "شكراً لتسوقكم معنا";

  const discountAmount = Math.max(0, transaction.discountAmount ?? 0);
  const taxAmount = Math.max(0, transaction.taxAmount ?? 0);
  const paidAmount =
    transaction.payment.method === "cash"
      ? Math.max(0, transaction.payment.received ?? 0)
      : transaction.total;
  const changeAmount =
    transaction.payment.method === "cash"
      ? Math.max(0, transaction.payment.change ?? 0)
      : 0;

  const itemsHtml = transaction.items
    .map((item) => {
      const qty = Math.max(0, item.quantity);
      const lineTotal = item.price * qty;
      return `<div class="receipt__item">
        <div class="receipt__item-name">${escapeHtml(item.name)}</div>
        <div class="receipt__item-meta">${qty} x ${item.price.toFixed(2)}</div>
        <div class="receipt__item-total">${lineTotal.toFixed(2)}</div>
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Receipt</title>
  <style>
    @page { size: ${THERMAL_RECEIPT_WIDTH_MM}mm ${THERMAL_RECEIPT_HEIGHT_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
      min-height: 100%;
      margin: 0 auto;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Courier New", "Courier", monospace;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 3mm 4mm 4mm;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
      box-sizing: border-box;
    }
    .receipt__center { text-align: center; }
    .receipt__title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 1.5mm;
    }
    .receipt__meta-line {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 0.8mm;
      word-break: break-word;
      text-align: center;
    }
    .receipt__divider {
      border-top: 1px dashed #000;
      margin: 2mm auto;
      width: 100%;
    }
    .receipt__item {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "name total"
        "meta total";
      column-gap: 2mm;
      margin-bottom: 1.5mm;
      text-align: right;
      font-weight: 700;
    }
    .receipt__item-name {
      grid-area: name;
      font-size: 11px;
      font-weight: 700;
      word-break: break-word;
    }
    .receipt__item-meta {
      grid-area: meta;
      font-size: 10px;
      font-weight: 700;
    }
    .receipt__item-total {
      grid-area: total;
      align-self: center;
      direction: ltr;
      font-weight: 700;
    }
    .receipt__row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      margin-bottom: 1mm;
      font-weight: 700;
    }
    .receipt__row--strong {
      font-weight: 700;
      font-size: 12px;
    }
    .receipt__value {
      direction: ltr;
      text-align: right;
      white-space: nowrap;
      font-weight: 700;
    }
    .receipt__footer {
      text-align: center;
      margin-top: 3mm;
      font-size: 10px;
      font-weight: 700;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="receipt__center receipt__title">${storeName}</div>
    ${storeAddress}
    ${storePhone}
    <div class="receipt__divider"></div>

    <div class="receipt__meta-line">الفاتورة: ${escapeHtml(transaction.id)}</div>
    <div class="receipt__meta-line">التاريخ: ${escapeHtml(formatDateTime(transaction.timestamp))}</div>
    ${customerLine}

    <div class="receipt__divider"></div>
    ${itemsHtml}
    <div class="receipt__divider"></div>

    <div class="receipt__row">
      <span>المجموع الفرعي</span>
      <span class="receipt__value">${escapeHtml(formatAmount(transaction.subtotal, currency))}</span>
    </div>
    ${
      discountAmount > 0
        ? `<div class="receipt__row">
      <span>الخصم</span>
      <span class="receipt__value">-${escapeHtml(formatAmount(discountAmount, currency))}</span>
    </div>`
        : ""
    }
    ${
      taxAmount > 0
        ? `<div class="receipt__row">
      <span>الضريبة</span>
      <span class="receipt__value">${escapeHtml(formatAmount(taxAmount, currency))}</span>
    </div>`
        : ""
    }
    <div class="receipt__row receipt__row--strong">
      <span>الإجمالي</span>
      <span class="receipt__value">${escapeHtml(formatAmount(transaction.total, currency))}</span>
    </div>

    <div class="receipt__divider"></div>
    <div class="receipt__row">
      <span>طريقة الدفع</span>
      <span>${escapeHtml(getPaymentMethodLabel(transaction.payment.method))}</span>
    </div>
    <div class="receipt__row">
      <span>المدفوع</span>
      <span class="receipt__value">${escapeHtml(formatAmount(paidAmount, currency))}</span>
    </div>
    ${
      transaction.payment.method === "cash"
        ? `<div class="receipt__row">
      <span>الباقي</span>
      <span class="receipt__value">${escapeHtml(formatAmount(changeAmount, currency))}</span>
    </div>`
        : ""
    }

    <div class="receipt__footer">${footerText}</div>
  </section>
</body>
</html>`;
}

export async function printTransactionReceipt(
  transaction: Transaction,
  settings: POSSettings,
): Promise<ReceiptPrintResult> {
  const html = buildReceiptHtml(transaction, settings);
  return printers.printReceipt(html, {
    preferredPrinterName: settings.receiptPrinterName || undefined,
    fallbackToDefault: true,
  });
}

/**
 * Build a compact summary receipt that contains all sales for a specific day.
 * Uses the same visual receipt style and print path as single-sale receipts.
 */
export function buildDailySalesReceiptHtml(
  daySales: Sale[],
  settings: POSSettings,
  reportDate: string,
  dayReturns: Return[] = [],
): string {
  const currency = settings.currency || "LE";
  const storeName = escapeHtml(settings.storeName || "متجر التبغ");
  const storeAddress = settings.storeAddress
    ? `<div class="receipt__meta-line">${escapeHtml(settings.storeAddress)}</div>`
    : "";
  const storePhone = settings.storePhone
    ? `<div class="receipt__meta-line">${escapeHtml(settings.storePhone)}</div>`
    : "";
  const footerText = settings.receiptFooter
    ? escapeHtml(settings.receiptFooter)
    : "شكراً لتسوقكم معنا";

  const sortedSales = [...daySales].sort((a, b) => {
    const first = new Date(a.createdAt).getTime();
    const second = new Date(b.createdAt).getTime();
    return first - second;
  });
  const sortedReturns = [...dayReturns].sort((a, b) => {
    const first = new Date(a.createdAt).getTime();
    const second = new Date(b.createdAt).getTime();
    return first - second;
  });
  const approvedDayReturns = sortedReturns.filter(
    (entry) => entry.status === "approved",
  );

  const completedSales = sortedSales.filter((sale) => sale.status === "completed");
  const refundedSales = sortedSales.filter((sale) => sale.status === "refunded");
  const voidedSales = sortedSales.filter((sale) => sale.status === "voided");

  const paymentTotals: Record<"cash" | "card" | "wallet", number> = {
    cash: 0,
    card: 0,
    wallet: 0,
  };
  for (const sale of completedSales) {
    paymentTotals[sale.paymentMethod] += sale.total;
  }

  const totalRecorded = sortedSales.reduce((sum, sale) => sum + sale.total, 0);
  const refundedTotal = refundedSales.reduce((sum, sale) => sum + sale.total, 0);
  const voidedTotal = voidedSales.reduce((sum, sale) => sum + sale.total, 0);
  const approvedReturnsTotal = approvedDayReturns.reduce(
    (sum, entry) => sum + entry.refundAmount,
    0,
  );
  const netTotal = Math.max(
    0,
    totalRecorded - refundedTotal - voidedTotal - approvedReturnsTotal,
  );

  const itemsHtml =
    sortedSales.length > 0
      ? sortedSales
          .map((sale) => {
            const saleCustomer = sale.customerName?.trim() || "عميل نقدي";
            const metaLine = `${formatTimeOnly(sale.createdAt)} | ${getPaymentMethodLabel(sale.paymentMethod)} | ${getSaleStatusLabel(sale.status)} | ${saleCustomer}`;
            return `<div class="receipt__item">
        <div class="receipt__item-name">فاتورة ${escapeHtml(sale.receiptNumber)}</div>
        <div class="receipt__item-meta">${escapeHtml(metaLine)}</div>
        <div class="receipt__item-total">${sale.total.toFixed(2)}</div>
      </div>`;
          })
          .join("")
      : `<div class="receipt__meta-line">لا توجد عمليات مبيعات لهذا اليوم.</div>`;

  const returnsItemsHtml =
    approvedDayReturns.length > 0
      ? `<div class="receipt__divider"></div>
    <div class="receipt__meta-line">\u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0627\u062A \u0627\u0644\u0645\u0633\u062C\u0644\u0629</div>
    ${approvedDayReturns
      .map((entry) => {
        const returnMeta = `${formatTimeOnly(entry.createdAt)} | ${
          entry.productName
        } | \u0627\u0644\u0643\u0645\u064A\u0629 ${entry.quantity}`;
        return `<div class="receipt__item">
        <div class="receipt__item-name">\u0645\u0631\u062A\u062C\u0639 ${escapeHtml(entry.returnNumber)}</div>
        <div class="receipt__item-meta">${escapeHtml(returnMeta)}</div>
        <div class="receipt__item-total">-${entry.refundAmount.toFixed(2)}</div>
      </div>`;
      })
      .join("")}`
      : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Sales Receipt</title>
  <style>
    @page { size: ${THERMAL_RECEIPT_WIDTH_MM}mm ${THERMAL_RECEIPT_HEIGHT_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
      min-height: 100%;
      margin: 0 auto;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Courier New", "Courier", monospace;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 3mm 4mm 4mm;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
      box-sizing: border-box;
    }
    .receipt__center { text-align: center; }
    .receipt__title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 1.5mm;
    }
    .receipt__meta-line {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 0.8mm;
      word-break: break-word;
      text-align: center;
    }
    .receipt__divider {
      border-top: 1px dashed #000;
      margin: 2mm auto;
      width: 100%;
    }
    .receipt__item {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "name total"
        "meta total";
      column-gap: 2mm;
      margin-bottom: 1.5mm;
      text-align: right;
      font-weight: 700;
    }
    .receipt__item-name {
      grid-area: name;
      font-size: 11px;
      font-weight: 700;
      word-break: break-word;
    }
    .receipt__item-meta {
      grid-area: meta;
      font-size: 10px;
      font-weight: 700;
    }
    .receipt__item-total {
      grid-area: total;
      align-self: center;
      direction: ltr;
      font-weight: 700;
    }
    .receipt__row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      margin-bottom: 1mm;
      font-weight: 700;
    }
    .receipt__row--strong {
      font-weight: 700;
      font-size: 12px;
    }
    .receipt__value {
      direction: ltr;
      text-align: right;
      white-space: nowrap;
      font-weight: 700;
    }
    .receipt__footer {
      text-align: center;
      margin-top: 3mm;
      font-size: 10px;
      font-weight: 700;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="receipt__center receipt__title">${storeName}</div>
    <div class="receipt__meta-line">تقرير مبيعات اليوم</div>
    ${storeAddress}
    ${storePhone}
    <div class="receipt__divider"></div>

    <div class="receipt__meta-line">تاريخ التقرير: ${escapeHtml(formatDateOnly(reportDate))}</div>
    <div class="receipt__meta-line">وقت الطباعة: ${escapeHtml(formatGregorianDateTime(new Date()))}</div>

    <div class="receipt__divider"></div>
    ${itemsHtml}
    ${returnsItemsHtml}
    <div class="receipt__divider"></div>

    <div class="receipt__row">
      <span>عدد الفواتير</span>
      <span class="receipt__value">${sortedSales.length}</span>
    </div>
    <div class="receipt__row">
      <span>مكتمل</span>
      <span class="receipt__value">${completedSales.length}</span>
    </div>
    <div class="receipt__row">
      <span>مرتجع</span>
      <span class="receipt__value">${refundedSales.length}</span>
    </div>
    <div class="receipt__row">
      <span>\u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0627\u062A \u0627\u0644\u0645\u0633\u062C\u0644\u0629</span>
      <span class="receipt__value">${approvedDayReturns.length}</span>
    </div>
    <div class="receipt__row">
      <span>ملغي</span>
      <span class="receipt__value">${voidedSales.length}</span>
    </div>
    <div class="receipt__row">
      <span>إجمالي مسجل</span>
      <span class="receipt__value">${escapeHtml(formatAmount(totalRecorded, currency))}</span>
    </div>
    ${
      refundedTotal > 0
        ? `<div class="receipt__row">
      <span>إجمالي المرتجعات</span>
      <span class="receipt__value">-${escapeHtml(formatAmount(refundedTotal, currency))}</span>
    </div>`
        : ""
    }
    ${
      approvedReturnsTotal > 0
        ? `<div class="receipt__row">
      <span>\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0627\u062A \u0627\u0644\u0645\u0633\u062C\u0644\u0629</span>
      <span class="receipt__value">-${escapeHtml(formatAmount(approvedReturnsTotal, currency))}</span>
    </div>`
        : ""
    }
    ${
      voidedTotal > 0
        ? `<div class="receipt__row">
      <span>إجمالي الملغى</span>
      <span class="receipt__value">-${escapeHtml(formatAmount(voidedTotal, currency))}</span>
    </div>`
        : ""
    }
    <div class="receipt__row receipt__row--strong">
      <span>صافي المبيعات</span>
      <span class="receipt__value">${escapeHtml(formatAmount(netTotal, currency))}</span>
    </div>

    <div class="receipt__divider"></div>
    <div class="receipt__row">
      <span>نقدي</span>
      <span class="receipt__value">${escapeHtml(formatAmount(paymentTotals.cash, currency))}</span>
    </div>
    <div class="receipt__row">
      <span>بطاقة</span>
      <span class="receipt__value">${escapeHtml(formatAmount(paymentTotals.card, currency))}</span>
    </div>
    <div class="receipt__row">
      <span>محفظة</span>
      <span class="receipt__value">${escapeHtml(formatAmount(paymentTotals.wallet, currency))}</span>
    </div>

    <div class="receipt__footer">${footerText}</div>
  </section>
</body>
</html>`;
}

export async function printDailySalesReceipt(
  daySales: Sale[],
  settings: POSSettings,
  reportDate: string,
  dayReturns: Return[] = [],
): Promise<ReceiptPrintResult> {
  const html = buildDailySalesReceiptHtml(
    daySales,
    settings,
    reportDate,
    dayReturns,
  );
  return printers.printReceipt(html, {
    preferredPrinterName: settings.receiptPrinterName || undefined,
    fallbackToDefault: true,
  });
}

export interface ReportsReceiptProductLine {
  name: string;
  soldQty: number;
  returnedQty: number;
  netRevenue: number;
}

export interface ReportsReceiptLowStockLine {
  name: string;
  stock: number;
  threshold: number;
  stockValue: number;
}

export interface ReportsReceiptDebtLine {
  name: string;
  debt: number;
}

export interface ReportsReceiptDailyLine {
  dateKey: string;
  orders: number;
  units: number;
  grossSales: number;
  refunds: number;
  netRevenue: number;
}

export interface ReportsReceiptPayload {
  reportRangeLabel: string;
  printedAt: string;
  grossSales: number;
  totalRefunds: number;
  netRevenue: number;
  totalOrders: number;
  soldUnits: number;
  inventoryUnits: number;
  inventoryValue: number;
  totalCustomerDebt: number;
  debtCustomersCount: number;
  topProducts: ReportsReceiptProductLine[];
  lowStockProducts: ReportsReceiptLowStockLine[];
  debtCustomers: ReportsReceiptDebtLine[];
  dailyRows: ReportsReceiptDailyLine[];
}

export function buildReportsSummaryReceiptHtml(
  payload: ReportsReceiptPayload,
  settings: POSSettings,
): string {
  const currency = settings.currency || "LE";
  const storeName = escapeHtml(settings.storeName || "متجر التبغ");
  const storeAddress = settings.storeAddress
    ? `<div class="receipt__meta-line">${escapeHtml(settings.storeAddress)}</div>`
    : "";
  const storePhone = settings.storePhone
    ? `<div class="receipt__meta-line">${escapeHtml(settings.storePhone)}</div>`
    : "";
  const footerText = settings.receiptFooter
    ? escapeHtml(settings.receiptFooter)
    : "نشكركم على ثقتكم بنا";

  const topProductsHtml =
    payload.topProducts.length > 0
      ? payload.topProducts
          .map((product) => {
            const meta = `مباع ${product.soldQty} | مرتجع ${product.returnedQty}`;
            return `<div class="receipt__item">
        <div class="receipt__item-name">${escapeHtml(product.name)}</div>
        <div class="receipt__item-meta">${escapeHtml(meta)}</div>
        <div class="receipt__item-total">${escapeHtml(formatAmount(product.netRevenue, currency))}</div>
      </div>`;
          })
          .join("")
      : `<div class="receipt__meta-line">لا توجد بيانات منتجات في هذا النطاق.</div>`;

  const lowStockHtml =
    payload.lowStockProducts.length > 0
      ? payload.lowStockProducts
          .map((product) => {
            const meta = `المتاح ${product.stock} / حد التنبيه ${product.threshold}`;
            return `<div class="receipt__item">
        <div class="receipt__item-name">${escapeHtml(product.name)}</div>
        <div class="receipt__item-meta">${escapeHtml(meta)}</div>
        <div class="receipt__item-total">${escapeHtml(formatAmount(product.stockValue, currency))}</div>
      </div>`;
          })
          .join("")
      : `<div class="receipt__meta-line">لا توجد منتجات منخفضة المخزون.</div>`;

  const debtCustomersHtml =
    payload.debtCustomers.length > 0
      ? payload.debtCustomers
          .map((customer) => {
            return `<div class="receipt__item">
        <div class="receipt__item-name">${escapeHtml(customer.name)}</div>
        <div class="receipt__item-meta">الدين</div>
        <div class="receipt__item-total">${escapeHtml(formatAmount(customer.debt, currency))}</div>
      </div>`;
          })
          .join("")
      : `<div class="receipt__meta-line">لا توجد ديون عملاء حالياً.</div>`;

  const dailyRowsHtml =
    payload.dailyRows.length > 0
      ? payload.dailyRows
          .map((row) => {
            const meta = `${row.orders} عمليات | ${row.units} وحدات`;
            return `<div class="receipt__item">
        <div class="receipt__item-name">${escapeHtml(formatDateOnly(row.dateKey))}</div>
        <div class="receipt__item-meta">${escapeHtml(meta)}</div>
        <div class="receipt__item-total">${escapeHtml(formatAmount(row.netRevenue, currency))}</div>
      </div>`;
          })
          .join("")
      : `<div class="receipt__meta-line">لا توجد حركة يومية في النطاق المحدد.</div>`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ملخص التقارير</title>
  <style>
    @page { size: ${THERMAL_RECEIPT_WIDTH_MM}mm ${THERMAL_RECEIPT_HEIGHT_MM}mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
      min-height: 100%;
      margin: 0 auto;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: "Courier New", "Courier", monospace;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt {
      width: ${THERMAL_RECEIPT_WIDTH_MM}mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 3mm 4mm 4mm;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
      box-sizing: border-box;
    }
    .receipt__center { text-align: center; }
    .receipt__title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 1.5mm;
    }
    .receipt__meta-line {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 0.8mm;
      word-break: break-word;
      text-align: center;
    }
    .receipt__divider {
      border-top: 1px dashed #000;
      margin: 2mm auto;
      width: 100%;
    }
    .receipt__item {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas:
        "name total"
        "meta total";
      column-gap: 2mm;
      margin-bottom: 1.5mm;
      text-align: right;
      font-weight: 700;
    }
    .receipt__item-name {
      grid-area: name;
      font-size: 11px;
      font-weight: 700;
      word-break: break-word;
    }
    .receipt__item-meta {
      grid-area: meta;
      font-size: 10px;
      font-weight: 700;
    }
    .receipt__item-total {
      grid-area: total;
      align-self: center;
      direction: ltr;
      font-weight: 700;
      text-align: right;
      white-space: nowrap;
    }
    .receipt__section-title {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 1.2mm;
    }
    .receipt__row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      margin-bottom: 1mm;
      font-weight: 700;
    }
    .receipt__row--strong {
      font-weight: 700;
      font-size: 12px;
    }
    .receipt__value {
      direction: ltr;
      text-align: right;
      white-space: nowrap;
      font-weight: 700;
    }
    .receipt__footer {
      text-align: center;
      margin-top: 3mm;
      font-size: 10px;
      font-weight: 700;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="receipt__center receipt__title">${storeName}</div>
    <div class="receipt__meta-line">ملخص التقارير</div>
    ${storeAddress}
    ${storePhone}
    <div class="receipt__divider"></div>

    <div class="receipt__meta-line">نطاق التقرير: ${escapeHtml(payload.reportRangeLabel)}</div>
    <div class="receipt__meta-line">وقت الطباعة: ${escapeHtml(formatDateTime(payload.printedAt))}</div>

    <div class="receipt__divider"></div>
    <div class="receipt__row">
      <span>إجمالي المبيعات</span>
      <span class="receipt__value">${escapeHtml(formatAmount(payload.grossSales, currency))}</span>
    </div>
    <div class="receipt__row">
      <span>إجمالي المرتجعات</span>
      <span class="receipt__value">-${escapeHtml(formatAmount(payload.totalRefunds, currency))}</span>
    </div>
    <div class="receipt__row receipt__row--strong">
      <span>صافي الإيراد</span>
      <span class="receipt__value">${escapeHtml(formatAmount(payload.netRevenue, currency))}</span>
    </div>
    <div class="receipt__row">
      <span>عدد الطلبات</span>
      <span class="receipt__value">${payload.totalOrders}</span>
    </div>
    <div class="receipt__row">
      <span>الوحدات المباعة</span>
      <span class="receipt__value">${payload.soldUnits}</span>
    </div>
    <div class="receipt__row">
      <span>وحدات المخزون</span>
      <span class="receipt__value">${payload.inventoryUnits}</span>
    </div>
    <div class="receipt__row">
      <span>قيمة المخزون</span>
      <span class="receipt__value">${escapeHtml(formatAmount(payload.inventoryValue, currency))}</span>
    </div>
    <div class="receipt__row">
      <span>إجمالي ديون العملاء</span>
      <span class="receipt__value">${escapeHtml(formatAmount(payload.totalCustomerDebt, currency))}</span>
    </div>
    <div class="receipt__row">
      <span>عدد العملاء المديونين</span>
      <span class="receipt__value">${payload.debtCustomersCount}</span>
    </div>

    <div class="receipt__divider"></div>
    <div class="receipt__section-title">أكثر المنتجات مبيعًا</div>
    ${topProductsHtml}

    <div class="receipt__divider"></div>
    <div class="receipt__section-title">المنتجات منخفضة المخزون</div>
    ${lowStockHtml}

    <div class="receipt__divider"></div>
    <div class="receipt__section-title">ديون العملاء</div>
    ${debtCustomersHtml}

    <div class="receipt__divider"></div>
    <div class="receipt__section-title">ملخص يومي</div>
    ${dailyRowsHtml}

    <div class="receipt__footer">${footerText}</div>
  </section>
</body>
</html>`;
}

export async function printReportsSummaryReceipt(
  payload: ReportsReceiptPayload,
  settings: POSSettings,
): Promise<ReceiptPrintResult> {
  const html = buildReportsSummaryReceiptHtml(payload, settings);
  return printers.printReceipt(html, {
    preferredPrinterName: settings.receiptPrinterName || undefined,
    fallbackToDefault: true,
  });
}
