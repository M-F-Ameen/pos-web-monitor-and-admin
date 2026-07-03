import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import {
  IconGrid,
  IconCart,
  IconBox,
  IconTag,
  IconReceipt,
  IconUndo,
  IconUsers,
  IconUser,
  IconBarcode,
  IconWallet,
  IconChartBar,
  IconSettings,
  IconSearch,
  IconPlus,
  IconMinus,
  IconClock,
} from "../../components/ui/Icons";
import type { NavItem } from "../../components/layout/NavSidebar";
import { canAccessPage, isAppPage, type AppPage } from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import { treasury as treasuryService } from "../../services/db";
import type {
  TreasurySummary,
  TreasuryOperationRow,
  TreasuryOperationType,
  ManualOperationType,
} from "../../services/db";
import "./TreasuryPage.css";

interface ManualOperationForm {
  name: string;
  amount: string;
  date: string;
}

const TYPE_LABELS: Record<TreasuryOperationType, string> = {
  sale: "بيع",
  return: "مرتجع",
  withdraw: "سحب",
  expense: "مصروف",
};

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
      label: "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631",
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

function toCurrency(value: number): string {
  return `${value.toFixed(2)} LE`;
}

function nowDateTimeValue(): string {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

const OPERATIONS_PER_PAGE = 10;

export function TreasuryPage() {
  const navigate = useNavigate();
  const { role, user: authUser, logout } = useAuth();
  const canManage = role === "admin";
  const [searchValue, setSearchValue] = useState("");
  const [typeFilter, setTypeFilter] = useState<TreasuryOperationType | "all">(
    "all",
  );
  const [summary, setSummary] = useState<TreasurySummary>({
    totalSales: 0,
    totalReturns: 0,
    totalWithdrawals: 0,
    totalExpenses: 0,
    currentCash: 0,
    operations: [],
  });
  const [activeActionType, setActiveActionType] =
    useState<ManualOperationType | null>(null);
  const [form, setForm] = useState<ManualOperationForm>({
    name: "",
    amount: "",
    date: nowDateTimeValue(),
  });
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
      const data = await treasuryService.getSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to load treasury:", err);
      setPageMessage({ type: "error", text: "فشل في تحميل بيانات الخزينة." });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleSummary = useMemo(() => {
    if (role === "admin" || !authUser?.id) return summary;
    const ops = summary.operations.filter((op) => op.userId === authUser.id);
    const totalSales = ops
      .filter((o) => o.type === "sale")
      .reduce((s, o) => s + o.amount, 0);
    const totalReturns = ops
      .filter((o) => o.type === "return")
      .reduce((s, o) => s + o.amount, 0);
    const totalWithdrawals = ops
      .filter((o) => o.type === "withdraw")
      .reduce((s, o) => s + o.amount, 0);
    const totalExpenses = ops
      .filter((o) => o.type === "expense")
      .reduce((s, o) => s + o.amount, 0);
    return {
      ...summary,
      operations: ops,
      totalSales,
      totalReturns,
      totalWithdrawals,
      totalExpenses,
      currentCash: totalSales - totalReturns - totalWithdrawals - totalExpenses,
    };
  }, [summary, role, authUser?.id]);

  const filteredOperations = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return visibleSummary.operations.filter(
      (operation: TreasuryOperationRow) => {
        if (typeFilter !== "all" && operation.type !== typeFilter) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [
          operation.name,
          operation.user,
          operation.date,
          TYPE_LABELS[operation.type],
          toCurrency(Math.abs(operation.amount)),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      },
    );
  }, [summary.operations, searchValue, typeFilter]);

  const totalPages = useMemo(
    () =>
      Math.max(1, Math.ceil(filteredOperations.length / OPERATIONS_PER_PAGE)),
    [filteredOperations.length],
  );

  const paginatedOperations = useMemo(() => {
    const startIndex = (currentPage - 1) * OPERATIONS_PER_PAGE;
    return filteredOperations.slice(
      startIndex,
      startIndex + OPERATIONS_PER_PAGE,
    );
  }, [filteredOperations, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchValue, typeFilter]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  function openActionModal(type: ManualOperationType) {
    if (!canManage) return;
    setActiveActionType(type);
    setForm({
      name: "",
      amount: "",
      date: nowDateTimeValue(),
    });
    setError("");
  }

  function closeModal() {
    setActiveActionType(null);
    setError("");
  }

  async function handleDeleteManualOperation(id: string) {
    if (!canManage) return;
    try {
      await treasuryService.deleteOp(id);
      await loadData();
    } catch (err) {
      console.error("Failed to delete operation:", err);
      setPageMessage({ type: "error", text: "فشل في حذف العملية." });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    if (!activeActionType) {
      return;
    }

    const trimmedName = form.name.trim();
    const numericAmount = Number(form.amount.trim());

    if (!trimmedName) {
      setError("يرجى إدخال اسم العملية.");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("يرجى إدخال مبلغ صحيح أكبر من صفر.");
      return;
    }
    if (!form.date) {
      setError("يرجى تحديد التاريخ.");
      return;
    }

    const newOperation = {
      type: activeActionType,
      name: trimmedName,
      amount: numericAmount,
      userId: authUser?.id ?? "",
      user: authUser?.fullName ?? "",
      date: form.date,
    };

    try {
      await treasuryService.createOp(newOperation);
      closeModal();
      await loadData();
    } catch (err) {
      console.error("Failed to save operation:", err);
      setError("فشل في حفظ العملية.");
    }
  }

  return (
    <div className="treasury-page">
      <NavSidebar
        items={buildNavItems("treasury", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(id) => {
          if (isAppPage(id)) {
            navigate(`/${id}`);
          }
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="treasury-page__main">
        <section className="treasury-page__content">
          <header className="treasury-toolbar">
            <div className="treasury-toolbar__brand">
              <h1 className="treasury-toolbar__title">الخزينة</h1>
             
            </div>
            <div className="treasury-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث بالعملية أو النوع أو المستخدم"
                className="treasury-toolbar__search"
                fullWidth
              />
              <select
                className="treasury-toolbar__select"
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value as TreasuryOperationType | "all",
                  )
                }
              >
                <option value="all">كل الأنواع</option>
                <option value="sale">بيع</option>
                <option value="return">مرتجع</option>
                <option value="withdraw">سحب</option>
                <option value="expense">مصروف</option>
              </select>
              <Button
                type="button"
                variant="secondary"
                icon={<IconMinus />}
                onClick={() => openActionModal("withdraw")}
                disabled={!canManage}
              >
                سحب مبلغ
              </Button>
              <Button
                type="button"
                variant="primary"
                icon={<IconPlus />}
                onClick={() => openActionModal("expense")}
                disabled={!canManage}
              >
                إضافة مصروف
              </Button>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`treasury-page__message treasury-page__message--${pageMessage.type}`}
              role="alert"
            >
              {pageMessage.text}
            </div>
          )}

          <section className="treasury-stats">
            <article className="treasury-stat-card treasury-stat-card--positive">
              <span className="treasury-stat-card__label">إجمالي المبيعات</span>
              <strong className="treasury-stat-card__value">
                +{toCurrency(visibleSummary.totalSales)}
              </strong>
            </article>
            <article className="treasury-stat-card treasury-stat-card--negative">
              <span className="treasury-stat-card__label">
                إجمالي المرتجعات
              </span>
              <strong className="treasury-stat-card__value">
                -{toCurrency(visibleSummary.totalReturns)}
              </strong>
            </article>
            <article className="treasury-stat-card treasury-stat-card--negative">
              <span className="treasury-stat-card__label">إجمالي السحب</span>
              <strong className="treasury-stat-card__value">
                -{toCurrency(visibleSummary.totalWithdrawals)}
              </strong>
            </article>
            <article className="treasury-stat-card treasury-stat-card--negative">
              <span className="treasury-stat-card__label">
                إجمالي المصروفات
              </span>
              <strong className="treasury-stat-card__value">
                -{toCurrency(visibleSummary.totalExpenses)}
              </strong>
            </article>
            <article className="treasury-stat-card treasury-stat-card--balance">
              <span className="treasury-stat-card__label">
                النقد المتاح الآن
              </span>
              <strong className="treasury-stat-card__value">
                {toCurrency(visibleSummary.currentCash)}
              </strong>
            </article>
          </section>

          <section
            className="treasury-table-card"
            aria-label="العمليات المالية"
          >
            <div className="treasury-table-card__header">
              <h2>العمليات المالية</h2>
              <span className="treasury-table-card__meta">
                عدد العمليات: {filteredOperations.length}
              </span>
            </div>

            {filteredOperations.length === 0 ? (
              <p className="treasury-table-card__empty">
                لا توجد عمليات مطابقة للفلاتر الحالية.
              </p>
            ) : (
              <div className="treasury-table-card__scroll">
                <table className="treasury-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>العملية</th>
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th>المبلغ</th>
                      <th>المستخدم</th>
                      <th>المصدر</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOperations.map((operation, index) => {
                      const isPositive = operation.amount >= 0;
                      const absAmount = Math.abs(operation.amount);
                      const rowIndex =
                        (currentPage - 1) * OPERATIONS_PER_PAGE + index + 1;
                      return (
                        <tr key={operation.id}>
                          <td>{rowIndex}</td>
                          <td>{operation.name}</td>
                          <td>{operation.date}</td>
                          <td>
                            <span
                              className={`treasury-type-badge treasury-type-badge--${operation.type}`}
                            >
                              {TYPE_LABELS[operation.type]}
                            </span>
                          </td>
                          <td>
                            <span
                              className={
                                isPositive
                                  ? "treasury-amount treasury-amount--plus"
                                  : "treasury-amount treasury-amount--minus"
                              }
                            >
                              {isPositive ? "+" : "-"}
                              {toCurrency(absAmount)}
                            </span>
                          </td>
                          <td>{operation.user}</td>
                          <td>
                            {operation.source === "manual" ? "يدوي" : "تلقائي"}
                          </td>
                          <td>
                            {operation.source === "manual" ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() =>
                                  handleDeleteManualOperation(operation.id)
                                }
                                disabled={!canManage}
                              >
                                حذف
                              </Button>
                            ) : (
                              <span className="treasury-table__muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filteredOperations.length > 0 && (
              <div className="treasury-pagination" aria-label="ترقيم الصفحات">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="treasury-pagination__button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((previous) => Math.max(1, previous - 1))
                  }
                >
                  السابق
                </Button>
                <span className="treasury-pagination__status">
                  صفحة {currentPage} من {totalPages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="treasury-pagination__button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((previous) =>
                      Math.min(totalPages, previous + 1),
                    )
                  }
                >
                  التالي
                </Button>
              </div>
            )}
          </section>
        </section>
      </main>

      {activeActionType && (
        <div
          className="treasury-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={
            activeActionType === "withdraw" ? "سحب مبلغ" : "إضافة مصروف"
          }
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="treasury-modal" onSubmit={handleSubmit} dir="rtl">
            <div className="treasury-modal__header">
              <h3>
                {activeActionType === "withdraw" ? "سحب مبلغ" : "إضافة مصروف"}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
              >
                إغلاق
              </Button>
            </div>

            {error && <p className="treasury-modal__error">{error}</p>}

            <div className="treasury-modal__fields">
              <label className="treasury-modal__field">
                <span>اسم العملية *</span>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }))
                  }
                  placeholder={
                    activeActionType === "withdraw"
                      ? "مثال: سحب خزينة يومي"
                      : "مثال: فاتورة كهرباء"
                  }
                  fullWidth
                />
              </label>

              <label className="treasury-modal__field">
                <span>المبلغ (LE) *</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0.00"
                  fullWidth
                />
              </label>

              <label className="treasury-modal__field">
                <span>المستخدم *</span>
                <Input
                  value={authUser?.fullName ?? ""}
                  placeholder="اسم المستخدم"
                  disabled
                  fullWidth
                />
              </label>

              <label className="treasury-modal__field">
                <span>التاريخ *</span>
                <Input
                  type="datetime-local"
                  value={form.date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      date: event.target.value,
                    }))
                  }
                  fullWidth
                />
              </label>
            </div>

            <div className="treasury-modal__actions">
              <Button type="submit" variant="primary" disabled={!canManage}>
                حفظ العملية
              </Button>
              <Button type="button" variant="secondary" onClick={closeModal}>
                إلغاء
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
