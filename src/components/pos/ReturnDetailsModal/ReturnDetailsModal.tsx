import { useEffect, useState, useRef } from "react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { IconPrint, IconUndo } from "../../ui/Icons";
import type { Return, Sale } from "../../../services/db";
import { sales as salesService } from "../../../services/db";
import "./ReturnDetailsModal.css";

export interface ReturnDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnData: Return | null;
}

const STATUS_LABELS: Record<Return["status"], string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

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
 * Modal to view return details in receipt format
 */
export function ReturnDetailsModal({
  isOpen,
  onClose,
  returnData,
}: ReturnDetailsModalProps) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadSaleDetails() {
      if (!returnData?.saleId) {
        setSale(null);
        return;
      }

      setLoading(true);
      try {
        const saleData = await salesService.getById(returnData.saleId);
        setSale(saleData);
      } catch (error) {
        console.error("Failed to load sale details:", error);
        setSale(null);
      } finally {
        setLoading(false);
      }
    }

    if (isOpen && returnData) {
      loadSaleDetails();
    }
  }, [isOpen, returnData]);

  function handlePrint() {
    if (!receiptRef.current) return;

    const printWindow = window.open("", "_blank", "width=300,height=600");
    if (!printWindow) return;

    const styles = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.4;
          padding: 10px;
          direction: rtl;
        }
        .receipt {
          width: 100%;
          max-width: 280px;
          margin: 0 auto;
        }
        .receipt__header {
          text-align: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px dashed #000;
        }
        .receipt__store-name {
          font-size: 16px;
          font-weight: bold;
        }
        .receipt__badge {
          display: inline-block;
          padding: 4px 12px;
          margin: 8px 0;
          background-color: #f44336;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        .receipt__meta {
          margin-bottom: 10px;
          font-size: 10px;
        }
        .receipt__items {
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px dashed #000;
        }
        .receipt__item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .receipt__item-qty {
          color: #666;
        }
        .receipt__section {
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px dashed #000;
        }
        .receipt__section-title {
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 13px;
        }
        .receipt__row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
          font-size: 11px;
        }
        .receipt__footer {
          text-align: center;
          font-size: 10px;
        }
        @media print {
          @page { margin: 0; }
          body { margin: 1cm; }
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>إيصال مرتجع</title>
          ${styles}
        </head>
        <body>
          ${receiptRef.current.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  if (!returnData) return null;

  const paymentMethodLabels: Record<string, string> = {
    cash: "نقدي",
    card: "بطاقة",
    wallet: "محفظة",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="إيصال المرتجع"
      size="sm"
      footer={
        <div className="return-details-modal__footer">
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
          <Button variant="primary" onClick={handlePrint} icon={<IconPrint />}>
            طباعة
          </Button>
        </div>
      }
    >
      <div className="return-details-modal">
        {/* Return Badge */}
        <div className="return-details-modal__badge">
          <IconUndo />
          <span>مرتجع - {STATUS_LABELS[returnData.status]}</span>
        </div>

        {/* Receipt Preview */}
        <div className="return-details-modal__preview" ref={receiptRef}>
          {loading ? (
            <div className="receipt__loading">جاري التحميل...</div>
          ) : (
            <div className="receipt">
              {/* Header */}
              <div className="receipt__header">
                <div className="receipt__store-name">إيصال مرتجع</div>
                <div className="receipt__badge">مرتجع</div>
              </div>

              {/* Return Meta */}
              <div className="receipt__meta">
                <div>رقم المرتجع: {returnData.returnNumber}</div>
                <div>
                  تاريخ المرتجع:{" "}
                  {formatLocalGregorianDateTime(returnData.createdAt)}
                </div>
                {sale && <div>رقم الفاتورة الأصلية: {sale.receiptNumber}</div>}
                {sale && sale.customerName && (
                  <div>العميل: {sale.customerName}</div>
                )}
              </div>

              {/* Original Invoice Items */}
              {sale && sale.items && sale.items.length > 0 && (
                <div className="receipt__section">
                  <div className="receipt__section-title">
                    المنتجات - الفاتورة الأصلية
                  </div>
                  <div className="receipt__items">
                    {sale.items.map((item, index) => (
                      <div key={index} className="receipt__item">
                        <span>
                          {item.productName}
                          <span className="receipt__item-qty">
                            {" "}
                            × {item.quantity}
                          </span>
                        </span>
                        <span>{item.subtotal.toFixed(2)} LE</span>
                      </div>
                    ))}
                  </div>
                  <div className="receipt__row">
                    <span>إجمالي الفاتورة الأصلية</span>
                    <span>{sale.total.toFixed(2)} LE</span>
                  </div>
                  {sale.paymentMethod && (
                    <div className="receipt__row">
                      <span>طريقة الدفع</span>
                      <span>{paymentMethodLabels[sale.paymentMethod]}</span>
                    </div>
                  )}
                  {sale.createdAt && (
                    <div className="receipt__row">
                      <span>تاريخ الفاتورة الأصلية</span>
                      <span>{sale.createdAt.slice(0, 10)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Return Details */}
              <div className="receipt__section">
                <div className="receipt__section-title">تفاصيل المرتجع</div>
                <div className="receipt__row">
                  <span>المنتج المرتجع</span>
                  <span>{returnData.productName}</span>
                </div>
                <div className="receipt__row">
                  <span>الكمية المرتجعة</span>
                  <span>{returnData.quantity}</span>
                </div>
                <div className="receipt__row">
                  <span>مبلغ الاسترجاع</span>
                  <span style={{ fontWeight: "bold", fontSize: "13px" }}>
                    {returnData.refundAmount.toFixed(2)} LE
                  </span>
                </div>
                {returnData.reason && (
                  <div className="receipt__row">
                    <span>السبب</span>
                    <span>{returnData.reason}</span>
                  </div>
                )}
                {returnData.processedBy && (
                  <div className="receipt__row">
                    <span>معالج بواسطة</span>
                    <span>{returnData.processedBy}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="receipt__footer">
                <p>شكراً لتفهمكم</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
