import { useEffect, useRef, useState } from "react";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import {
  IconTrash,
  IconPrinter,
  IconArrowRight,
  IconUser,
  IconUndo,
  IconPercent,
  IconCash,
} from "../../ui/Icons";
import { CartItem } from "../../pos/CartItem";
import type { CartItemProps } from "../../pos/CartItem";
import "./OrderPanel.css";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

function splitMoneyParts(value: string): { currency: string; amount: string } {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return { currency: "", amount: value.trim() };
  }

  const amount = match[0];
  const currency = value.replace(amount, "").trim();
  return { currency, amount };
}

export type OrderType = "takeaway" | "dinein" | "delivery";

export interface OrderSummaryLine {
  label: string;
  value: string;
}

export interface SelectedCustomer {
  name: string;
  phone?: string;
}

export interface OrderPanelProps {
  /** Active order type tab */
  orderType?: OrderType;
  /** Tab change handler */
  onOrderTypeChange?: (type: OrderType) => void;
  /** Cart/order line items */
  items?: CartItemProps[];
  /** Subtotal, tax, discount, total */
  subtotal?: string;
  discount?: string;
  total: string;
  /** Clear all items */
  onClearAll?: () => void;
  /** Print receipt */
  onPrintReceipt?: () => void;
  /** Proceed to checkout */
  onProceed?: () => void;
  /** Process return for current cart items */
  onReturn?: () => void;
  /** Disable return action */
  disableReturn?: boolean;
  /** Open customer selection modal */
  onCustomerClick?: () => void;
  /** Open discount modal */
  onDiscountClick?: () => void;
  /** Open per-item price increase modal */
  onPriceIncreaseClick?: () => void;
  /** Whether a discount is currently applied */
  hasDiscount?: boolean;
  /** Whether any price increase is currently applied */
  hasPriceIncrease?: boolean;
  /** Currently selected customer */
  selectedCustomer?: SelectedCustomer | null;
}

/**
 * Order summary / cart panel.
 * RTL: panel on logical start (left in RTL).
 */
export function OrderPanel({
  orderType: _orderType = "takeaway",
  onOrderTypeChange: _onOrderTypeChange,
  items = [],
  subtotal = "0.00 LE",
  discount = "0.00 LE",
  total = "0.00 LE",
  onClearAll,
  onPrintReceipt,
  onProceed,
  onReturn,
  disableReturn = false,
  onCustomerClick,
  onDiscountClick,
  onPriceIncreaseClick,
  hasDiscount = false,
  hasPriceIncrease = false,
  selectedCustomer,
}: OrderPanelProps) {
  const subtotalParts = splitMoneyParts(subtotal);
  const discountParts = splitMoneyParts(discount);
  const totalParts = splitMoneyParts(total);
  const discountValue = parseFloat(discountParts.amount) || 0;

  // Cash-change calculator
  const [cashReceived, setCashReceived] = useState("");
  const cashInputRef = useRef<HTMLInputElement>(null);

  const totalNumeric = parseFloat(totalParts.amount) || 0;
  const cashNumeric = parseFloat(cashReceived) || 0;
  const change = cashNumeric - totalNumeric;
  const hasChange = cashReceived !== "" && cashNumeric > 0;
  const hasItems = items.length > 0;

  // Reset cash field when cart is cleared
  useEffect(() => {
    if (!hasItems) setCashReceived("");
  }, [hasItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (document.querySelector(".pos-modal-backdrop")) {
        return;
      }

      if (event.key === "F8") {
        event.preventDefault();
        // F8 = sell as cash and print receipt (no payment modal)
        onPrintReceipt?.();
        return;
      }

      if (event.key === "F9") {
        event.preventDefault();
        onProceed?.();
        return;
      }

      if (event.key === "F10") {
        event.preventDefault();
        if (!disableReturn) {
          onReturn?.();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [disableReturn, onPrintReceipt, onProceed, onReturn]);

  return (
    <aside
      className="pos-order-panel"
      role="complementary"
      aria-label="ملخص الطلب"
    >
      <Card padding="none" className="pos-order-panel__card">
        {/* Customer + Discount quick actions */}
        <div className="pos-order-panel__quick-actions">
          <button
            type="button"
            className={`pos-order-panel__quick-btn ${selectedCustomer ? "pos-order-panel__quick-btn--active" : ""}`}
            onClick={onCustomerClick}
          >
            <IconUser />
            <span>{selectedCustomer ? selectedCustomer.name : "إضافة عميل"}</span>
          </button>
          <button
            type="button"
            className={`pos-order-panel__quick-btn ${hasDiscount ? "pos-order-panel__quick-btn--active" : ""}`}
            onClick={onDiscountClick}
            disabled={!hasItems}
          >
            <IconPercent />
            <span>{hasDiscount ? "تم تطبيق الخصم" : "إضافة خصم"}</span>
          </button>
          <button
            type="button"
            className={`pos-order-panel__quick-btn ${hasPriceIncrease ? "pos-order-panel__quick-btn--active" : ""}`}
            onClick={onPriceIncreaseClick}
            disabled={!hasItems}
          >
            <IconCash />
            <span>{hasPriceIncrease ? "تمت زيادة السعر" : "زيادة سعر"}</span>
          </button>
        </div>

        <div className="pos-order-panel__items-section">
          <div className="pos-order-panel__items-header">
            <h2 className="pos-order-panel__items-title">العناصر</h2>
            {items.length > 0 && (
              <button
                type="button"
                className="pos-order-panel__clear"
                onClick={onClearAll}
                aria-label="مسح الكل"
              >
                <IconTrash />
                مسح الكل
              </button>
            )}
          </div>
          <div className="pos-order-panel__items-list" role="list">
            {items.length === 0 ? (
              <p className="pos-order-panel__empty">لا توجد عناصر في الطلب</p>
            ) : (
              items.map((item, index) => <CartItem key={index} {...item} />)
            )}
          </div>
        </div>
        <div className="pos-order-panel__summary">
          <div className="pos-order-panel__summary-row">
            <span>المجموع الفرعي</span>
            <span className="pos-order-panel__money">
              {subtotalParts.currency && (
                <span className="pos-order-panel__money-currency">
                  {subtotalParts.currency}
                </span>
              )}
              <span className="pos-order-panel__money-value">
                {subtotalParts.amount}
              </span>
            </span>
          </div>
          {discountValue > 0 && (
            <div className="pos-order-panel__summary-row pos-order-panel__summary-row--discount">
              <span>الخصم</span>
              <span className="pos-order-panel__money">
                {discountParts.currency && (
                  <span className="pos-order-panel__money-currency">
                    {discountParts.currency}
                  </span>
                )}
                <span className="pos-order-panel__money-value">
                  -{Math.abs(discountValue).toFixed(2)}
                </span>
              </span>
            </div>
          )}
          <div className="pos-order-panel__summary-row pos-order-panel__summary-row--total">
            <span>الإجمالي</span>
            <span className="pos-order-panel__money">
              {totalParts.currency && (
                <span className="pos-order-panel__money-currency">
                  {totalParts.currency}
                </span>
              )}
              <span className="pos-order-panel__money-value">
                {totalParts.amount}
              </span>
            </span>
          </div>

          {/* Cash-change calculator */}
          {hasItems && (
            <div className="pos-order-panel__cash-calc">
              <div className="pos-order-panel__cash-row">
                <label
                  htmlFor="cash-received-input"
                  className="pos-order-panel__cash-label"
                >
                  المبلغ المستلم
                </label>
                <input
                  ref={cashInputRef}
                  id="cash-received-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="pos-order-panel__cash-input"
                  aria-label="المبلغ المستلم من العميل"
                />
              </div>
              {hasChange && (
                <div
                  className={`pos-order-panel__change-row ${
                    change >= 0
                      ? "pos-order-panel__change-row--ok"
                      : "pos-order-panel__change-row--short"
                  }`}
                >
                  <span className="pos-order-panel__change-label">
                    {change >= 0 ? "الباقي" : "ناقص"}
                  </span>
                  <span className="pos-order-panel__change-amount">
                    {totalParts.currency && (
                      <span className="pos-order-panel__money-currency">
                        {totalParts.currency}
                      </span>
                    )}
                    <span className="pos-order-panel__money-value">
                      {Math.abs(change).toFixed(2)}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="pos-order-panel__actions">
          <div className="pos-order-panel__action">
            <Button
              variant="secondary"
              className="pos-button--sell"
              icon={<IconPrinter />}
              fullWidth
              onClick={onPrintReceipt}
              title="F8"
              aria-keyshortcuts="F8"
            >
              بيع
            </Button>
            <kbd className="pos-order-panel__shortcut-key" aria-hidden="true">
              F8
            </kbd>
          </div>
          <div className="pos-order-panel__action">
            <Button
              variant="danger"
              icon={<IconUndo />}
              fullWidth
              onClick={onReturn}
              disabled={disableReturn}
              title="F10"
              aria-keyshortcuts="F10"
            >
              مرتجع
            </Button>
            <kbd
              className={
                disableReturn
                  ? "pos-order-panel__shortcut-key pos-order-panel__shortcut-key--disabled"
                  : "pos-order-panel__shortcut-key"
              }
              aria-hidden="true"
            >
              F10
            </kbd>
          </div>
          <div className="pos-order-panel__action">
            <Button
              variant="primary"
              icon={<IconArrowRight />}
              fullWidth
              onClick={onProceed}
              title="F9"
              aria-keyshortcuts="F9"
            >
              متابعة
            </Button>
            <kbd className="pos-order-panel__shortcut-key" aria-hidden="true">
              F9
            </kbd>
          </div>
        </div>
      </Card>
    </aside>
  );
}
