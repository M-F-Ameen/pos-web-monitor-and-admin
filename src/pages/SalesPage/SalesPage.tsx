import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { TablePagination } from "../../components/ui/TablePagination";
import {
  IconGrid,
  IconUndo,
  IconSearch,
  IconPlus,
  IconEye,
  IconPrinter,
} from "../../components/ui/Icons";
import { isAppPage } from "../../app/access";
import { buildSidebarNavItems } from "../../app/appSidebarNav";
import { useAuth } from "../../app/AuthContext";
import {
  sales as salesService,
  settings as settingsService,
  returns as returnsService,
  reports as reportsService,
} from "../../services/db";
import type { Sale, Return, PaymentMethod } from "../../services/db";
import { ReceiptModal } from "../../components/pos/ReceiptModal";
import { ReturnConfirmModal } from "../../components/pos/ReturnConfirmModal";
import type { Transaction, POSSettings } from "../../app/pos/types";
import { printDailySalesReceipt } from "../../services/receiptPrinter";
import "../InventoryPage/InventoryPage.css";
import "./SalesPage.css";

const RETURN_STATUS_LABELS: Record<Return["status"], string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

type SalesTableRow =
  | {
      kind: "sale";
      id: string;
      createdAt: string;
      sale: Sale;
    }
  | {
      kind: "return";
      id: string;
      createdAt: string;
      returnRecord: Return;
    };

interface SaleForm {
  receiptNumber: string;
  customerName: string;
  itemsCount: string;
  totalAmount: string;
  paymentMethod: PaymentMethod;
  soldAt: string;
}

const EMPTY_FORM: SaleForm = {
  receiptNumber: "",
  customerName: "",
  itemsCount: "",
  totalAmount: "",
  paymentMethod: "cash",
  soldAt: "",
};
const ITEMS_PER_PAGE = 13;

function todayDateValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleDateString("ar-EG");
}

function toTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SalesPage() {
  const navigate = useNavigate();
  const { role, user: authUser, logout } = useAuth();
  const canManage = role === "admin";
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tableRows, setTableRows] = useState<SalesTableRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRevenue, setTotalRevenue] = useState("0.00");
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [form, setForm] = useState<SaleForm>({
    ...EMPTY_FORM,
    soldAt: todayDateValue(),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [posSettings, setPosSettings] = useState<POSSettings>({
    storeName: "متجر التبغ",
    currency: "LE",
    taxRate: 0,
  });
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [saleForReturn, setSaleForReturn] = useState<Sale | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPrintingTodayReceipt, setIsPrintingTodayReceipt] = useState(false);
  const [pageMessage, setPageMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoadingRows(true);
    try {
      const result = await salesService.listTimelinePaged({
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        search: debouncedSearch || undefined,
        includeSaleItems: true,
        ...(role !== "admin" && authUser?.id ? { cashierId: authUser.id } : {}),
      });
      setTableRows(result.items as SalesTableRow[]);
      setTotalRows(result.total);
      setTotalPages(result.totalPages);
    } catch (loadError) {
      console.error("Failed to load sales timeline:", loadError);
      setPageMessage({
        type: "error",
        text: "تعذر تحميل سجل المبيعات.",
      });
    } finally {
      setIsLoadingRows(false);
    }
  }, [currentPage, debouncedSearch, role, authUser?.id]);

  const loadSummary = useCallback(async () => {
    try {
      const revenue = await reportsService.getNetRevenue();
      setTotalRevenue(revenue.netRevenue.toFixed(2));
    } catch (summaryError) {
      console.error("Failed to load sales summary:", summaryError);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await settingsService.get();
      setPosSettings({
        storeName: settings.storeName || "متجر التبغ",
        storeAddress: settings.storeAddress,
        storePhone: settings.storePhone,
        currency: settings.currency || "LE",
        taxRate: 0,
        receiptFooter: settings.receiptFooter,
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([loadRows(), loadSummary()]);
  }, [loadRows, loadSummary]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  useEffect(() => {
    void loadSettings();
    void loadSummary();
  }, [loadSettings, loadSummary]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!pageMessage) return;
    const timeoutId = window.setTimeout(() => setPageMessage(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [pageMessage]);

  function handleChange(field: keyof SaleForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (error) {
      setError("");
    }
  }

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      soldAt: todayDateValue(),
    });
    setEditingId(null);
    setError("");
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function convertSaleToTransaction(sale: Sale): Transaction {
    const discountType =
      sale.discountType === "percentage" || sale.discountType === "fixed"
        ? sale.discountType
        : undefined;

    return {
      id: sale.receiptNumber,
      receiptNumber: sale.receiptNumber,
      timestamp: sale.createdAt,
      items: sale.items.map((item) => ({
        productId: item.productId,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
      })),
      subtotal: sale.subtotal,
      taxRate: sale.taxRate,
      taxAmount: sale.taxAmount,
      discount: discountType
        ? {
            type: discountType,
            value: sale.discountValue,
          }
        : undefined,
      discountAmount: sale.discountAmount,
      total: sale.total,
      payment: {
        method: sale.paymentMethod,
        amount: sale.total,
        received: sale.amountReceived,
        change: sale.changeGiven,
        reference: sale.reference,
      },
      customer: sale.customerName
        ? {
            id: sale.customerId || "",
            name: sale.customerName,
          }
        : undefined,
      cashierId: sale.cashierId,
      cashierName: sale.cashierName,
      status: sale.status,
    };
  }

  function handleViewReceipt(sale: Sale) {
    const transaction = convertSaleToTransaction(sale);
    setSelectedTransaction(transaction);
    setIsReceiptModalOpen(true);
  }

  async function handlePrintTodaySales() {
    if (isPrintingTodayReceipt) {
      return;
    }

    setIsPrintingTodayReceipt(true);
    setPageMessage(null);

    try {
      const today = todayDateValue();
      const [todaySales, todayReturns] = await Promise.all([
        salesService.list({
          fromDate: today,
          toDate: today,
          statuses: ["completed", "refunded", "voided"],
          includeItems: true,
        }),
        returnsService.list({
          fromDate: today,
          toDate: today,
          statuses: ["approved"],
        }),
      ]);

      if (todaySales.length === 0 && todayReturns.length === 0) {
        setPageMessage({
          type: "error",
          text: "لا توجد عمليات اليوم للطباعة.",
        });
        return;
      }

      const printResult = await printDailySalesReceipt(
        todaySales,
        posSettings,
        today,
        todayReturns,
      );

      if (!printResult.success) {
        const reason = printResult.error ? ` (${printResult.error})` : "";
        setPageMessage({
          type: "error",
          text: `فشل طباعة تقرير مبيعات اليوم.${reason}`,
        });
        return;
      }

      if (printResult.warning) {
        setPageMessage({
          type: "success",
          text: `تمت الطباعة بنجاح. ${printResult.warning}`,
        });
      } else {
        const printerLabel = printResult.printerName
          ? ` على ${printResult.printerName}`
          : "";
        setPageMessage({
          type: "success",
          text: `تمت طباعة تقرير مبيعات اليوم بنجاح${printerLabel}.`,
        });
      }
    } catch (error) {
      console.error("Failed to print today sales receipt:", error);
      const details = error instanceof Error ? ` (${error.message})` : "";
      setPageMessage({
        type: "error",
        text: `فشل طباعة تقرير مبيعات اليوم.${details}`,
      });
    } finally {
      setIsPrintingTodayReceipt(false);
    }
  }

  function openAddModal() {
    if (!canManage) return;
    resetForm();
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    try {
      await salesService.delete(id);
      if (editingId === id) {
        closeModal();
      }
      await refreshData();
    } catch (err) {
      console.error("Failed to delete sale:", err);
      setPageMessage({ type: "error", text: "فشل في حذف عملية البيع." });
    }
  }

  function openReturnModal(sale: Sale) {
    if (!canManage) return;
    setSaleForReturn(sale);
    setIsReturnModalOpen(true);
  }

  async function handleProcessReturn(reason: string) {
    if (!canManage) return;
    if (!saleForReturn) return;

    try {
      // Atomic backend flow: creates approved returns and updates sale status together.
      await salesService.refund({
        saleId: saleForReturn.id,
        reason,
        processedById: authUser?.id ?? "",
        processedByName: authUser?.fullName ?? "",
      });

      // Refresh sales list
      await refreshData();

      // Close modal and reset state
      setIsReturnModalOpen(false);
      setSaleForReturn(null);

      alert("تم تسجيل المرتجع بنجاح");
    } catch (error) {
      console.error("Failed to process return:", error);
      alert("فشل في معالجة المرتجع");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    if (!editingId) {
      setError("لا يمكن إنشاء عملية بيع بدون أصناف. استخدم شاشة نقاط البيع.");
      return;
    }

    const numericItemsCount = Number(form.itemsCount.trim());
    const numericTotalAmount = Number(form.totalAmount.trim());

    if (!form.receiptNumber.trim()) {
      setError("يرجى إدخال رقم الفاتورة.");
      return;
    }
    if (!Number.isFinite(numericItemsCount) || numericItemsCount <= 0) {
      setError("يرجى إدخال عدد أصناف صحيح أكبر من صفر.");
      return;
    }
    if (!Number.isFinite(numericTotalAmount) || numericTotalAmount <= 0) {
      setError("يرجى إدخال إجمالي صحيح أكبر من صفر.");
      return;
    }
    if (!form.soldAt) {
      setError("يرجى تحديد تاريخ البيع.");
      return;
    }

    const payload = {
      receiptNumber: form.receiptNumber.trim(),
      customerName: form.customerName.trim(),
      total: numericTotalAmount,
      subtotal: numericTotalAmount,
      paymentMethod: form.paymentMethod,
      cashierId: authUser?.id ?? "",
      cashierName: authUser?.fullName ?? "",
      items: [],
    };

    try {
      if (editingId) {
        await salesService.update(editingId, {
          receiptNumber: payload.receiptNumber,
          customerName: payload.customerName,
          total: payload.total,
          subtotal: payload.subtotal,
          paymentMethod: payload.paymentMethod,
        });
      } else {
        await salesService.create(payload);
      }

      closeModal();
      await refreshData();
    } catch (err) {
      console.error("Failed to save sale:", err);
      setError("فشل في حفظ عملية البيع.");
    }
  }

  return (
    <div className="inventory-page">
      <NavSidebar
        items={buildSidebarNavItems("sales", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (isAppPage(id)) {
            navigate(`/${id}`);
            return;
          }
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="inventory-page__main">
        <section className="inventory-page__content">
          <header className="inventory-toolbar">
            <div className="inventory-toolbar__brand">
              <div>
                <h1 className="inventory-toolbar__title">المبيعات</h1>
              </div>
            </div>
            <div className="inventory-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث برقم الفاتورة، العميل أو طريقة الدفع"
                className="inventory-toolbar__search"
                fullWidth
              />
              <div className="inventory-toolbar__chips">
                <span className="inventory-chip">
                  عدد العمليات: {totalRows}
                </span>
                <span className="inventory-chip">
                  الإيراد الصافي: {totalRevenue} LE
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<IconPlus />}
                onClick={openAddModal}
                disabled={!canManage}
              >
                إضافة عملية بيع
              </Button>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`sales-page__message sales-page__message--${pageMessage.type}`}
            >
              {pageMessage.text}
            </div>
          )}

          <section className="inventory-table-card" aria-label="جدول المبيعات">
            <div className="inventory-table-card__header">
              <h2>سجل المبيعات</h2>
              <div className="sales-table-card__header-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<IconPrinter />}
                  onClick={handlePrintTodaySales}
                  loading={isPrintingTodayReceipt}
                  loadingText="جاري الطباعة..."
                  disabled={isPrintingTodayReceipt}
                >
                  طباعة مبيعات اليوم
                </Button>
              </div>
            </div>

            {tableRows.length === 0 ? (
              <p className="inventory-table-card__empty">
                {isLoadingRows
                  ? "جاري تحميل العمليات..."
                  : "لا توجد عمليات مطابقة."}
              </p>
            ) : (
              <div className="inventory-table-card__scroll">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>العميل</th>
                      <th>البائع</th>
                      <th>عدد الأصناف</th>
                      <th>الإجمالي</th>
                      <th>الخصم</th>
                      <th>الزياده</th>
                      <th>التاريخ</th>
                      <th>الوقت</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, index) => {
                      if (row.kind === "return") {
                        const returnRecord = row.returnRecord;
                        const returnStatusLabel =
                          RETURN_STATUS_LABELS[returnRecord.status];
                        return (
                          <tr key={row.id}>
                            <td>
                              {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                            </td>
                            <td>-</td>
                            <td>{returnRecord.processedBy || "-"}</td>
                            <td>{returnRecord.quantity}</td>
                            <td>-{returnRecord.refundAmount.toFixed(2)} LE</td>
                            <td>-</td>
                            <td>{`مرتجع - ${returnStatusLabel}`}</td>
                            <td>{toDateLabel(returnRecord.createdAt)}</td>
                            <td>{toTimeLabel(returnRecord.createdAt)}</td>
                            <td>
                              <div className="inventory-table__actions">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => navigate("/returns")}
                                >
                                  عرض المرتجع
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const sale = row.sale;
                      return (
                        <tr key={row.id}>
                          <td>
                            {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                          </td>
                          <td>{sale.customerName || "-"}</td>
                          <td>{sale.cashierName || "-"}</td>
                          <td>{sale.items?.length ?? 0}</td>
                          <td>{sale.total.toFixed(2)} LE</td>
                          <td>{sale.discountAmount.toFixed(2)} LE</td>
                          <td>{sale.increaseAmount.toFixed(2)} LE</td>
                          <td>{toDateLabel(sale.createdAt)}</td>
                          <td>{toTimeLabel(sale.createdAt)}</td>
                          <td>
                            <div className="inventory-table__actions">
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                icon={<IconEye />}
                                onClick={() => handleViewReceipt(sale)}
                              >
                                عرض
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                icon={<IconUndo />}
                                onClick={() => openReturnModal(sale)}
                                disabled={
                                  sale.status === "refunded" || !canManage
                                }
                              >
                                مرتجع
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(sale.id)}
                                disabled={!canManage}
                              >
                                حذف
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {totalRows > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </section>
        </section>
      </main>

      {isModalOpen && (
        <div
          className="inventory-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "تعديل عملية بيع" : "إضافة عملية بيع جديدة"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="inventory-modal" onSubmit={handleSubmit} dir="rtl">
            <div className="inventory-modal__header">
              <h3>{editingId ? "تعديل عملية بيع" : "إضافة عملية بيع جديدة"}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
              >
                إغلاق
              </Button>
            </div>

            {error && <p className="inventory-modal__error">{error}</p>}

            <div className="inventory-modal__fields">
              <label className="inventory-modal__field">
                <span>رقم الفاتورة *</span>
                <Input
                  value={form.receiptNumber}
                  onChange={(event) =>
                    handleChange("receiptNumber", event.target.value)
                  }
                  placeholder="مثال: INV-2026-001"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>اسم العميل</span>
                <Input
                  value={form.customerName}
                  onChange={(event) =>
                    handleChange("customerName", event.target.value)
                  }
                  placeholder="اختياري"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>عدد الأصناف *</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step="1"
                  value={form.itemsCount}
                  onChange={(event) =>
                    handleChange("itemsCount", event.target.value)
                  }
                  placeholder="1"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>الإجمالي (LE) *</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.totalAmount}
                  onChange={(event) =>
                    handleChange("totalAmount", event.target.value)
                  }
                  placeholder="0.00"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>طريقة الدفع</span>
                <select
                  className="inventory-modal__select"
                  value={form.paymentMethod}
                  onChange={(event) =>
                    handleChange(
                      "paymentMethod",
                      event.target.value as SaleForm["paymentMethod"],
                    )
                  }
                >
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="wallet">محفظة</option>
                </select>
              </label>

              <label className="inventory-modal__field">
                <span>تاريخ البيع *</span>
                <Input
                  type="date"
                  value={form.soldAt}
                  onChange={(event) =>
                    handleChange("soldAt", event.target.value)
                  }
                  fullWidth
                />
              </label>
            </div>

            <div className="inventory-modal__actions">
              <Button type="submit" variant="primary" disabled={!canManage}>
                {editingId ? "حفظ التعديلات" : "إضافة العملية"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                إعادة ضبط
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        transaction={selectedTransaction}
        settings={posSettings}
      />

      {/* Return Confirmation Modal */}
      <ReturnConfirmModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setSaleForReturn(null);
        }}
        onConfirm={handleProcessReturn}
        sale={saleForReturn}
      />
    </div>
  );
}

