import { useState } from "react";
import { IconButton } from "../../ui/IconButton";
import { Button } from "../../ui/Button";
import { Modal } from "../../ui/Modal";
import { Tooltip } from "../../ui/Tooltip";
import {
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
  IconLogOut,
  IconClock,
} from "../../ui/Icons";
import { users as usersService } from "../../../services/db";
import { useAuth } from "../../../app/AuthContext";
import "./NavSidebar.css";

export interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

export interface UserInfo {
  name: string;
  id: string;
  avatar?: string;
}

const defaultNavItems: NavItem[] = [
  { id: "pos", icon: <IconCart />, label: "نقاط البيع", active: true },
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
];

const NAV_DISPLAY_ORDER: string[] = [
  "pos",
  "sales",
  "returns",
  "treasury",
  "inventory",
  "categories",
  "shifts",
  "barcode",
  "reports",
  "users",
  "customers",
  "suppliers",
  "settings",
];

const NAV_DISPLAY_ORDER_INDEX = new Map<string, number>(
  NAV_DISPLAY_ORDER.map((id, index) => [id, index]),
);

export interface NavSidebarProps {
  items?: NavItem[];
  /** User profile shown in sidebar (matches image: avatar, name, ID) */
  user?: UserInfo;
  topAction?: React.ReactNode;
  collapsed?: boolean;
  onItemClick?: (id: string) => void;
  onLogout?: () => void;
}

interface LogoutShiftSummary {
  finalCash: number;
  operationsTotal: number;
}

function toCurrency(value: number): string {
  return `${value.toFixed(2)} LE`;
}

/**
 * Left navigation sidebar: logo, user profile, nav icons.
 * Layout matches image - panel gray #2B2B2B, border on right.
 */
export function NavSidebar({
  items = defaultNavItems,
  user,
  topAction: _topAction,
  collapsed = false,
  onItemClick,
  onLogout,
}: NavSidebarProps) {
  const { user: authUser } = useAuth();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isSubmittingLogout, setIsSubmittingLogout] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [logoutSummary, setLogoutSummary] = useState<LogoutShiftSummary>({
    finalCash: 0,
    operationsTotal: 0,
  });

  async function loadLogoutSummary() {
    if (!authUser?.id) {
      setLogoutSummary({ finalCash: 0, operationsTotal: 0 });
      return;
    }

    setIsSummaryLoading(true);
    setSummaryError("");

    try {
      const report = await usersService.getActivityById(authUser.id);
      if (!report) {
        setLogoutSummary({ finalCash: 0, operationsTotal: 0 });
        setSummaryError("تعذر تحميل ملخص الوردية.");
        return;
      }

      const activeShift = report.activeShift;
      if (!activeShift) {
        setLogoutSummary({
          finalCash: report.currentCashNow,
          operationsTotal: 0,
        });
        setSummaryError("لا توجد وردية نشطة حالياً.");
        return;
      }

      setLogoutSummary({
        finalCash: activeShift.endCash ?? report.currentCashNow,
        operationsTotal: activeShift.metrics.netCash,
      });
    } catch (error) {
      console.error("Failed to load logout shift summary:", error);
      setLogoutSummary({ finalCash: 0, operationsTotal: 0 });
      setSummaryError("تعذر تحميل ملخص الوردية.");
    } finally {
      setIsSummaryLoading(false);
    }
  }

  function handleOpenLogoutModal() {
    setIsLogoutModalOpen(true);
    setIsSubmittingLogout(false);
    void loadLogoutSummary();
  }

  function handleCloseLogoutModal() {
    if (isSubmittingLogout) {
      return;
    }
    setIsLogoutModalOpen(false);
  }

  function handleConfirmLogout() {
    if (!onLogout) {
      return;
    }

    setIsSubmittingLogout(true);
    try {
      onLogout();
    } catch (error) {
      console.error("Failed to submit shift handover:", error);
      setIsSubmittingLogout(false);
      setSummaryError("تعذر تسليم الوردية. حاول مرة أخرى.");
    }
  }

  const sidebarClassName = collapsed
    ? "pos-nav-sidebar pos-nav-sidebar--collapsed"
    : "pos-nav-sidebar";
  const orderedItems = items
    .map((item, index) => ({
      item,
      index,
      order: NAV_DISPLAY_ORDER_INDEX.get(item.id) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) =>
      a.order === b.order ? a.index - b.index : a.order - b.order,
    )
    .map((entry) => entry.item);

  return (
    <>
      <aside
        className={sidebarClassName}
        role="navigation"
        aria-label="القائمة الرئيسية"
      >
        {!collapsed && user && (
          <div className="pos-nav-sidebar__user">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="pos-nav-sidebar__avatar"
                width={40}
                height={40}
              />
            ) : (
              <div
                className="pos-nav-sidebar__avatar-placeholder"
                aria-hidden
              />
            )}
            <div className="pos-nav-sidebar__user-info">
              <span className="pos-nav-sidebar__user-name">{user.name}</span>
              <span className="pos-nav-sidebar__user-id">{user.id}</span>
            </div>
          </div>
        )}
        {!collapsed && (
          <nav className="pos-nav-sidebar__nav">
            {orderedItems.map((item) => (
              <Tooltip key={item.id} content={item.label} position="left">
                <IconButton
                  variant={item.active ? "accent" : "default"}
                  aria-label={item.label}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => onItemClick?.(item.id)}
                  data-nav-id={item.id}
                >
                  {item.icon}
                </IconButton>
              </Tooltip>
            ))}
          </nav>
        )}
        {!collapsed && onLogout && (
          <div className="pos-nav-sidebar__footer">
            <Tooltip content="تسجيل الخروج" position="left">
              <IconButton
                variant="danger"
                aria-label="تسجيل الخروج"
                onClick={handleOpenLogoutModal}
                className="pos-nav-sidebar__logout"
              >
                <IconLogOut />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </aside>

      <Modal
        isOpen={isLogoutModalOpen}
        onClose={handleCloseLogoutModal}
        title="تأكيد نهاية الوردية"
        size="sm"
        closeOnBackdrop={!isSubmittingLogout}
        closeOnEscape={!isSubmittingLogout}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseLogoutModal}
              disabled={isSubmittingLogout}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmLogout}
              disabled={isSummaryLoading || isSubmittingLogout || !onLogout}
            >
              {isSubmittingLogout ? "جارٍ التسليم..." : "تسليم الوردية"}
            </Button>
          </>
        }
      >
        <div className="pos-nav-sidebar__logout-modal" dir="rtl">
          <p className="pos-nav-sidebar__logout-modal-title">نهاية الوردية</p>
          {isSummaryLoading ? (
            <p className="pos-nav-sidebar__logout-modal-loading">
              جاري تحميل ملخص الوردية...
            </p>
          ) : (
            <>
              <div className="pos-nav-sidebar__logout-metric">
                <span>النقد النهائي</span>
                <strong>{toCurrency(logoutSummary.finalCash)}</strong>
              </div>
              <div className="pos-nav-sidebar__logout-metric">
                <span>إجمالي العمليات</span>
                <strong>{toCurrency(logoutSummary.operationsTotal)}</strong>
              </div>
            </>
          )}
          {summaryError && (
            <p className="pos-nav-sidebar__logout-modal-error">
              {summaryError}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
