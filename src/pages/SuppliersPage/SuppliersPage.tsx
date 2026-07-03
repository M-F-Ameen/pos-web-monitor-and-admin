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
  IconSettings,
  IconClock,
} from "../../components/ui/Icons";
import type { NavItem } from "../../components/layout/NavSidebar";
import {
  canAccessPage,
  isAppPage,
  type AppPage,
  type UserRole,
} from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import { suppliers as suppliersService } from "../../services/db";
import type { Supplier, SupplierOperation } from "../../services/db";
import "./SuppliersPage.css";

function buildNavItems(activeId: AppPage, role: string): NavItem[] {
  const pages: Array<{ id: AppPage; icon: React.ReactNode; label: string }> = [
    { id: "pos", icon: <IconCart />, label: "نقاط البيع" },
    { id: "inventory", icon: <IconBox />, label: "المخزون" },
    { id: "categories", icon: <IconTag />, label: "التصنيفات" },
    { id: "sales", icon: <IconReceipt />, label: "المبيعات" },
    { id: "returns", icon: <IconUndo />, label: "المرتجعات" },
    { id: "users", icon: <IconUsers />, label: "المستخدمون" },
    { id: "shifts", icon: <IconClock />, label: "الورديات" },
    { id: "customers", icon: <IconUser />, label: "العملاء" },
    { id: "suppliers", icon: <IconBox />, label: "الموردون" },
    { id: "barcode", icon: <IconBarcode />, label: "الباركود" },
    { id: "treasury", icon: <IconWallet />, label: "الخزينة" },
    { id: "reports", icon: <IconChartBar />, label: "التقارير" },
    { id: "settings", icon: <IconSettings />, label: "الإعدادات" },
  ];

  return pages
    .filter((page) => canAccessPage(role as UserRole, page.id as AppPage))
    .map((page) => ({ ...page, active: page.id === activeId }));
}

interface SupplierForm {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

interface CreateOperationForm {
  supplierId: string;
  purchaseAmount: string;
  paidAmount: string;
  note: string;
}

function toCurrency(value: number): string {
  return `${value.toFixed(2)} ج.م`;
}

function toNumber(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function operationTypeLabel(type: SupplierOperation["type"]): string {
  return type === "purchase" ? "شراء" : "تسوية";
}

const ITEMS_PER_PAGE = 10;

export function SuppliersPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const canManage = role === "admin";

  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDebt, setTotalDebt] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState<SupplierForm>({
    name: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierFormError, setSupplierFormError] = useState("");

  const [pageMessage, setPageMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [isCreateOperationModalOpen, setIsCreateOperationModalOpen] =
    useState(false);
  const [createOperationError, setCreateOperationError] = useState("");
  const [isSavingOperation, setIsSavingOperation] = useState(false);
  const [operationForm, setOperationForm] = useState<CreateOperationForm>({
    supplierId: "",
    purchaseAmount: "",
    paidAmount: "",
    note: "",
  });

  const [isOpsModalOpen, setIsOpsModalOpen] = useState(false);
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [operations, setOperations] = useState<SupplierOperation[]>([]);
  const [opsError, setOpsError] = useState("");
  const [isLoadingOps, setIsLoadingOps] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [isSettling, setIsSettling] = useState(false);

  const remainingAmount = useMemo(() => {
    const purchase = toNumber(operationForm.purchaseAmount || "0");
    const paid = toNumber(operationForm.paidAmount || "0");
    if (!Number.isFinite(purchase) || !Number.isFinite(paid)) {
      return 0;
    }
    return Math.max(purchase - paid, 0);
  }, [operationForm.purchaseAmount, operationForm.paidAmount]);

  useEffect(() => {
    if (!pageMessage) return;
    const timer = window.setTimeout(() => setPageMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pageMessage]);

  const loadData = useCallback(async () => {
    try {
      const result = await suppliersService.listPaged({
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        search: debouncedSearch || undefined,
      });
      setSuppliersList(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setTotalDebt(result.totalDebt);
      setTotalPaid(result.totalPaid);
    } catch (err) {
      console.error("فشل في تحميل الموردين:", err);
      setPageMessage({ type: "error", text: "فشل في تحميل الموردين." });
    }
  }, [currentPage, debouncedSearch]);

  const loadAllSuppliers = useCallback(async (): Promise<Supplier[]> => {
    try {
      const list = await suppliersService.list();
      setAllSuppliers(list);
      return list;
    } catch (err) {
      console.error("فشل في تحميل الموردين:", err);
      setPageMessage({ type: "error", text: "فشل في تحميل الموردين." });
      return [];
    }
  }, []);

  const loadSupplierOperations = useCallback(async (supplierId: string) => {
    setIsLoadingOps(true);
    setOpsError("");
    try {
      const [ops, latestSupplier] = await Promise.all([
        suppliersService.listOperations(supplierId),
        suppliersService.getById(supplierId),
      ]);
      setOperations(ops);
      if (latestSupplier) {
        setActiveSupplier(latestSupplier);
      }
    } catch (err) {
      console.error("فشل في تحميل عمليات المورد:", err);
      setOpsError("فشل في تحميل عمليات المورد.");
    } finally {
      setIsLoadingOps(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  function resetSupplierForm() {
    setForm({
      name: "",
      phone: "",
      address: "",
      notes: "",
    });
    setEditingId(null);
    setSupplierFormError("");
  }

  function closeSupplierModal() {
    setIsSupplierModalOpen(false);
    resetSupplierForm();
  }

  function openAddSupplierModal() {
    if (!canManage) return;
    resetSupplierForm();
    setIsSupplierModalOpen(true);
  }

  function openEditSupplierModal(supplier: Supplier) {
    if (!canManage) return;
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      notes: supplier.notes,
    });
    setSupplierFormError("");
    setIsSupplierModalOpen(true);
  }

  function handleSupplierFormChange(field: keyof SupplierForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (supplierFormError) {
      setSupplierFormError("");
    }
  }

  async function handleSupplierSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    const name = form.name.trim();
    const phone = form.phone.trim();
    const address = form.address.trim();
    const notes = form.notes.trim();

    if (!name) {
      setSupplierFormError("يرجى إدخال اسم المورد.");
      return;
    }
    if (!phone) {
      setSupplierFormError("يرجى إدخال رقم الهاتف.");
      return;
    }
    if (!/^[0-9+\-\s]{6,20}$/.test(phone)) {
      setSupplierFormError("رقم الهاتف غير صالح.");
      return;
    }

    try {
      const payload = { name, phone, address, notes };
      if (editingId) {
        await suppliersService.update(editingId, payload);
      } else {
        await suppliersService.create(payload);
      }
      closeSupplierModal();
      await Promise.all([loadData(), loadAllSuppliers()]);
    } catch (err) {
      console.error("فشل في حفظ المورد:", err);
      setSupplierFormError("فشل في حفظ المورد.");
    }
  }

  async function handleDeleteSupplier(supplierId: string) {
    if (!canManage) return;
    try {
      await suppliersService.delete(supplierId);
      if (editingId === supplierId) {
        closeSupplierModal();
      }
      if (activeSupplier?.id === supplierId) {
        closeOpsModal();
      }
      await Promise.all([loadData(), loadAllSuppliers()]);
    } catch (err) {
      console.error("فشل في حذف المورد:", err);
      setPageMessage({ type: "error", text: "فشل في حذف المورد." });
    }
  }

  async function openCreateOperationModal() {
    if (!canManage) return;
    const list = await loadAllSuppliers();
    if (list.length === 0) {
      setPageMessage({
        type: "error",
        text: "لا يوجد موردون. أضف موردًا أولًا.",
      });
      return;
    }

    setOperationForm({
      supplierId: list[0].id,
      purchaseAmount: "",
      paidAmount: "",
      note: "",
    });
    setCreateOperationError("");
    setIsCreateOperationModalOpen(true);
  }

  function closeCreateOperationModal() {
    setIsCreateOperationModalOpen(false);
    setCreateOperationError("");
    setIsSavingOperation(false);
  }

  function handleOperationFormChange(
    field: keyof CreateOperationForm,
    value: string,
  ) {
    setOperationForm((prev) => ({ ...prev, [field]: value }));
    if (createOperationError) {
      setCreateOperationError("");
    }
  }

  async function handleCreateOperationSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!canManage) return;

    const supplierId = operationForm.supplierId;
    const purchaseAmount = toNumber(operationForm.purchaseAmount);
    const paidAmount = toNumber(operationForm.paidAmount || "0");
    const note = operationForm.note.trim();

    if (!supplierId) {
      setCreateOperationError("يرجى اختيار المورد.");
      return;
    }
    if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
      setCreateOperationError("يرجى إدخال قيمة مشتريات صحيحة.");
      return;
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      setCreateOperationError("يرجى إدخال مبلغ مدفوع صحيح.");
      return;
    }
    if (paidAmount > purchaseAmount) {
      setCreateOperationError(
        "المبلغ المدفوع لا يمكن أن يكون أكبر من المشتريات.",
      );
      return;
    }

    setIsSavingOperation(true);
    try {
      const result = await suppliersService.createOperation({
        supplierId,
        purchaseAmount,
        paidAmount,
        note: note || undefined,
      });
      if (!result) {
        throw new Error("Failed to create supplier operation");
      }

      closeCreateOperationModal();
      setPageMessage({ type: "success", text: "تم تسجيل العملية بنجاح." });
      await Promise.all([loadData(), loadAllSuppliers()]);
      if (isOpsModalOpen && activeSupplier?.id === supplierId) {
        await loadSupplierOperations(supplierId);
      }
    } catch (err) {
      console.error("فشل في تسجيل العملية:", err);
      setCreateOperationError("فشل في تسجيل العملية.");
    } finally {
      setIsSavingOperation(false);
    }
  }

  async function openOpsModal(supplier: Supplier) {
    setActiveSupplier(supplier);
    setOperations([]);
    setSettleAmount("");
    setSettleNote("");
    setOpsError("");
    setIsOpsModalOpen(true);
    await loadSupplierOperations(supplier.id);
  }

  function closeOpsModal() {
    setIsOpsModalOpen(false);
    setActiveSupplier(null);
    setOperations([]);
    setSettleAmount("");
    setSettleNote("");
    setOpsError("");
    setIsSettling(false);
  }

  async function handleSettlePartial() {
    if (!canManage || !activeSupplier) return;

    const amount = toNumber(settleAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setOpsError("يرجى إدخال مبلغ تسوية صحيح.");
      return;
    }
    if (amount > activeSupplier.debt) {
      setOpsError("مبلغ التسوية أكبر من المديونية الحالية.");
      return;
    }

    setIsSettling(true);
    setOpsError("");
    try {
      const result = await suppliersService.settleDebt({
        supplierId: activeSupplier.id,
        amount,
        note: settleNote.trim() || undefined,
      });
      if (!result) {
        throw new Error("Failed to settle supplier debt");
      }

      setSettleAmount("");
      setSettleNote("");
      setPageMessage({ type: "success", text: "تمت التسوية الجزئية بنجاح." });
      await Promise.all([
        loadData(),
        loadAllSuppliers(),
        loadSupplierOperations(activeSupplier.id),
      ]);
    } catch (err) {
      console.error("فشل في التسوية الجزئية:", err);
      setOpsError("فشل في تنفيذ التسوية الجزئية.");
    } finally {
      setIsSettling(false);
    }
  }

  async function handleSettleAll() {
    if (!canManage || !activeSupplier) return;
    if (activeSupplier.debt <= 0) {
      setOpsError("لا توجد مديونية لتسويتها.");
      return;
    }

    setIsSettling(true);
    setOpsError("");
    try {
      const result = await suppliersService.settleDebtAll(
        activeSupplier.id,
        settleNote.trim() || undefined,
      );
      if (!result) {
        throw new Error("Failed to settle all debt");
      }

      setSettleAmount("");
      setSettleNote("");
      setPageMessage({
        type: "success",
        text: "تمت تسوية كل المديونية بنجاح.",
      });
      await Promise.all([
        loadData(),
        loadAllSuppliers(),
        loadSupplierOperations(activeSupplier.id),
      ]);
    } catch (err) {
      console.error("فشل في تسوية كل المديونية:", err);
      setOpsError("فشل في تنفيذ تسوية كل المديونية.");
    } finally {
      setIsSettling(false);
    }
  }

  return (
    <div className="suppliers-page">
      <NavSidebar
        items={buildNavItems("suppliers", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (!isAppPage(id)) return;
          navigate(`/${id}`);
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="suppliers-page__main">
        <section className="suppliers-page__content">
          <header className="suppliers-toolbar">
            <div className="suppliers-toolbar__brand">
              <h1 className="suppliers-toolbar__title">إدارة الموردين</h1>
            </div>
            <div className="suppliers-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث بالاسم أو الهاتف أو كود المورد"
                className="suppliers-toolbar__search"
                fullWidth
              />
              <div className="suppliers-toolbar__chips">
                <span className="suppliers-chip">الموردون: {totalCount}</span>
                <span className="suppliers-chip">
                  إجمالي المدفوع: {toCurrency(totalPaid)}
                </span>
                <span className="suppliers-chip">
                  المديونية: {toCurrency(totalDebt)}
                </span>
              </div>
              <div className="suppliers-toolbar__buttons">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={openCreateOperationModal}
                  disabled={!canManage}
                >
                  عمليات
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  icon={<IconPlus />}
                  onClick={openAddSupplierModal}
                  disabled={!canManage}
                >
                  إضافة مورد
                </Button>
              </div>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`suppliers-page__message suppliers-page__message--${pageMessage.type}`}
              role="alert"
            >
              {pageMessage.text}
            </div>
          )}

          <section className="suppliers-table-card" aria-label="جدول الموردين">
            <div className="suppliers-table-card__header">
              <h2>الموردون</h2>
            </div>

            {suppliersList.length === 0 ? (
              <p className="suppliers-table-card__empty">
                لا يوجد موردون. اضغط "إضافة مورد" لإنشاء سجل جديد.
              </p>
            ) : (
              <div className="suppliers-table-card__scroll">
                <table className="suppliers-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>كود المورد</th>
                      <th>الاسم</th>
                      <th>الهاتف</th>
                      <th>العنوان</th>
                      <th>المشتريات</th>
                      <th>إجمالي المدفوع</th>
                      <th>المديونية</th>
                      <th>آخر تحديث</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliersList.map((supplier, index) => (
                      <tr key={supplier.id}>
                        <td>
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td>{supplier.supplierCode}</td>
                        <td>{supplier.name}</td>
                        <td>{supplier.phone || "-"}</td>
                        <td>{supplier.address || "-"}</td>
                        <td>{toCurrency(supplier.totalPurchases)}</td>
                        <td>{toCurrency(supplier.totalPaid)}</td>
                        <td>{toCurrency(supplier.debt)}</td>
                        <td>{supplier.updatedAt.slice(0, 10)}</td>
                        <td>
                          <div className="suppliers-table__actions">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openOpsModal(supplier)}
                              disabled={!canManage}
                            >
                              العمليات
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditSupplierModal(supplier)}
                              disabled={!canManage}
                            >
                              تعديل
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDeleteSupplier(supplier.id)}
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
            {suppliersList.length > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </section>
        </section>
      </main>

      {isSupplierModalOpen && (
        <div
          className="suppliers-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "تعديل مورد" : "إضافة مورد"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSupplierModal();
            }
          }}
        >
          <form
            className="suppliers-modal suppliers-modal--sm"
            onSubmit={handleSupplierSubmit}
            dir="rtl"
          >
            <div className="suppliers-modal__header">
              <h3>{editingId ? "تعديل مورد" : "إضافة مورد"}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeSupplierModal}
              >
                إغلاق
              </Button>
            </div>

            {supplierFormError && (
              <p className="suppliers-modal__error">{supplierFormError}</p>
            )}

            <div className="suppliers-modal__fields suppliers-modal__fields--single">
              <label className="suppliers-modal__field">
                <span>اسم المورد *</span>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    handleSupplierFormChange("name", event.target.value)
                  }
                  placeholder="مثال: شركة الصفا"
                  fullWidth
                />
              </label>

              <label className="suppliers-modal__field">
                <span>رقم الهاتف *</span>
                <Input
                  value={form.phone}
                  onChange={(event) =>
                    handleSupplierFormChange("phone", event.target.value)
                  }
                  placeholder="مثال: 01000000000"
                  fullWidth
                />
              </label>

              <label className="suppliers-modal__field">
                <span>العنوان (اختياري)</span>
                <Input
                  value={form.address}
                  onChange={(event) =>
                    handleSupplierFormChange("address", event.target.value)
                  }
                  placeholder="مثال: القاهرة - مدينة نصر"
                  fullWidth
                />
              </label>

              <label className="suppliers-modal__field">
                <span>ملاحظة (اختياري)</span>
                <textarea
                  className="suppliers-modal__textarea"
                  value={form.notes}
                  onChange={(event) =>
                    handleSupplierFormChange("notes", event.target.value)
                  }
                  placeholder="أضف ملاحظة إن لزم"
                  rows={3}
                />
              </label>
            </div>

            <div className="suppliers-modal__actions">
              <Button type="submit" variant="primary" disabled={!canManage}>
                {editingId ? "حفظ التعديلات" : "إضافة المورد"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resetSupplierForm}
              >
                إعادة ضبط
              </Button>
            </div>
          </form>
        </div>
      )}

      {isCreateOperationModalOpen && (
        <div
          className="suppliers-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="تسجيل عملية مورد"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateOperationModal();
            }
          }}
        >
          <form
            className="suppliers-modal suppliers-modal--sm"
            onSubmit={handleCreateOperationSubmit}
            dir="rtl"
          >
            <div className="suppliers-modal__header">
              <h3>تسجيل عملية مورد</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeCreateOperationModal}
              >
                إغلاق
              </Button>
            </div>

            {createOperationError && (
              <p className="suppliers-modal__error">{createOperationError}</p>
            )}

            <div className="suppliers-modal__fields suppliers-modal__fields--single">
              <label className="suppliers-modal__field">
                <span>المورد *</span>
                <select
                  className="suppliers-modal__select"
                  value={operationForm.supplierId}
                  onChange={(event) =>
                    handleOperationFormChange("supplierId", event.target.value)
                  }
                >
                  {allSuppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.supplierCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="suppliers-modal__field">
                <span>قيمة المشتريات (ج.م) *</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={operationForm.purchaseAmount}
                  onChange={(event) =>
                    handleOperationFormChange(
                      "purchaseAmount",
                      event.target.value,
                    )
                  }
                  placeholder="0.00"
                  fullWidth
                />
              </label>

              <label className="suppliers-modal__field">
                <span>المبلغ المدفوع (ج.م)</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={operationForm.paidAmount}
                  onChange={(event) =>
                    handleOperationFormChange("paidAmount", event.target.value)
                  }
                  placeholder="0.00"
                  fullWidth
                />
              </label>

              <label className="suppliers-modal__field">
                <span>المتبقي (المديونية)</span>
                <Input value={remainingAmount.toFixed(2)} readOnly fullWidth />
              </label>

              <label className="suppliers-modal__field">
                <span>ملاحظة (اختياري)</span>
                <textarea
                  className="suppliers-modal__textarea"
                  value={operationForm.note}
                  onChange={(event) =>
                    handleOperationFormChange("note", event.target.value)
                  }
                  placeholder="ملاحظة على العملية"
                  rows={3}
                />
              </label>
            </div>

            <div className="suppliers-modal__actions">
              <Button
                type="submit"
                variant="primary"
                loading={isSavingOperation}
                loadingText="جارٍ الحفظ..."
              >
                تسجيل العملية
              </Button>
            </div>
          </form>
        </div>
      )}

      {isOpsModalOpen && (
        <div
          className="suppliers-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="عمليات المورد"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeOpsModal();
            }
          }}
        >
          <div className="suppliers-modal suppliers-modal--lg" dir="rtl">
            <div className="suppliers-modal__header">
              <h3>
                عمليات المورد: {activeSupplier?.name ?? "-"} (
                {activeSupplier?.supplierCode ?? "-"})
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeOpsModal}
              >
                إغلاق
              </Button>
            </div>

            {opsError && <p className="suppliers-modal__error">{opsError}</p>}

            <div className="suppliers-ops-summary">
              <span className="suppliers-chip">
                إجمالي المشتريات:{" "}
                {toCurrency(activeSupplier?.totalPurchases ?? 0)}
              </span>
              <span className="suppliers-chip">
                إجمالي المدفوع: {toCurrency(activeSupplier?.totalPaid ?? 0)}
              </span>
              <span className="suppliers-chip">
                المديونية الحالية: {toCurrency(activeSupplier?.debt ?? 0)}
              </span>
            </div>

            <section
              className="suppliers-ops-table-wrap"
              aria-label="سجل عمليات المورد"
            >
              {isLoadingOps ? (
                <p className="suppliers-ops-empty">جارٍ تحميل العمليات...</p>
              ) : operations.length === 0 ? (
                <p className="suppliers-ops-empty">
                  لا توجد عمليات مسجلة لهذا المورد.
                </p>
              ) : (
                <table className="suppliers-ops-table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th>المشتريات</th>
                      <th>المدفوع</th>
                      <th>قبل</th>
                      <th>بعد</th>
                      <th>ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((operation) => (
                      <tr key={operation.id}>
                        <td>{formatDateTime(operation.createdAt)}</td>
                        <td>{operationTypeLabel(operation.type)}</td>
                        <td>{toCurrency(operation.purchaseAmount)}</td>
                        <td>{toCurrency(operation.paidAmount)}</td>
                        <td>{toCurrency(operation.debtBefore)}</td>
                        <td>{toCurrency(operation.debtAfter)}</td>
                        <td>{operation.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section
              className="suppliers-ops-settlement"
              aria-label="تسوية المديونية"
            >
              <h4>تسوية المديونية</h4>
              <div className="suppliers-ops-settlement__fields">
                <label className="suppliers-modal__field">
                  <span>مبلغ التسوية الجزئية (ج.م)</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={settleAmount}
                    onChange={(event) => {
                      setSettleAmount(event.target.value);
                      if (opsError) {
                        setOpsError("");
                      }
                    }}
                    placeholder="0.00"
                    fullWidth
                    disabled={
                      !canManage ||
                      isSettling ||
                      (activeSupplier?.debt ?? 0) <= 0
                    }
                  />
                </label>

                <label className="suppliers-modal__field suppliers-modal__field--full">
                  <span>ملاحظة (اختياري)</span>
                  <textarea
                    className="suppliers-modal__textarea"
                    value={settleNote}
                    onChange={(event) => {
                      setSettleNote(event.target.value);
                      if (opsError) {
                        setOpsError("");
                      }
                    }}
                    placeholder="ملاحظة على التسوية"
                    rows={2}
                    disabled={!canManage || isSettling}
                  />
                </label>
              </div>

              <div className="suppliers-ops-settlement__actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSettlePartial}
                  loading={isSettling}
                  loadingText="جارٍ التنفيذ..."
                  disabled={!canManage || (activeSupplier?.debt ?? 0) <= 0}
                >
                  تسوية جزئية
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSettleAll}
                  loading={isSettling}
                  loadingText="جارٍ التنفيذ..."
                  disabled={!canManage || (activeSupplier?.debt ?? 0) <= 0}
                >
                  تسوية كل المديونية
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
