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
  PAGE_IDS,
  ROLE_PAGE_ACCESS,
  isAppPage,
  type AppPage,
  type UserRole,
} from "../../app/access";
import { useAuth } from "../../app/AuthContext";
import { users as usersService } from "../../services/db";
import type { User } from "../../services/db";
import "./UsersPage.css";

interface UserForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  pagePermissions: AppPage[];
}

const DEFAULT_POS_PAGE_PERMISSIONS = [...ROLE_PAGE_ACCESS.pos];

const PAGE_LABELS: Record<AppPage, string> = {
  pos: "نقاط البيع",
  inventory: "المخزون",
  categories: "التصنيفات",
  sales: "المبيعات",
  returns: "المرتجعات",
  users: "المستخدمون",
  shifts: "الورديات",
  customers: "العملاء",
  suppliers: "الموردون",
  barcode: "الباركود",
  treasury: "الخزينة",
  reports: "التقارير",
  settings: "الإعدادات",
};

const EMPTY_FORM: UserForm = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "pos",
  pagePermissions: [...DEFAULT_POS_PAGE_PERMISSIONS],
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "مدير",
  manager: "مشرف",
  cashier: "كاشير",
  pos: "نقطة بيع",
};
const ITEMS_PER_PAGE = 10;
const PROTECTED_DEVELOPER_EMAIL = "weallinsurgent@mail.com";

function buildNavItems(
  activeId: AppPage,
  role: string,
  pagePermissions?: string[],
): NavItem[] {
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
    .filter((page) => canAccessPage(role as UserRole, page.id, pagePermissions))
    .map((page) => ({ ...page, active: page.id === activeId }));
}

export function UsersPage() {
  const navigate = useNavigate();
  const { role, user: authUser, logout } = useAuth();
  const canManage = role === "admin";
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [usersList, setUsersList] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [adminsCount, setAdminsCount] = useState(0);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
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
      const result = await usersService.listPaged({
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        search: debouncedSearch || undefined,
      });
      setUsersList(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
      setAdminsCount(result.adminsCount);
    } catch (err) {
      console.error("Failed to load users:", err);
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

  function isProtectedDeveloperUser(user: User): boolean {
    return user.email.trim().toLowerCase() === PROTECTED_DEVELOPER_EMAIL;
  }

  function normalizePagePermissions(
    pagePermissions?: readonly string[] | null,
  ): AppPage[] {
    const selected = new Set<AppPage>();
    (pagePermissions ?? []).forEach((page) => {
      if (isAppPage(page)) {
        selected.add(page);
      }
    });
    return PAGE_IDS.filter((page) => selected.has(page));
  }

  function handleChange(
    field: Exclude<keyof UserForm, "role" | "pagePermissions">,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
    if (error) {
      setError("");
    }
  }

  function handleRoleChange(nextRole: UserRole) {
    setForm((previous) => {
      if (previous.role === nextRole) {
        return previous;
      }

      return {
        ...previous,
        role: nextRole,
        pagePermissions:
          nextRole === "pos"
            ? previous.role === "pos" && previous.pagePermissions.length > 0
              ? previous.pagePermissions
              : [...DEFAULT_POS_PAGE_PERMISSIONS]
            : [],
      };
    });

    if (error) {
      setError("");
    }
  }

  function handleTogglePagePermission(page: AppPage) {
    setForm((previous) => {
      const isSelected = previous.pagePermissions.includes(page);
      const nextPermissions = isSelected
        ? previous.pagePermissions.filter((item) => item !== page)
        : [...previous.pagePermissions, page];

      return {
        ...previous,
        pagePermissions: normalizePagePermissions(nextPermissions),
      };
    });

    if (error) {
      setError("");
    }
  }

  function resetForm() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setError("");
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function openAddModal() {
    if (!canManage) {
      return;
    }
    resetForm();
    setIsModalOpen(true);
  }

  function openEditModal(user: User) {
    if (!canManage) {
      return;
    }
    if (isProtectedDeveloperUser(user)) {
      return;
    }

    setEditingId(user.id);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      confirmPassword: "",
      role: user.role,
      pagePermissions:
        user.role === "pos"
          ? (() => {
              const savedPermissions = normalizePagePermissions(
                user.pagePermissions,
              );
              return savedPermissions.length > 0
                ? savedPermissions
                : [...DEFAULT_POS_PAGE_PERMISSIONS];
            })()
          : [],
    });
    setError("");
    setIsModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!canManage) {
      return;
    }
    const targetUser = usersList.find((user) => user.id === id);
    if (targetUser && isProtectedDeveloperUser(targetUser)) {
      return;
    }

    try {
      await usersService.delete(id);
      if (editingId === id) {
        closeModal();
      }
      await loadData();
    } catch (err) {
      console.error("Failed to delete user:", err);
      setPageMessage({ type: "error", text: "فشل في حذف المستخدم." });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    const trimmedName = form.fullName.trim();
    const trimmedEmail = form.email.trim().toLowerCase();

    if (!trimmedName) {
      setError("يرجى إدخال الاسم الكامل.");
      return;
    }

    if (!trimmedEmail) {
      setError("يرجى إدخال البريد الإلكتروني.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("يرجى إدخال بريد إلكتروني صحيح.");
      return;
    }

    if (!editingId && !form.password) {
      setError("يرجى إدخال كلمة المرور.");
      return;
    }

    if (form.password && form.password.length < 6) {
      setError("يجب أن تكون كلمة المرور 6 أحرف على الأقل.");
      return;
    }

    if (form.password && form.password !== form.confirmPassword) {
      setError("كلمة المرور وتأكيد كلمة المرور غير متطابقين.");
      return;
    }

    const normalizedPermissions = normalizePagePermissions(
      form.pagePermissions,
    );
    if (form.role === "pos" && normalizedPermissions.length === 0) {
      setError("يجب اختيار صفحة واحدة على الأقل لمستخدم نقطة البيع.");
      return;
    }

    try {
      if (editingId) {
        const updateData: Record<string, unknown> = {
          fullName: trimmedName,
          email: trimmedEmail,
          role: form.role,
          pagePermissions: form.role === "pos" ? normalizedPermissions : [],
        };
        if (form.password) {
          updateData.password = form.password;
        }
        await usersService.update(editingId, updateData);
      } else {
        await usersService.create({
          fullName: trimmedName,
          email: trimmedEmail,
          password: form.password,
          role: form.role,
          pagePermissions: form.role === "pos" ? normalizedPermissions : [],
        });
      }

      closeModal();
      await loadData();
    } catch (err) {
      console.error("Failed to save user:", err);
      setError("فشل في حفظ بيانات المستخدم.");
    }
  }

  return (
    <div className="users-page">
      <NavSidebar
        items={buildNavItems("users", role, authUser?.pagePermissions)}
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

      <main className="users-page__main">
        <section className="users-page__content">
          <header className="users-toolbar">
            <div className="users-toolbar__brand">
              <h1 className="users-toolbar__title">إدارة المستخدمين</h1>
            </div>
            <div className="users-toolbar__actions">
              <Input
                type="search"
                icon={<IconSearch />}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="ابحث بالاسم أو البريد الإلكتروني أو الدور"
                className="users-toolbar__search"
                fullWidth
              />
              <div className="users-toolbar__chips">
                <span className="users-chip">المستخدمون: {totalCount}</span>
                <span className="users-chip">المديرون: {adminsCount}</span>
              </div>
              <Button
                type="button"
                variant="primary"
                icon={<IconPlus />}
                onClick={openAddModal}
                disabled={!canManage}
              >
                إضافة مستخدم
              </Button>
            </div>
          </header>

          {pageMessage && (
            <div
              className={`users-page__message users-page__message--${pageMessage.type}`}
              role="alert"
            >
              {pageMessage.text}
            </div>
          )}

          <section className="users-table-card" aria-label="جدول المستخدمين">
            <div className="users-table-card__header">
              <h2>المستخدمون</h2>
            </div>

            {usersList.length === 0 ? (
              <p className="users-table-card__empty">
                لا يوجد مستخدمون. اضغط "إضافة مستخدم" لإنشاء مستخدم جديد.
              </p>
            ) : (
              <div className="users-table-card__scroll">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>الاسم الكامل</th>
                      <th>البريد الإلكتروني</th>
                      <th>الدور</th>
                      <th>تاريخ الإنشاء</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((user, index) => (
                      <tr key={user.id}>
                        <td>
                          {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                        </td>
                        <td>
                          <span className="users-table__name">
                            {user.fullName}
                          </span>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span
                            className={
                              user.role === "admin"
                                ? "users-role users-role--admin"
                                : "users-role users-role--pos"
                            }
                          >
                            {ROLE_LABELS[user.role]}
                          </span>
                        </td>
                        <td>{user.createdAt}</td>
                        <td>
                          {isProtectedDeveloperUser(user) && (
                            <span className="users-table__protected">
                              حساب محمي
                            </span>
                          )}
                          <div className="users-table__actions">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(user)}
                              disabled={
                                !canManage || isProtectedDeveloperUser(user)
                              }
                            >
                              تعديل
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              disabled={
                                !canManage || isProtectedDeveloperUser(user)
                              }
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
            {usersList.length > 0 && (
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
          className="users-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "تعديل مستخدم" : "إضافة مستخدم"}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form className="users-modal" onSubmit={handleSubmit} dir="rtl">
            <div className="users-modal__header">
              <h3>{editingId ? "تعديل مستخدم" : "إضافة مستخدم"}</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
              >
                إغلاق
              </Button>
            </div>

            {error && <p className="users-modal__error">{error}</p>}

            <div className="users-modal__fields">
              <label className="users-modal__field">
                <span>الاسم الكامل *</span>
                <Input
                  value={form.fullName}
                  onChange={(event) =>
                    handleChange("fullName", event.target.value)
                  }
                  placeholder="مثال: أحمد محمد"
                  fullWidth
                />
              </label>

              <label className="users-modal__field">
                <span>البريد الإلكتروني *</span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    handleChange("email", event.target.value)
                  }
                  placeholder="مثال: ahmed@store.com"
                  fullWidth
                />
              </label>

              <label className="users-modal__field">
                <span>كلمة المرور *</span>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    handleChange("password", event.target.value)
                  }
                  placeholder="6 أحرف على الأقل"
                  fullWidth
                />
              </label>

              <label className="users-modal__field">
                <span>تأكيد كلمة المرور *</span>
                <Input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(event) =>
                    handleChange("confirmPassword", event.target.value)
                  }
                  placeholder="أعد إدخال كلمة المرور"
                  fullWidth
                />
              </label>

              <label className="users-modal__field">
                <span>الدور *</span>
                <select
                  className="users-modal__select"
                  value={form.role}
                  onChange={(event) =>
                    handleRoleChange(event.target.value as UserRole)
                  }
                >
                  <option value="admin">مدير</option>
                  <option value="pos">نقطة بيع</option>
                </select>
              </label>
            </div>

            {form.role === "pos" && (
              <div className="users-modal__permissions">
                <p className="users-modal__permissions-title">
                  صلاحيات صفحات مستخدم نقطة البيع
                </p>
                <div className="users-modal__permissions-grid">
                  {PAGE_IDS.map((pageId) => (
                    <label
                      key={pageId}
                      className="users-modal__permission-option"
                    >
                      <input
                        type="checkbox"
                        checked={form.pagePermissions.includes(pageId)}
                        onChange={() => handleTogglePagePermission(pageId)}
                      />
                      <span>{PAGE_LABELS[pageId]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="users-modal__actions">
              <Button type="submit" variant="primary">
                {editingId ? "حفظ التعديلات" : "إضافة المستخدم"}
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
