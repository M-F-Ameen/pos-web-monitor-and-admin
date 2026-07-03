import { useCallback, useEffect, useState } from "react";
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
import { customers as customersService } from "../../services/db";
import type { Customer } from "../../services/db";
import "./CustomersPage.css";

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
    {
      id: "reports",
      icon: <IconChartBar />,
      label: "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631",
    },
    { id: "settings", icon: <IconSettings />, label: "الإعدادات" },
  ];

  return pages
    .filter((page) => canAccessPage(role as UserRole, page.id as AppPage))
    .map((page) => ({ ...page, active: page.id === activeId }));
}

interface CustomerForm {
  customerId: string;
  name: string;
  phone: string;
  debt: string;
}

function toCurrency(value: number): string {
  return `${value.toFixed(2)} LE`;
}

const ITEMS_PER_PAGE = 10;

export function CustomersPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const canManage = role === "admin";
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDebt, setTotalDebt] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [form, setForm] = useState<CustomerForm>({
    customerId: "",
    name: "",
    phone: "",
    debt: "0",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState("");
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
      const result = await customersService.listPaged({
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        search: debouncedSearch || undefined,
      });
      setCustomersList(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setTotalDebt(result.totalDebt);
      setTotalSales(result.totalSpent);
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  }, [currentPage, debouncedSearch]);

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

  function handleChange(field: keyof CustomerForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (error) {
      setError("");
    }
  }

  function resetForm() {
    setForm({ customerId: "", name: "", phone: "", debt: "0" });
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

  function openEditModal(customer: Customer) {
    if (!canManage) return;
    setEditingId(customer.id);
    setForm({
      customerId: customer.customerId,
      name: customer.name,
      phone: customer.phone,
      debt: customer.debt.toString(),
    });
    setError("");
    setIsModalOpen(true);
  }

  async function handleDelete(customerId: string) {
    if (!canManage) return;
    try {
      await customersService.delete(customerId);
      if (editingId === customerId) {
        closeModal();
      }
      await loadData();
    } catch (err) {
      console.error("Failed to delete customer:", err);
      setPageMessage({ type: "error", text: "فشل في حذف العميل." });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const trimmedCustomerId = form.customerId.trim();
    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    const numericDebt = Number(form.debt.trim());

    if (!trimmedCustomerId) {
      setError("يرجى إدخال رقم العميل.");
      return;
    }
    if (!trimmedName) {
      setError("يرجى إدخال اسم العميل.");
      return;
    }
    if (!trimmedPhone) {
      setError("يرجى إدخال رقم الهاتف.");
      return;
    }
    if (!/^[0-9+\-\s]{6,20}$/.test(trimmedPhone)) {
      setError("رقم الهاتف غير صالح.");
      return;
    }
    if (!Number.isFinite(numericDebt) || numericDebt < 0) {
      setError("يرجى إدخال قيمة دين صحيحة.");
      return;
    }

    try {
      if (editingId) {
        await customersService.update(editingId, {
          customerId: trimmedCustomerId,
          name: trimmedName,
          phone: trimmedPhone,
          debt: numericDebt,
        });
      } else {
        await customersService.create({
          customerId: trimmedCustomerId,
          name: trimmedName,
          phone: trimmedPhone,
          debt: numericDebt,
        });
      }

      closeModal();
      await loadData();
    } catch (err) {
      console.error("Failed to save customer:", err);
      setError("فشل في حفظ بيانات العميل.");
    }
  }

  return (
    <div className="customers-page">
      <NavSidebar
        items={buildNavItems("customers", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (!isAppPage(id)) {
            return;
          }
          navigate(`/${id}`);
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="customers-page__main">
        <section className="customers-page__content">
          <header className="customers-toolbar">
            <div className="customers-toolbar__brand">
              <h1 className="customers-toolbar__title">إدارة العملاء</h1>
            </div>
            <div className="customers-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث باسم العميل أو الهاتف أو رقم العميل"
                className="customers-toolbar__search"
                fullWidth
              />
              <div className="customers-toolbar__chips">
                <span className="customers-chip">العملاء: {totalCount}</span>
                <span className="customers-chip">
                  المبيعات: {toCurrency(totalSales)}
                </span>
                <span className="customers-chip">
                  الديون: {toCurrency(totalDebt)}
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<IconPlus />}
                onClick={openAddModal}
                disabled={!canManage}
              >
                إضافة عميل
              </Button>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`customers-page__message customers-page__message--${pageMessage.type}`}
              role="alert"
            >
              {pageMessage.text}
            </div>
          )}

          <section className="customers-table-card" aria-label="جدول العملاء">
            <div className="customers-table-card__header">
              <h2>العملاء</h2>
            </div>

            {customersList.length === 0 ? (
              <p className="customers-table-card__empty">
                لا يوجد عملاء. اضغط "إضافة عميل" لإنشاء سجل جديد.
              </p>
            ) : (
              <div className="customers-table-card__scroll">
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>رقم العميل</th>
                      <th>الاسم</th>
                      <th>الهاتف</th>
                      <th>إجمالي المشتريات</th>
                      <th>إجمالي المنفق</th>
                      <th>الدين</th>
                      <th>آخر تحديث</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersList.map((customer, index) => (
                      <tr key={customer.id}>
                        <td>
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td>{customer.customerId}</td>
                        <td>{customer.name}</td>
                        <td>{customer.phone}</td>
                        <td>{customer.totalPurchases}</td>
                        <td>{toCurrency(customer.totalSpent)}</td>
                        <td>{toCurrency(customer.debt)}</td>
                        <td>{customer.updatedAt.slice(0, 10)}</td>
                        <td>
                          <div className="customers-table__actions">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(customer)}
                              disabled={!canManage}
                            >
                              تعديل
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(customer.id)}
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
            {customersList.length > 0 && (
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
          className="customers-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "تعديل عميل" : "إضافة عميل"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="customers-modal" onSubmit={handleSubmit} dir="rtl">
            <div className="customers-modal__header">
              <h3>{editingId ? "تعديل عميل" : "إضافة عميل"}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
              >
                إغلاق
              </Button>
            </div>

            {error && <p className="customers-modal__error">{error}</p>}

            <div className="customers-modal__fields">
              <label className="customers-modal__field">
                <span>رقم العميل *</span>
                <Input
                  value={form.customerId}
                  onChange={(event) =>
                    handleChange("customerId", event.target.value)
                  }
                  placeholder="مثال: C-1009"
                  fullWidth
                />
              </label>

              <label className="customers-modal__field">
                <span>الاسم *</span>
                <Input
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder="مثال: محمد علي"
                  fullWidth
                />
              </label>

              <label className="customers-modal__field">
                <span>الهاتف *</span>
                <Input
                  value={form.phone}
                  onChange={(event) =>
                    handleChange("phone", event.target.value)
                  }
                  placeholder="مثال: 01000000000"
                  fullWidth
                />
              </label>

              <label className="customers-modal__field">
                <span>الدين (LE) *</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.debt}
                  onChange={(event) => handleChange("debt", event.target.value)}
                  placeholder="0.00"
                  fullWidth
                />
              </label>
            </div>

            <div className="customers-modal__actions">
              <Button type="submit" variant="primary" disabled={!canManage}>
                {editingId ? "حفظ التعديلات" : "إضافة العميل"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                إعادة ضبط
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
