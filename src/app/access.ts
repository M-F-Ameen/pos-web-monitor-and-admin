export type AppPage =
  | "pos"
  | "inventory"
  | "categories"
  | "sales"
  | "returns"
  | "users"
  | "shifts"
  | "customers"
  | "suppliers"
  | "barcode"
  | "treasury"
  | "reports"
  | "settings";

export type UserRole = "admin" | "manager" | "cashier" | "pos";

export const PAGE_IDS: AppPage[] = [
  "pos",
  "inventory",
  "categories",
  "sales",
  "returns",
  "users",
  "shifts",
  "customers",
  "suppliers",
  "barcode",
  "treasury",
  "reports",
  "settings",
];

export const ROLE_PAGE_ACCESS: Record<UserRole, AppPage[]> = {
  admin: PAGE_IDS,
  manager: PAGE_IDS,
  cashier: ["pos", "sales", "barcode"],
  pos: ["pos", "sales", "barcode"],
};

const SESSION_STORAGE_KEY = "tobacco_pos_session_v1";

function normalizePagePermissions(
  pagePermissions?: readonly string[] | null,
): AppPage[] {
  if (!pagePermissions || pagePermissions.length === 0) {
    return [];
  }

  const validPages = new Set<AppPage>(PAGE_IDS);
  const picked = new Set<AppPage>();

  pagePermissions.forEach((page) => {
    if (validPages.has(page as AppPage)) {
      picked.add(page as AppPage);
    }
  });

  return PAGE_IDS.filter((page) => picked.has(page));
}

function getStoredSessionPagePermissions(role: UserRole): AppPage[] {
  if (typeof window === "undefined" || role !== "pos") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as {
      user?: { role?: UserRole; pagePermissions?: string[] };
    };

    if (parsed?.user?.role !== "pos") {
      return [];
    }

    return normalizePagePermissions(parsed.user.pagePermissions);
  } catch {
    return [];
  }
}

export function getAllowedPages(
  role: UserRole,
  pagePermissions?: readonly string[] | null,
): AppPage[] {
  if (role !== "pos") {
    return ROLE_PAGE_ACCESS[role];
  }

  const providedPages = normalizePagePermissions(pagePermissions);
  const customPages =
    providedPages.length > 0
      ? providedPages
      : getStoredSessionPagePermissions(role);

  if (customPages.length > 0) {
    return customPages;
  }

  return ROLE_PAGE_ACCESS[role];
}

export function canAccessPage(
  role: UserRole,
  page: AppPage,
  pagePermissions?: readonly string[] | null,
): boolean {
  return getAllowedPages(role, pagePermissions).includes(page);
}

export function getFirstAllowedPage(
  role: UserRole,
  pagePermissions?: readonly string[] | null,
): AppPage {
  return getAllowedPages(role, pagePermissions)[0] ?? "pos";
}

export function isAppPage(value: string): value is AppPage {
  return PAGE_IDS.includes(value as AppPage);
}
