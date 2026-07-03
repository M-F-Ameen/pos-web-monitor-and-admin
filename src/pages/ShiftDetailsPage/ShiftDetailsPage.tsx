import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
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
  IconClock,
  IconArrowRight,
  IconRefresh,
} from "../../components/ui/Icons";
import type { NavItem } from "../../components/layout/NavSidebar";
import { canAccessPage, isAppPage, type AppPage } from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import {
  users as usersService,
  type UserActivityReport,
  type UserShift,
  type UserShiftOperation,
  type UserShiftOperationType,
} from "../../services/db";
import "../ShiftsPage/ShiftsLayout.css";

function buildNavItems(activeId: AppPage, role: string): NavItem[] {
  const pages: Array<{ id: AppPage; icon: ReactNode; label: string }> = [
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
    .filter((page) => canAccessPage(role as any, page.id))
    .map((page) => ({ ...page, active: page.id === activeId }));
}

function toCurrency(value: number): string {
  return `${value.toFixed(2)} LE`;
}

function toDateTimeLabel(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("ar-EG");
}

function getDurationLabel(shift: UserShift): string {
  if (!shift.logoutAt) {
    return "مستمرة";
  }

  const start = new Date(shift.loginAt.replace(" ", "T"));
  const end = new Date(shift.logoutAt.replace(" ", "T"));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "-";
  }

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} س ${minutes} د`;
}

const OPERATION_LABELS: Record<UserShiftOperationType, string> = {
  sale: "بيع",
  return: "مرتجع",
  expense: "مصروف",
  withdraw: "سحب",
};

export function ShiftDetailsPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const { userId, shiftId } = useParams<{
    userId: string;
    shiftId: string;
  }>();

  const [report, setReport] = useState<UserActivityReport | null>(null);
  const [operations, setOperations] = useState<UserShiftOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedShift = useMemo(
    () => report?.shifts.find((shift) => shift.id === shiftId) ?? null,
    [report?.shifts, shiftId],
  );
  const operationsFinalTotal = useMemo(
    () =>
      operations.reduce((total, operation) => {
        return total + (operation.type === "sale" ? operation.amount : -operation.amount);
      }, 0),
    [operations],
  );

  const loadData = useCallback(async () => {
    if (!userId || !shiftId) {
      setError("بيانات الوردية غير مكتملة.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await usersService.getActivityById(userId);
      if (!data) {
        setReport(null);
        setOperations([]);
        setError("تعذر تحميل بيانات المستخدم.");
        return;
      }

      setReport(data);

      if (!data.shifts.some((shift) => shift.id === shiftId)) {
        setOperations([]);
        setError("تعذر العثور على الوردية المطلوبة.");
        return;
      }

      try {
        const rows = await usersService.getShiftOperations(shiftId);
        setOperations(rows);
      } catch (operationsError) {
        console.error("Failed to load shift operations:", operationsError);
        setOperations([]);
        setError("تعذر تحميل عمليات الوردية.");
      }
    } catch (loadError) {
      console.error("Failed to load shift details:", loadError);
      setReport(null);
      setOperations([]);
      setError("تعذر تحميل تفاصيل الوردية.");
    } finally {
      setLoading(false);
    }
  }, [shiftId, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="user-profile-page user-profile-page--centered">
        <p className="user-profile-page__message">جار تحميل تفاصيل الوردية...</p>
      </div>
    );
  }

  if (!report || !selectedShift) {
    return (
      <div className="user-profile-page user-profile-page--centered">
        <p className="user-profile-page__message">
          {error || "لا توجد بيانات للوردية."}
        </p>
        <Button type="button" variant="primary" onClick={() => navigate("/shifts")}>
          العودة إلى صفحة الورديات
        </Button>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <NavSidebar
        items={buildNavItems("shifts", role)}
        collapsed={false}
        topAction={
          <IconButton variant="accent" aria-label="القائمة الرئيسية">
            <IconGrid />
          </IconButton>
        }
        onItemClick={(itemId) => {
          if (!isAppPage(itemId)) {
            return;
          }
          navigate(`/${itemId}`);
        }}
        onLogout={() => {
          logout();
          navigate("/login");
        }}
      />

      <main className="user-profile-page__main">
        <section className="user-profile-page__content">
          <header className="user-profile-toolbar">
            <div className="user-profile-toolbar__title-wrap">
              <h1 className="user-profile-toolbar__title">تفاصيل الوردية</h1>
              <p className="user-profile-toolbar__subtitle">
                {report.user.fullName} - {report.user.email}
              </p>
            </div>
            <div className="user-profile-toolbar__actions">
              <Button
                type="button"
                variant="secondary"
                icon={<IconArrowRight />}
                onClick={() => navigate("/shifts")}
              >
                رجوع
              </Button>
              <Button
                type="button"
                variant="primary"
                icon={<IconRefresh />}
                onClick={() => void loadData()}
              >
                تحديث
              </Button>
            </div>
          </header>

          {error && <p className="user-profile-page__error">{error}</p>}

          <section className="user-profile-kpis">
            <article className="user-profile-kpi">
              <span>اسم المستخدم</span>
              <strong>{report.user.fullName}</strong>
            </article>
            <article className="user-profile-kpi">
              <span>وقت وتاريخ بداية الوردية</span>
              <strong>{toDateTimeLabel(selectedShift.loginAt)}</strong>
            </article>
            <article className="user-profile-kpi">
              <span>وقت وتاريخ نهاية الوردية</span>
              <strong>{toDateTimeLabel(selectedShift.logoutAt)}</strong>
            </article>
            <article className="user-profile-kpi">
              <span>مدة الوردية</span>
              <strong>{getDurationLabel(selectedShift)}</strong>
            </article>
          </section>

          <section className="user-profile-operations" aria-label="عمليات الوردية">
            <div className="user-profile-section-header">
              <h2>عمليات الوردية</h2>
              <span>
                عدد العمليات: {operations.length} | الإجمالي النهائي:{" "}
                {toCurrency(operationsFinalTotal)}
              </span>
            </div>

            {operations.length === 0 ? (
              <p className="user-profile-page__empty">
                لا توجد عمليات مسجلة في هذه الوردية.
              </p>
            ) : (
              <div className="user-profile-table-wrap">
                <table className="user-profile-table user-profile-table--ops">
                  <thead>
                    <tr>
                      <th>النوع</th>
                      <th>المرجع</th>
                      <th>التاريخ</th>
                      <th>القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.map((operation) => {
                      const isPositive = operation.type === "sale";
                      return (
                        <tr key={operation.id}>
                          <td>{OPERATION_LABELS[operation.type]}</td>
                          <td>{operation.reference}</td>
                          <td>{toDateTimeLabel(operation.createdAt)}</td>
                          <td>
                            <span
                              className={
                                isPositive
                                  ? "user-profile-amount user-profile-amount--plus"
                                  : "user-profile-amount user-profile-amount--minus"
                              }
                            >
                              {isPositive ? "+" : "-"}
                              {toCurrency(operation.amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
