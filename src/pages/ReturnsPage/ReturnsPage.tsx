import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { TablePagination } from "../../components/ui/TablePagination";
import {
  IconGrid,
  IconCart,
  IconBox,
  IconTag,
  IconReceipt,
  IconUndo,
  IconSearch,
  IconPlus,
  IconUsers,
  IconUser,
  IconBarcode,
  IconWallet,
  IconChartBar,
  IconEye,
  IconSettings,
  IconClock,
} from "../../components/ui/Icons";
import type { NavItem } from "../../components/layout/NavSidebar";
import { canAccessPage, isAppPage, type AppPage } from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import { returns as returnsService } from "../../services/db";
import type { Return, ReturnStatus } from "../../services/db";
import { ReturnDetailsModal } from "../../components/pos/ReturnDetailsModal";
import "../InventoryPage/InventoryPage.css";

interface ReturnForm {
  returnNumber: string;
  productName: string;
  quantity: string;
  refundAmount: string;
  reason: string;
  status: ReturnStatus;
  returnDate: string;
}

const RETURNS_FORM_EMPTY: ReturnForm = {
  returnNumber: "",
  productName: "",
  quantity: "",
  refundAmount: "",
  reason: "",
  status: "pending",
  returnDate: "",
};

const STATUS_LABELS: Record<ReturnStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};
const ITEMS_PER_PAGE = 13;

function buildNavItems(activeId: AppPage, role: string): NavItem[] {
  const pageItems: NavItem[] = [
    {
      id: "pos",
      icon: <IconCart />,
      label: "نقاط البيع",
      active: activeId === "pos",
    },
    {
      id: "inventory",
      icon: <IconBox />,
      label: "المخزون",
      active: activeId === "inventory",
    },
    {
      id: "categories",
      icon: <IconTag />,
      label: "التصنيفات",
      active: activeId === "categories",
    },
    {
      id: "sales",
      icon: <IconReceipt />,
      label: "المبيعات",
      active: activeId === "sales",
    },
    {
      id: "returns",
      icon: <IconUndo />,
      label: "المرتجعات",
      active: activeId === "returns",
    },
    {
      id: "users",
      icon: <IconUsers />,
      label: "المستخدمون",
      active: activeId === "users",
    },
    {
      id: "shifts",
      icon: <IconClock />,
      label: "الورديات",
      active: activeId === "shifts",
    },
    {
      id: "customers",
      icon: <IconUser />,
      label: "العملاء",
      active: activeId === "customers",
    },
    {
      id: "suppliers",
      icon: <IconBox />,
      label: "الموردون",
      active: activeId === "suppliers",
    },
    {
      id: "barcode",
      icon: <IconBarcode />,
      label: "الباركود",
      active: activeId === "barcode",
    },
    {
      id: "treasury",
      icon: <IconWallet />,
      label: "الخزينة",
      active: activeId === "treasury",
    },
    {
      id: "reports",
      icon: <IconChartBar />,
      label: "التقارير",
      active: activeId === "reports",
    },
    {
      id: "settings",
      icon: <IconSettings />,
      label: "الإعدادات",
      active: activeId === "settings",
    },
  ];

  return pageItems.filter(
    (item) => isAppPage(item.id) && canAccessPage(role as any, item.id),
  );
}

function todayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReturnsPage() {
  const navigate = useNavigate();
  const { role, user: authUser, logout } = useAuth();
  const canManage = role === "admin";
  const [searchValue, setSearchValue] = useState("");
  const [records, setRecords] = useState<Return[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [form, setForm] = useState<ReturnForm>({
    ...RETURNS_FORM_EMPTY,
    returnDate: todayDateValue(),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageMessage, setPageMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!pageMessage) return;
    const timeoutId = window.setTimeout(() => setPageMessage(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [pageMessage]);

  const loadData = useCallback(async () => {
    try {
      const result = await returnsService.listPaged({
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        search: searchValue.trim() || undefined,
        ...(role !== "admin" && authUser?.id
          ? { processedById: authUser.id }
          : {}),
      });
      setRecords(result.items);
      setTotalRecords(result.total);
      setTotalPages(result.totalPages);
      if (currentPage > result.totalPages) {
        setCurrentPage(result.totalPages);
      }
    } catch (err) {
      console.error("Failed to load returns:", err);
      setPageMessage({ type: "error", text: "فشل في تحميل المرتجعات." });
    }
  }, [currentPage, searchValue, role, authUser?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalRefund = useMemo(
    () =>
      records.reduce((sum, record) => sum + record.refundAmount, 0).toFixed(2),
    [records],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue]);

  function handleChange(field: keyof ReturnForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (error) {
      setError("");
    }
  }

  function resetForm() {
    setForm({
      ...RETURNS_FORM_EMPTY,
      returnDate: todayDateValue(),
    });
    setEditingId(null);
    setError("");
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function openAddModal() {
    if (!canManage) return;
    resetForm();
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!canManage) return;
    try {
      await returnsService.delete(id);
      if (editingId === id) {
        closeModal();
      }
      await loadData();
    } catch (err) {
      console.error("Failed to delete return:", err);
      setPageMessage({ type: "error", text: "فشل في حذف المرتجع." });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const numericQuantity = Number(form.quantity.trim());
    const numericRefundAmount = Number(form.refundAmount.trim());

    if (!form.returnNumber.trim()) {
      setError("يرجى إدخال رقم المرتجع.");
      return;
    }
    if (!form.productName.trim()) {
      setError("يرجى إدخال اسم الصنف.");
      return;
    }
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setError("يرجى إدخال كمية صحيحة أكبر من صفر.");
      return;
    }
    if (!Number.isFinite(numericRefundAmount) || numericRefundAmount <= 0) {
      setError("يرجى إدخال مبلغ صحيح أكبر من صفر.");
      return;
    }
    if (!form.returnDate) {
      setError("يرجى تحديد تاريخ المرتجع.");
      return;
    }

    const payload = {
      returnNumber: form.returnNumber.trim(),
      productName: form.productName.trim(),
      quantity: numericQuantity,
      refundAmount: numericRefundAmount,
      reason: form.reason.trim(),
      status: form.status,
      processedById: authUser?.id ?? "",
      processedByName: authUser?.fullName ?? "",
    };

    try {
      if (editingId) {
        await returnsService.delete(editingId);
      }
      await returnsService.create(payload);

      closeModal();
      await loadData();
    } catch (err) {
      console.error("Failed to save return:", err);
      setError("فشل في حفظ المرتجع.");
    }
  }

  return (
    <div className="inventory-page">
      <NavSidebar
        items={buildNavItems("returns", role)}
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
                <h1 className="inventory-toolbar__title">المرتجعات</h1>
              </div>
            </div>
            <div className="inventory-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث برقم المرتجع، الصنف أو الحالة"
                className="inventory-toolbar__search"
                fullWidth
              />
              <div className="inventory-toolbar__chips">
                <span className="inventory-chip">
                  عدد المرتجعات: {totalRecords}
                </span>
                <span className="inventory-chip">
                  إجمالي الصفحة: {totalRefund} LE
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<IconPlus />}
                onClick={openAddModal}
                disabled={!canManage}
              >
                إضافة مرتجع
              </Button>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`inventory-page__message inventory-page__message--${pageMessage.type}`}
              role="alert"
            >
              {pageMessage.text}
            </div>
          )}

          <section className="inventory-table-card" aria-label="جدول المرتجعات">
            <div className="inventory-table-card__header">
              <h2>سجل المرتجعات</h2>
            </div>

            {records.length === 0 ? (
              <p className="inventory-table-card__empty">
                لا توجد مرتجعات مطابقة. اضغط "إضافة مرتجع" لإدخال عملية جديدة.
              </p>
            ) : (
              <div className="inventory-table-card__scroll">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>رقم المرتجع</th>
                      <th>الصنف</th>
                      <th>الكمية</th>
                      <th>المبلغ</th>
                      <th>السبب</th>
                      <th>الحالة</th>
                      <th>التاريخ</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={record.id}>
                        <td>
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td>{record.returnNumber}</td>
                        <td>{record.productName}</td>
                        <td>{record.quantity}</td>
                        <td>{record.refundAmount.toFixed(2)} LE</td>
                        <td>{record.reason || "-"}</td>
                        <td>{STATUS_LABELS[record.status]}</td>
                        <td>{record.createdAt.slice(0, 10)}</td>
                        <td>
                          <div className="inventory-table__actions">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              icon={<IconEye />}
                              onClick={() => {
                                setSelectedReturn(record);
                                setIsViewModalOpen(true);
                              }}
                            >
                              عرض
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(record.id)}
                              disabled={!canManage}
                            >
                              حذف
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {records.length > 0 && (
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
          aria-label={editingId ? "تعديل مرتجع" : "إضافة مرتجع جديد"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="inventory-modal" onSubmit={handleSubmit} dir="rtl">
            <div className="inventory-modal__header">
              <h3>{editingId ? "تعديل مرتجع" : "إضافة مرتجع جديد"}</h3>
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
                <span>رقم المرتجع *</span>
                <Input
                  value={form.returnNumber}
                  onChange={(event) =>
                    handleChange("returnNumber", event.target.value)
                  }
                  placeholder="مثال: RET-2026-001"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>اسم الصنف *</span>
                <Input
                  value={form.productName}
                  onChange={(event) =>
                    handleChange("productName", event.target.value)
                  }
                  placeholder="مثال: مارلبورو أحمر"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>الكمية *</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step="1"
                  value={form.quantity}
                  onChange={(event) =>
                    handleChange("quantity", event.target.value)
                  }
                  placeholder="1"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>المبلغ المسترد (LE) *</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.refundAmount}
                  onChange={(event) =>
                    handleChange("refundAmount", event.target.value)
                  }
                  placeholder="0.00"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>السبب</span>
                <Input
                  value={form.reason}
                  onChange={(event) =>
                    handleChange("reason", event.target.value)
                  }
                  placeholder="اختياري"
                  fullWidth
                />
              </label>

              <label className="inventory-modal__field">
                <span>الحالة</span>
                <select
                  className="inventory-modal__select"
                  value={form.status}
                  onChange={(event) =>
                    handleChange(
                      "status",
                      event.target.value as ReturnForm["status"],
                    )
                  }
                >
                  <option value="pending">قيد المراجعة</option>
                  <option value="approved">مقبول</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </label>

              <label className="inventory-modal__field">
                <span>التاريخ *</span>
                <Input
                  type="date"
                  value={form.returnDate}
                  onChange={(event) =>
                    handleChange("returnDate", event.target.value)
                  }
                  fullWidth
                />
              </label>
            </div>

            <div className="inventory-modal__actions">
              <Button type="submit" variant="primary" disabled={!canManage}>
                {editingId ? "حفظ التعديلات" : "إضافة المرتجع"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                إعادة ضبط
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Return Details Modal */}
      <ReturnDetailsModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedReturn(null);
        }}
        returnData={selectedReturn}
      />
    </div>
  );
}
