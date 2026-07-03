import type { Customer, Discount, PaymentInfo, POSSettings, Transaction } from "../../app/pos/types";
import { CustomerModal } from "../../components/pos/CustomerModal";
import { DiscountModal } from "../../components/pos/DiscountModal";
import { PaymentModal } from "../../components/pos/PaymentModal";
import { PriceIncreaseModal } from "../../components/pos/PriceIncreaseModal";
import type { PriceIncreaseItem } from "../../components/pos/PriceIncreaseModal/PriceIncreaseModal";
import { ReceiptModal } from "../../components/pos/ReceiptModal";
import { Button } from "../../components/ui/Button";
import { IconCheck, IconUndo } from "../../components/ui/Icons";
import { Modal } from "../../components/ui/Modal";
import type { ReceiptPrintResult } from "../../services/db";

interface ReceiptPrintNotice {
  type: "warning" | "error";
  text: string;
}

interface POSPageOverlaysProps {
  allowPartialCashPayment: boolean;
  cartItemCount: number;
  currentDiscount: Discount | null;
  customerList: Customer[];
  currency: string;
  customerModalOpen: boolean;
  customerLoading: boolean;
  discountModalOpen: boolean;
  onAddCustomer: (customer: Omit<Customer, "id">) => void | Promise<void>;
  onApplyDiscount: (discount: Discount | null) => void;
  onApplyPriceIncreases: (
    increasesByProductId: Record<string, number>,
    cartIncreaseAmount: number,
  ) => void;
  onCloseCustomerModal: () => void;
  onCloseDiscountModal: () => void;
  onClosePaymentModal: () => void;
  onClosePriceIncreaseModal: () => void;
  onCloseReceiptModal: () => void;
  onCloseReturnConfirm: () => void;
  onConfirmReturn: () => void | Promise<void>;
  onPrintResult: (result: ReceiptPrintResult) => void;
  onProcessPayment: (paymentInfo: PaymentInfo) => boolean | Promise<boolean>;
  onQueueQuickPrintReceipt: () => void;
  onSelectCustomer: (customer: Customer | null) => void;
  paymentModalOpen: boolean;
  posSettings: POSSettings;
  priceIncreaseItems: PriceIncreaseItem[];
  priceIncreaseModalOpen: boolean;
  receiptModalOpen: boolean;
  receiptPrintNotice: ReceiptPrintNotice | null;
  returnConfirmOpen: boolean;
  returnSuccessPopupKey: number;
  returnTotalLabel: string;
  saleSuccessPopupKey: number;
  selectedCustomer: Customer | null;
  selectedTransaction: Transaction | null;
  showReturnSuccessPopup: boolean;
  showSaleSuccessPopup: boolean;
  subtotalValue: number;
  totalValue: number;
  cartIncreaseAmount: number;
  processingReturn: boolean;
}

export function POSPageOverlays({
  allowPartialCashPayment,
  cartItemCount,
  currentDiscount,
  customerList,
  currency,
  customerModalOpen,
  customerLoading,
  discountModalOpen,
  onAddCustomer,
  onApplyDiscount,
  onApplyPriceIncreases,
  onCloseCustomerModal,
  onCloseDiscountModal,
  onClosePaymentModal,
  onClosePriceIncreaseModal,
  onCloseReceiptModal,
  onCloseReturnConfirm,
  onConfirmReturn,
  onPrintResult,
  onProcessPayment,
  onQueueQuickPrintReceipt,
  onSelectCustomer,
  paymentModalOpen,
  posSettings,
  priceIncreaseItems,
  priceIncreaseModalOpen,
  receiptModalOpen,
  receiptPrintNotice,
  returnConfirmOpen,
  returnSuccessPopupKey,
  returnTotalLabel,
  saleSuccessPopupKey,
  selectedCustomer,
  selectedTransaction,
  showReturnSuccessPopup,
  showSaleSuccessPopup,
  subtotalValue,
  totalValue,
  cartIncreaseAmount,
  processingReturn,
}: POSPageOverlaysProps) {
  return (
    <>
      <Modal
        isOpen={returnConfirmOpen}
        onClose={onCloseReturnConfirm}
        closeOnBackdrop={!processingReturn}
        closeOnEscape={!processingReturn}
        size="sm"
        title="تأكيد المرتجع"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onCloseReturnConfirm}
              disabled={processingReturn}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void onConfirmReturn()}
              loading={processingReturn}
              loadingText="جارٍ تنفيذ المرتجع..."
            >
              تأكيد المرتجع
            </Button>
          </>
        }
      >
        <p>سيتم تسجيل كل منتجات السلة الحالية كمرتجع مع إعادة الكمية للمخزون.</p>
        <p>
          عدد الأصناف: <strong>{cartItemCount}</strong>
        </p>
        <p>
          قيمة المرتجع الإجمالية: <strong>{returnTotalLabel}</strong>
        </p>
      </Modal>

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={onClosePaymentModal}
        total={totalValue}
        currency={currency}
        allowPartialCashPayment={allowPartialCashPayment}
        onProcessPayment={onProcessPayment}
      />

      <CustomerModal
        isOpen={customerModalOpen}
        onClose={onCloseCustomerModal}
        customers={customerList}
        isLoading={customerLoading}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={onSelectCustomer}
        onAddCustomer={onAddCustomer}
      />

      <DiscountModal
        isOpen={discountModalOpen}
        onClose={onCloseDiscountModal}
        subtotal={subtotalValue}
        currency={currency}
        currentDiscount={currentDiscount}
        onApplyDiscount={onApplyDiscount}
        onPrintReceipt={onQueueQuickPrintReceipt}
      />

      <PriceIncreaseModal
        isOpen={priceIncreaseModalOpen}
        onClose={onClosePriceIncreaseModal}
        currency={currency}
        items={priceIncreaseItems}
        cartIncreaseAmount={cartIncreaseAmount}
        onPrintReceipt={onQueueQuickPrintReceipt}
        onApply={onApplyPriceIncreases}
      />

      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={onCloseReceiptModal}
        transaction={selectedTransaction}
        settings={posSettings}
        onPrintResult={onPrintResult}
      />

      {showSaleSuccessPopup && (
        <div
          key={saleSuccessPopupKey}
          className="pos-page__sale-success"
          role="status"
          aria-live="polite"
        >
          <div className="pos-page__sale-success-card">
            <span className="pos-page__sale-success-icon" aria-hidden>
              <IconCheck />
            </span>
            <span className="pos-page__sale-success-text">
              تمت عملية البيع بنجاح
            </span>
          </div>
        </div>
      )}

      {showReturnSuccessPopup && (
        <div
          key={returnSuccessPopupKey}
          className="pos-page__sale-success"
          role="status"
          aria-live="polite"
        >
          <div className="pos-page__sale-success-card">
            <span className="pos-page__sale-success-icon" aria-hidden>
              <IconUndo />
            </span>
            <span className="pos-page__sale-success-text">
              تمت عملية المرتجع بنجاح
            </span>
          </div>
        </div>
      )}

      {receiptPrintNotice && (
        <div
          className={`pos-page__print-notice pos-page__print-notice--${receiptPrintNotice.type}`}
          role={receiptPrintNotice.type === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {receiptPrintNotice.text}
        </div>
      )}
    </>
  );
}
