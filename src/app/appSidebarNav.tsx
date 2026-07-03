import type { ReactNode } from "react";
import type { NavItem } from "../components/layout/NavSidebar";
import {
  IconBarcode,
  IconBox,
  IconCart,
  IconChartBar,
  IconClock,
  IconReceipt,
  IconSettings,
  IconTag,
  IconUndo,
  IconUser,
  IconUsers,
  IconWallet,
} from "../components/ui/Icons";
import { canAccessPage, type AppPage, type UserRole } from "./access";

type NavDefinition = {
  id: AppPage;
  icon: ReactNode;
  label: string;
};

const NAV_DEFINITIONS: NavDefinition[] = [
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

export function buildSidebarNavItems(
  activeId: AppPage,
  role: UserRole,
  pagePermissions?: readonly string[] | null,
): NavItem[] {
  return NAV_DEFINITIONS.filter((item) =>
    canAccessPage(role, item.id, pagePermissions),
  ).map((item) => ({
    id: item.id,
    icon: item.icon,
    label: item.label,
    active: item.id === activeId,
  }));
}
