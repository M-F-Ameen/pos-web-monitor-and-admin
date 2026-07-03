import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { IconCash, IconPrinter } from "../../ui/Icons";
import "./PriceIncreaseModal.css";

export interface PriceIncreaseItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  increase: number;
}

export interface PriceIncreaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PriceIncreaseItem[];
  currency: string;
  cartIncreaseAmount: number;
  onPrintReceipt?: () => void;
  onApply: (
    increasesByProductId: Record<string, number>,
    cartIncreaseAmount: number,
  ) => void;
}

function parseIncrease(value: string): number {
  const normalizedValue = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/٫/g, ".")
    .replace(/,/g, ".");
  const parsed = Number.parseFloat(normalizedValue);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Per-item price increase modal.
 * Allows entering a fixed LE increase for each cart item and for the whole cart.
 */
export function PriceIncreaseModal({
  isOpen,
  onClose,
  items,
  currency,
  cartIncreaseAmount,
  onPrintReceipt,
  onApply,
}: PriceIncreaseModalProps) {
  const [increaseInputs, setIncreaseInputs] = useState<Record<string, string>>(
    {},
  );
  const [cartIncreaseInput, setCartIncreaseInput] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextInputs: Record<string, string> = {};
    items.forEach((item) => {
      nextInputs[item.productId] =
        item.increase > 0 ? item.increase.toString() : "";
    });
    setIncreaseInputs(nextInputs);
    setCartIncreaseInput(
      cartIncreaseAmount > 0 ? roundCurrency(cartIncreaseAmount).toString() : "",
    );
  }, [isOpen, items, cartIncreaseAmount]);

  const normalizedRows = useMemo(
    () =>
      items.map((item) => {
        const increase = parseIncrease(increaseInputs[item.productId] ?? "");
        const adjustedUnitPrice = roundCurrency(item.unitPrice + increase);
        return {
          ...item,
          increase,
          adjustedUnitPrice,
        };
      }),
    [increaseInputs, items],
  );

  const itemExtraTotal = useMemo(
    () =>
      roundCurrency(
        normalizedRows.reduce((sum, row) => sum + row.increase * row.quantity, 0),
      ),
    [normalizedRows],
  );

  const cartExtra = useMemo(
    () => roundCurrency(parseIncrease(cartIncreaseInput)),
    [cartIncreaseInput],
  );

  const extraTotal = useMemo(
    () => roundCurrency(itemExtraTotal + cartExtra),
    [cartExtra, itemExtraTotal],
  );

  const hasAnyIncrease =
    normalizedRows.some((row) => row.increase > 0) || cartExtra > 0;

  function buildNextIncreases(): Record<string, number> {
    const nextIncreases: Record<string, number> = {};
    items.forEach((item) => {
      const rawValue = increaseInputs[item.productId] ?? "";
      nextIncreases[item.productId] = roundCurrency(parseIncrease(rawValue));
    });
    return nextIncreases;
  }

  function handleApplyAndPrint() {
    if (items.length === 0) {
      return;
    }
    onApply(buildNextIncreases(), cartExtra);
    onClose();
    onPrintReceipt?.();
  }

  function handleReset() {
    const cleared: Record<string, string> = {};
    items.forEach((item) => {
      cleared[item.productId] = "";
    });
    setIncreaseInputs(cleared);
    setCartIncreaseInput("");
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="زيادة سعر الأصناف"
      size="lg"
      footer={
        <div className="price-increase-modal__footer">
          {hasAnyIncrease && (
            <Button variant="danger" onClick={handleReset}>
              إزالة الزيادات
            </Button>
          )}
          <div className="price-increase-modal__footer-end">
            <Button
              variant="secondary"
              className="pos-button--sell"
              onClick={handleApplyAndPrint}
              icon={<IconPrinter />}
              disabled={items.length === 0}
            >
              بيع
            </Button>
            <Button variant="secondary" onClick={onClose}>
              إلغاء
            </Button>
          </div>
        </div>
      }
    >
      <div className="price-increase-modal">
        {normalizedRows.length === 0 ? (
          <p className="price-increase-modal__empty">
            لا توجد أصناف في الطلب الحالي.
          </p>
        ) : (
          <>
            <div className="price-increase-modal__list">
              {normalizedRows.map((item) => (
                <div key={item.productId} className="price-increase-modal__row">
                  <div className="price-increase-modal__item-info">
                    <h4 className="price-increase-modal__item-name">{item.name}</h4>
                    <div className="price-increase-modal__item-meta">
                      <span>الكمية: {item.quantity}</span>
                      <span>
                        السعر الحالي: {item.unitPrice.toFixed(2)} {currency}
                      </span>
                      <span>
                        بعد الزيادة: {item.adjustedUnitPrice.toFixed(2)} {currency}
                      </span>
                    </div>
                  </div>
                  <label className="price-increase-modal__input-wrap">
                    <span className="price-increase-modal__input-label">
                      زيادة / وحدة
                    </span>
                    <div className="price-increase-modal__input-row">
                      <IconCash />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={increaseInputs[item.productId] ?? ""}
                        onChange={(event) =>
                          setIncreaseInputs((prev) => ({
                            ...prev,
                            [item.productId]: event.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className="price-increase-modal__input"
                        aria-label={`زيادة سعر ${item.name}`}
                      />
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="price-increase-modal__summary">
              <div className="price-increase-modal__summary-main">
                <span>إجمالي الزيادة</span>
                <strong>
                  {extraTotal.toFixed(2)} {currency}
                </strong>
              </div>
              <label className="price-increase-modal__summary-input-wrap">
                <span className="price-increase-modal__summary-input-label">
                  زيادة إجمالية
                </span>
                <div className="price-increase-modal__summary-input-row">
                  <IconCash />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cartIncreaseInput}
                    onChange={(event) => setCartIncreaseInput(event.target.value)}
                    placeholder="0.00"
                    className="price-increase-modal__summary-input"
                    aria-label="زيادة إجمالية على الفاتورة"
                  />
                </div>
              </label>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
