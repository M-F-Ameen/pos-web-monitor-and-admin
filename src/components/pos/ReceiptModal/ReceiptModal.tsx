import { useState } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { IconPrint, IconCheckCircle } from "../../ui/Icons";
import type { Transaction, POSSettings } from "../../../app/pos/types";
import type { ReceiptPrintResult } from "../../../services/db";
import { printTransactionReceipt } from "../../../services/receiptPrinter";
import "./ReceiptModal.css";

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  settings: POSSettings;
  onPrintResult?: (result: ReceiptPrintResult) => void;
}

function formatLocalGregorianDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad2 = (input: number) => String(input).padStart(2, "0");
  const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
  const timePart = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return `${datePart} ${timePart}`;
}

/**
 * Receipt preview and manual reprint modal.
 * Silent auto-print is triggered from POS page after payment success.
 */
export function ReceiptModal({
  isOpen,
  onClose,
  transaction,
  settings,
  onPrintResult,
}: ReceiptModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  async function handlePrint() {
    if (!transaction || isPrinting) return;

    setIsPrinting(true);
    try {
      const result = await printTransactionReceipt(transaction, settings);
      if (!result.success) {
        console.error("Failed to reprint receipt:", result.error);
      } else if (result.warning) {
        console.warn("Receipt reprint warning:", result.warning);
      }
      onPrintResult?.(result);
    } finally {
      setIsPrinting(false);
    }
  }

  if (!transaction) return null;

  const paymentMethodLabels: Record<string, string> = {
    cash: "نقدي",
    card: "بطاقة",
    wallet: "محفظة",
  };
  const discountAmount = transaction.discountAmount ?? 0;
  const discountLabelSuffix =
    transaction.discount?.type === "percentage"
      ? ` (${transaction.discount.value}%)`
      : "";
  const taxRate = transaction.taxRate ?? settings.taxRate ?? 0;
  const taxAmount = transaction.taxAmount ?? 0;

  const cashReceived =
    transaction.payment.method === "cash"
      ? Math.max(0, transaction.payment.received ?? 0)
      : 0;
  const changeAmount =
    transaction.payment.method === "cash"
      ? Math.max(0, transaction.payment.change ?? 0)
      : 0;
  const remainingAmount =
    transaction.payment.method === "cash"
      ? Math.max(0, transaction.total - cashReceived + changeAmount)
      : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="الإيصال"
      size="sm"
      footer={
        <div className="receipt-modal__footer">
          <Button variant="secondary" onClick={onClose} disabled={isPrinting}>
            إغلاق
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            icon={<IconPrint />}
            loading={isPrinting}
            loadingText="جاري الطباعة..."
            disabled={isPrinting}
          >
            طباعة
          </Button>
        </div>
      }
    >
      <div className="receipt-modal">
        {/* Success Banner */}
        <div className="receipt-modal__success">
          <IconCheckCircle />
          <span>تمت العملية بنجاح</span>
        </div>

        {/* Receipt Preview */}
        <div className="receipt-modal__preview">
          <div className="receipt">
            {/* Header */}
            <div className="receipt__header">
              <div className="receipt__store-name">
                {settings.storeName || "متجر التبغ"}
              </div>
              {settings.storeAddress && (
                <div className="receipt__store-info">{settings.storeAddress}</div>
              )}
              {settings.storePhone && (
                <div className="receipt__store-info">{settings.storePhone}</div>
              )}
            </div>

            {/* Meta */}
            <div className="receipt__meta">
              <div>رقم الفاتورة: {transaction.id}</div>
              <div>التاريخ: {formatLocalGregorianDateTime(transaction.timestamp)}</div>
              {transaction.customer && <div>العميل: {transaction.customer.name}</div>}
            </div>

            {/* Items */}
            <div className="receipt__items">
              {transaction.items.map((item, index) => (
                <div key={index} className="receipt__item">
                  <span>
                    {item.name}
                    <span className="receipt__item-qty"> × {item.quantity}</span>
                  </span>
                  <span>{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="receipt__totals">
              <div className="receipt__total-row">
                <span>المجموع الفرعي</span>
                <span>
                  {transaction.subtotal.toFixed(2)} {settings.currency}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="receipt__total-row">
                  <span>
                    الخصم
                    {discountLabelSuffix}
                  </span>
                  <span>
                    -{discountAmount.toFixed(2)} {settings.currency}
                  </span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="receipt__total-row">
                  <span>الضريبة ({taxRate}%)</span>
                  <span>
                    {taxAmount.toFixed(2)} {settings.currency}
                  </span>
                </div>
              )}
              <div className="receipt__total-row receipt__total-row--grand">
                <span>الإجمالي</span>
                <span>
                  {transaction.total.toFixed(2)} {settings.currency}
                </span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="receipt__payment">
              <div className="receipt__total-row">
                <span>طريقة الدفع</span>
                <span>{paymentMethodLabels[transaction.payment.method]}</span>
              </div>
              {transaction.payment.method === "cash" && (
                <>
                  <div className="receipt__total-row">
                    <span>المبلغ المستلم</span>
                    <span>
                      {cashReceived.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                  <div className="receipt__total-row">
                    <span>الباقي</span>
                    <span>
                      {remainingAmount.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="receipt__footer">
              <p>شكراً لتسوقكم معنا</p>
              {settings.receiptFooter && <p>{settings.receiptFooter}</p>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
