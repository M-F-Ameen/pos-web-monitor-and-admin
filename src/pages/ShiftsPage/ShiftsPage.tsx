import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { NavSidebar } from "../../components/layout/NavSidebar";
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
  IconUsers,
  IconUser,
  IconBarcode,
  IconWallet,
  IconChartBar,
  IconSettings,
  IconRefresh,
  IconClock,
} from "../../components/ui/Icons";
import type { NavItem } from "../../components/layout/NavSidebar";
import { canAccessPage, isAppPage, type AppPage } from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import {
  users as usersService,
  type User,
  type UserActivityReport,
  type UserShift,
} from "../../services/db";
import "./ShiftsLayout.css";
import "./ShiftsPage.css";

const SHIFTS_PER_PAGE = 10;

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

function shiftStatusLabel(shift: UserShift): string {
  return shift.status === "open" ? "مفتوحة" : "مغلقة";
}

export function ShiftsPage() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [report, setReport] = useState<UserActivityReport | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Load all users on mount
  useEffect(() => {
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const allUsers = await usersService.list();
        setUsersList(allUsers);
        if (allUsers.length > 0) {
          setSelectedUserId(allUsers[0].id);
        }
      } catch (loadError) {
        console.error("Failed to load users:", loadError);
        setError("تعذر تحميل قائمة المستخدمين.");
      } finally {
        setLoadingUsers(false);
      }
    }
    void loadUsers();
  }, []);

  // Load shifts for selected user
  const loadReport = useCallback(async () => {
    if (!selectedUserId) {
      setReport(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await usersService.getActivityById(selectedUserId);
      if (!data) {
        setError("تعذر تحميل بيانات المستخدم.");
        setReport(null);
        return;
      }

      setReport(data);
    } catch (loadError) {
      console.error("Failed to load user activity report:", loadError);
      setError("تعذر تحميل بيانات المستخدم.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedUserId]);

  const totalShiftPages = Math.max(
    1,
    Math.ceil((report?.shifts.length ?? 0) / SHIFTS_PER_PAGE),
  );
  const currentPageStartIndex = (currentPage - 1) * SHIFTS_PER_PAGE;
  const paginatedShifts =
    report?.shifts.slice(
      currentPageStartIndex,
      currentPageStartIndex + SHIFTS_PER_PAGE,
    ) ?? [];

  useEffect(() => {
    if (currentPage > totalShiftPages) {
      setCurrentPage(totalShiftPages);
    }
  }, [currentPage, totalShiftPages]);

  if (loadingUsers) {
    return (
      <div className="user-profile-page user-profile-page--centered">
        <p className="user-profile-page__message">جار تحميل البيانات...</p>
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
              <h1 className="user-profile-toolbar__title">الورديات</h1>
            </div>
            <div className="shifts-page__header-center">
              <label
                htmlFor="shifts-user-select"
                className="shifts-page__selector-label"
              >
                اختيار المستخدم
              </label>
              <select
                id="shifts-user-select"
                className="shifts-page__selector-input"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {usersList.length === 0 && (
                  <option value="">لا يوجد مستخدمين</option>
                )}
                {usersList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="user-profile-toolbar__actions">
              <Button
                type="button"
                variant="primary"
                icon={<IconRefresh />}
                onClick={() => void loadReport()}
              >
                تحديث
              </Button>
            </div>
          </header>

          {error && <p className="user-profile-page__error">{error}</p>}

          {loading ? (
            <p className="user-profile-page__empty">
              جار تحميل بيانات الورديات...
            </p>
          ) : !report ? (
            <p className="user-profile-page__empty">
              اختر مستخدماً لعرض ورديات.
            </p>
          ) : (
              <section
                className="user-profile-shifts"
                aria-label="سجل الورديات"
              >
                <div className="user-profile-section-header">
                  <h2>سجل الورديات</h2>
                  <span>عدد الورديات: {report.shiftCount}</span>
                </div>

                {report.shifts.length === 0 ? (
                  <p className="user-profile-page__empty">
                    لا توجد ورديات لهذا المستخدم بعد.
                  </p>
                ) : (
                  <>
                    <div className="user-profile-table-wrap">
                    <table className="user-profile-table">
                      <thead>
                        <tr>
                          <th>الحالة</th>
                          <th>وقت الدخول</th>
                          <th>وقت الخروج</th>
                          <th>المدة</th>
                          <th>بداية النقد</th>
                          <th>نهاية النقد</th>
                          <th>المبيعات</th>
                          <th>المرتجعات</th>
                          <th>المصروفات</th>
                          <th>السحب</th>
                          <th>الصافي</th>
                          <th>تفاصيل الوردية</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedShifts.map((shift) => (
                          <tr key={shift.id}>
                            <td>{shiftStatusLabel(shift)}</td>
                            <td>{toDateTimeLabel(shift.loginAt)}</td>
                            <td>{toDateTimeLabel(shift.logoutAt)}</td>
                            <td>{getDurationLabel(shift)}</td>
                            <td>{toCurrency(shift.startCash)}</td>
                            <td>
                              {toCurrency(
                                shift.endCash ?? report.currentCashNow,
                              )}
                            </td>
                            <td>{toCurrency(shift.metrics.totalSales)}</td>
                            <td>{toCurrency(shift.metrics.totalReturns)}</td>
                            <td>{toCurrency(shift.metrics.totalExpenses)}</td>
                            <td>
                              {toCurrency(shift.metrics.totalWithdrawals)}
                            </td>
                            <td>{toCurrency(shift.metrics.netCash)}</td>
                            <td>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(
                                    `/shifts/${report.user.id}/${shift.id}`,
                                  );
                                }}
                              >
                                تفاصيل الوردية
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    <TablePagination
                      currentPage={currentPage}
                      totalPages={totalShiftPages}
                      onPageChange={setCurrentPage}
                    />
                  </>
                )}
              </section>
          )}
        </section>
      </main>
    </div>
  );
}
