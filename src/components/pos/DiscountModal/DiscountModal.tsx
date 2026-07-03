import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { IconCash, IconPrinter } from "../../ui/Icons";
import type { Discount } from "../../../app/pos/types";
import "./DiscountModal.css";

export interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  currency: string;
  currentDiscount: Discount | null;
  onApplyDiscount: (discount: Discount | null) => void;
  onPrintReceipt?: () => void;
}

function getInitialFixedDiscountValue(
  discount: Discount | null,
  subtotal: number,
): string {
  if (!discount) {
    return "";
  }

  const rawValue =
    discount.type === "percentage"
      ? (subtotal * Math.min(100, Math.max(0, discount.value))) / 100
      : discount.value;

  const fixedValue = Math.min(subtotal, Math.max(0, rawValue));
  return fixedValue > 0 ? fixedValue.toString() : "";
}

/**
 * Discount application modal.
 * Supports fixed amount discounts only.
 */
export function DiscountModal({
  isOpen,
  onClose,
  subtotal,
  currency,
  currentDiscount,
  onApplyDiscount,
  onPrintReceipt,
}: DiscountModalProps) {
  const [discountValue, setDiscountValue] = useState<string>(() =>
    getInitialFixedDiscountValue(currentDiscount, subtotal),
  );
  const [reason, setReason] = useState(currentDiscount?.reason || "");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDiscountValue(getInitialFixedDiscountValue(currentDiscount, subtotal));
    setReason(currentDiscount?.reason || "");
  }, [currentDiscount, isOpen, subtotal]);

  const numericValue = useMemo(() => {
    const num = parseFloat(discountValue);
    return isNaN(num) ? 0 : num;
  }, [discountValue]);

  const calculatedDiscount = useMemo(() => {
    if (numericValue <= 0) return 0;
    return Math.min(numericValue, subtotal);
  }, [numericValue, subtotal]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - calculatedDiscount);
  }, [subtotal, calculatedDiscount]);

  const isValid = useMemo(() => {
    if (numericValue <= 0) return false;
    if (numericValue > subtotal) return false;
    return true;
  }, [numericValue, subtotal]);

  const canPrintWithCurrentInput = useMemo(() => {
    if (subtotal <= 0) return false;
    if (numericValue <= 0) return true;
    return isValid;
  }, [isValid, numericValue, subtotal]);

  function handleRemove() {
    onApplyDiscount(null);
    onClose();
    resetForm();
  }

  function resetForm() {
    setDiscountValue("");
    setReason("");
  }

  function handleClose() {
    onClose();
    // Don't reset to preserve state if user reopens
  }

  function handleApplyAndPrint() {
    if (!canPrintWithCurrentInput) {
      return;
    }

    if (numericValue > 0) {
      const discount: Discount = {
        type: "fixed",
        value: numericValue,
        reason: reason.trim() || undefined,
      };
      onApplyDiscount(discount);
    } else {
      onApplyDiscount(null);
    }

    onClose();
    onPrintReceipt?.();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="تطبيق خصم"
      size="sm"
      footer={
        <div className="discount-modal__footer">
          {currentDiscount && (
            <Button variant="danger" onClick={handleRemove}>
              إزالة الخصم
            </Button>
          )}
          <div className="discount-modal__footer-end">
            <Button
              variant="secondary"
              className="pos-button--sell"
              onClick={handleApplyAndPrint}
              icon={<IconPrinter />}
              disabled={!canPrintWithCurrentInput}
            >
              بيع
            </Button>
            <Button variant="secondary" onClick={handleClose}>
              إلغاء
            </Button>
          </div>
        </div>
      }
    >
      <div className="discount-modal">
        {/* Subtotal Display */}
        <div className="discount-modal__subtotal">
          <span className="discount-modal__subtotal-label">المجموع الفرعي</span>
          <span className="discount-modal__subtotal-value">
            {subtotal.toFixed(2)} {currency}
          </span>
        </div>

        {/* Value Input */}
        <div className="discount-modal__value">
          <label className="discount-modal__label">مبلغ الخصم</label>
          <Input
            type="number"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder="0.00"
            fullWidth
            icon={<IconCash />}
            min={0}
            max={subtotal}
            step={0.01}
          />
        </div>

        {/* Reason */}
        <div className="discount-modal__reason">
          <label className="discount-modal__label">سبب الخصم (اختياري)</label>
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="عميل مميز، عرض خاص..."
            fullWidth
          />
        </div>

        {/* Preview */}
        {numericValue > 0 && (
          <div className="discount-modal__preview">
            <div className="discount-modal__preview-row">
              <span>قيمة الخصم</span>
              <span className="discount-modal__preview-discount">
                -{calculatedDiscount.toFixed(2)} {currency}
              </span>
            </div>
            <div className="discount-modal__preview-row discount-modal__preview-row--total">
              <span>المجموع بعد الخصم</span>
              <span className="discount-modal__preview-total">
                {finalTotal.toFixed(2)} {currency}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
