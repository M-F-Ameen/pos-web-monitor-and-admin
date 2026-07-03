import { useState, useMemo } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import {
  IconCash,
  IconCreditCard,
  IconWallet,
  IconCheckCircle,
} from "../../ui/Icons";
import type { PaymentMethod, PaymentInfo } from "../../../app/pos/types";
import "./PaymentModal.css";

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  currency: string;
  allowPartialCashPayment?: boolean;
  onProcessPayment: (paymentInfo: PaymentInfo) => boolean | Promise<boolean>;
}

const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "cash", label: "نقدي", icon: <IconCash /> },
  { id: "card", label: "بطاقة", icon: <IconCreditCard /> },
  { id: "wallet", label: "محفظة", icon: <IconWallet /> },
];

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

/**
 * Payment processing modal.
 * Handles cash (with change calculation), card, and wallet payments.
 */
export function PaymentModal({
  isOpen,
  onClose,
  total,
  currency,
  allowPartialCashPayment = false,
  onProcessPayment,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [reference, setReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const receivedNumber = useMemo(() => {
    const num = parseFloat(receivedAmount);
    return isNaN(num) ? 0 : num;
  }, [receivedAmount]);

  const change = useMemo(() => {
    if (paymentMethod !== "cash") return 0;
    return Math.max(0, receivedNumber - total);
  }, [paymentMethod, receivedNumber, total]);

  const canProceed = useMemo(() => {
    if (paymentMethod === "cash") {
      if (!receivedAmount.trim()) {
        return false;
      }

      if (receivedNumber >= total) {
        return true;
      }

      return allowPartialCashPayment && receivedNumber >= 0;
    }
    return true;
  }, [
    allowPartialCashPayment,
    paymentMethod,
    receivedAmount,
    receivedNumber,
    total,
  ]);

  const remainingAmount = useMemo(
    () => Math.max(0, total - receivedNumber),
    [receivedNumber, total],
  );
  const isPartialCashPayment =
    paymentMethod === "cash" &&
    receivedAmount.trim() !== "" &&
    receivedNumber < total;

  function handleQuickAmount(amount: number) {
    setReceivedAmount((prev) => {
      const current = parseFloat(prev) || 0;
      return (current + amount).toString();
    });
  }

  function handleExactAmount() {
    setReceivedAmount(total.toString());
  }

  function handleClearAmount() {
    setReceivedAmount("");
  }

  async function handleSubmit() {
    if (!canProceed || isProcessing) return;

    setIsProcessing(true);

    const paymentInfo: PaymentInfo = {
      method: paymentMethod,
      amount: total,
      received: paymentMethod === "cash" ? Math.max(0, receivedNumber) : undefined,
      change: paymentMethod === "cash" ? change : undefined,
      reference: paymentMethod !== "cash" ? reference : undefined,
    };

    try {
      // Simulate processing delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const didSucceed = await Promise.resolve(onProcessPayment(paymentInfo));
      if (!didSucceed) {
        return;
      }

      setPaymentMethod("cash");
      setReceivedAmount("");
      setReference("");
    } catch (error) {
      console.error("Failed to process payment:", error);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleClose() {
    if (!isProcessing) {
      onClose();
      setPaymentMethod("cash");
      setReceivedAmount("");
      setReference("");
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="إتمام الدفع"
      size="md"
      closeOnBackdrop={!isProcessing}
      closeOnEscape={!isProcessing}
      footer={
        <div className="payment-modal__footer">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isProcessing}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canProceed}
            loading={isProcessing}
            loadingText="جاري المعالجة..."
            icon={<IconCheckCircle />}
          >
            تأكيد الدفع
          </Button>
        </div>
      }
    >
      <div className="payment-modal">
        {/* Total Display */}
        <div className="payment-modal__total">
          <span className="payment-modal__total-label">المبلغ المطلوب</span>
          <span className="payment-modal__total-value">
            {total.toFixed(2)} {currency}
          </span>
        </div>

        {/* Payment Method Selection */}
        <div className="payment-modal__methods">
          <label className="payment-modal__label">طريقة الدفع</label>
          <div className="payment-modal__method-buttons">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                className={`payment-modal__method-btn ${
                  paymentMethod === method.id
                    ? "payment-modal__method-btn--active"
                    : ""
                }`}
                onClick={() => setPaymentMethod(method.id)}
                disabled={isProcessing}
              >
                {method.icon}
                <span>{method.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cash Payment */}
        {paymentMethod === "cash" && (
          <div className="payment-modal__cash">
            <label className="payment-modal__label">المبلغ المستلم</label>
            <Input
              type="number"
              value={receivedAmount}
              onChange={(e) => setReceivedAmount(e.target.value)}
              placeholder="0.00"
              fullWidth
              disabled={isProcessing}
              min={0}
              step={0.01}
            />

            {/* Quick Amount Buttons */}
            <div className="payment-modal__quick-amounts">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="payment-modal__quick-btn"
                  onClick={() => handleQuickAmount(amount)}
                  disabled={isProcessing}
                >
                  +{amount}
                </button>
              ))}
            </div>

            <div className="payment-modal__amount-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExactAmount}
                disabled={isProcessing}
              >
                المبلغ بالضبط
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAmount}
                disabled={isProcessing}
              >
                مسح
              </Button>
            </div>

            {/* Change Display */}
            {receivedAmount.trim() !== "" && (
              <div
                className={`payment-modal__change ${
                  receivedNumber >= total
                    ? "payment-modal__change--success"
                    : "payment-modal__change--warning"
                }`}
              >
                <span className="payment-modal__change-label">
                  {receivedNumber >= total ? "الباقي" : "المبلغ الناقص"}
                </span>
                <span className="payment-modal__change-value">
                  {receivedNumber >= total
                    ? change.toFixed(2)
                    : remainingAmount.toFixed(2)}{" "}
                  {currency}
                </span>
              </div>
            )}

            {isPartialCashPayment && allowPartialCashPayment && (
              <p className="payment-modal__debt-note">
                سيتم تسجيل المتبقي ({remainingAmount.toFixed(2)} {currency})
                كمديونية على العميل المحدد.
              </p>
            )}

            {isPartialCashPayment && !allowPartialCashPayment && (
              <p className="payment-modal__debt-note payment-modal__debt-note--warning">
                الدفع الجزئي متاح فقط عند اختيار عميل.
              </p>
            )}
          </div>
        )}

        {/* Card/Wallet Payment */}
        {paymentMethod !== "cash" && (
          <div className="payment-modal__card">
            <label className="payment-modal__label">رقم المرجع (اختياري)</label>
            <Input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="رقم العملية أو المرجع"
              fullWidth
              disabled={isProcessing}
            />
            <p className="payment-modal__hint">
              {paymentMethod === "card"
                ? "قم بتمرير البطاقة على جهاز الدفع"
                : "قم بإتمام الدفع عبر تطبيق المحفظة"}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
