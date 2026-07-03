import { useState } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import type { Sale } from "../../../services/db";
import "./ReturnConfirmModal.css";

export interface ReturnConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  sale: Sale | null;
}

/**
 * Modal to confirm return of a sale
 */
export function ReturnConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  sale,
}: ReturnConfirmModalProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (!reason.trim()) {
      alert("الرجاء إدخال سبب المرتجع");
      return;
    }
    onConfirm(reason);
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  if (!sale) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="تأكيد المرتجع">
      <div className="return-confirm-modal">
        <div className="return-confirm-modal__info">
          <p className="return-confirm-modal__label">رقم الإيصال:</p>
          <p className="return-confirm-modal__value">{sale.receiptNumber}</p>
        </div>

        <div className="return-confirm-modal__info">
          <p className="return-confirm-modal__label">العميل:</p>
          <p className="return-confirm-modal__value">
            {sale.customerName || "غير محدد"}
          </p>
        </div>

        <div className="return-confirm-modal__info">
          <p className="return-confirm-modal__label">الإجمالي:</p>
          <p className="return-confirm-modal__value">
            {sale.total.toFixed(2)} LE
          </p>
        </div>

        <div className="return-confirm-modal__info">
          <p className="return-confirm-modal__label">عدد المنتجات:</p>
          <p className="return-confirm-modal__value">
            {sale.items?.length ?? 0} منتج
          </p>
        </div>

        <div className="return-confirm-modal__products">
          <p className="return-confirm-modal__label">المنتجات:</p>
          <ul className="return-confirm-modal__products-list">
            {sale.items?.map((item, index) => (
              <li key={index}>
                {item.productName} - الكمية: {item.quantity} - السعر:{" "}
                {item.subtotal.toFixed(2)} LE
              </li>
            ))}
          </ul>
        </div>

        <div className="return-confirm-modal__reason">
          <label htmlFor="return-reason">سبب المرتجع:</label>
          <Input
            id="return-reason"
            type="text"
            placeholder="مثال: منتج تالف، طلب خاطئ..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          />
        </div>

        <div className="return-confirm-modal__warning">
          <p>
            ⚠️ سيتم تحويل هذه المبيعة إلى مرتجع وإضافتها إلى صفحة المرتجعات.
            سيتم استرجاع الكمية إلى المخزون.
          </p>
        </div>

        <div className="return-confirm-modal__actions">
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            fullWidth
          >
            تأكيد المرتجع
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            fullWidth
          >
            إلغاء
          </Button>
        </div>
      </div>
    </Modal>
  );
}
