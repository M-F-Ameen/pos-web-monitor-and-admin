import { getDb, hashPassword } from "../database";
import {
  endUserShift,
  getUserActivityReport,
  listUserShiftOperations,
  startUserShift,
} from "./user-shifts.service";
import type {
  User,
  AuthResult,
  UserActivityReport,
  UserShiftOperation,
  UsersListQuery,
  UsersPagedResult,
} from "../shared/types";

const APP_PAGE_IDS = [
  "pos",
  "inventory",
  "categories",
  "sales",
  "returns",
  "users",
  "customers",
  "barcode",
  "treasury",
  "reports",
  "settings",
] as const;
type AppPageId = (typeof APP_PAGE_IDS)[number];

// ============================================
// Users Service
// ============================================

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePagePermissionsInput(value: unknown): AppPageId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<AppPageId>(APP_PAGE_IDS);
  const picked = new Set<AppPageId>();
  value.forEach((item) => {
    if (typeof item !== "string") {
      return;
    }
    if (allowed.has(item as AppPageId)) {
      picked.add(item as AppPageId);
    }
  });

  return APP_PAGE_IDS.filter((page) => picked.has(page));
}

function parsePagePermissions(raw: unknown): AppPageId[] {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizePagePermissionsInput(parsed);
  } catch {
    return [];
  }
}

function serializePagePermissions(value: unknown): string {
  return JSON.stringify(normalizePagePermissionsInput(value));
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    role: row.role as User["role"],
    pagePermissions: parsePagePermissions(row.page_permissions),
    isActive: (row.is_active as number) === 1,
    createdAt: row.created_at as string,
  };
}

export function listUsers(): User[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, full_name, email, role, page_permissions, is_active, created_at FROM users ORDER BY created_at DESC",
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToUser);
}

export function listUsersPaged(query: UsersListQuery = {}): UsersPagedResult {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    clauses.push("(full_name LIKE ? OR email LIKE ? OR role LIKE ?)");
    params.push(term, term, term);
  }

  const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM users${whereSql}`)
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT id, full_name, email, role, page_permissions, is_active, created_at FROM users${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  // Summary stats across ALL users (not scoped by search)
  const adminsCount = (
    db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      .get() as { count: number }
  ).count;
  const totalCount = (
    db.prepare("SELECT COUNT(*) AS count FROM users").get() as {
      count: number;
    }
  ).count;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: rows.map(rowToUser),
    total,
    page,
    pageSize,
    totalPages,
    adminsCount,
    totalCount,
  };
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, full_name, email, role, page_permissions, is_active, created_at FROM users WHERE id = ?",
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function authenticateUser(email: string, password: string): AuthResult {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, full_name, email, password_hash, role, page_permissions, is_active, created_at FROM users WHERE email = ?",
    )
    .get(normalizeEmail(email)) as Record<string, unknown> | undefined;

  if (!row) {
    return {
      success: false,
      error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    };
  }

  if ((row.is_active as number) !== 1) {
    return { success: false, error: "هذا الحساب معطل" };
  }

  const expectedHash = row.password_hash as string;
  const inputHash = hashPassword(password);

  if (inputHash !== expectedHash) {
    return {
      success: false,
      error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    };
  }

  const user = rowToUser(row);
  const shift = startUserShift({
    userId: user.id,
    userName: user.fullName,
    userRole: user.role,
  });

  return { success: true, user, shiftId: shift.id };
}

export function logoutUserSession(userId: string, shiftId?: string): boolean {
  const ended = endUserShift(userId, shiftId);
  return !!ended;
}

export function createUser(data: {
  fullName: string;
  email: string;
  password: string;
  role: User["role"];
  pagePermissions?: string[];
}): User {
  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `
    INSERT INTO users (id, full_name, email, password_hash, role, page_permissions, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now','localtime'))
  `,
  ).run(
    id,
    data.fullName,
    normalizeEmail(data.email),
    hashPassword(data.password),
    data.role,
    serializePagePermissions(data.pagePermissions),
  );

  return getUserById(id)!;
}

export function updateUser(
  id: string,
  data: {
    fullName?: string;
    email?: string;
    password?: string;
    role?: User["role"];
    pagePermissions?: string[];
    isActive?: boolean;
  },
): User | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.fullName !== undefined) {
    fields.push("full_name = ?");
    values.push(data.fullName);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    values.push(normalizeEmail(data.email));
  }
  if (data.password !== undefined && data.password.length > 0) {
    fields.push("password_hash = ?");
    values.push(hashPassword(data.password));
  }
  if (data.role !== undefined) {
    fields.push("role = ?");
    values.push(data.role);
  }
  if (data.pagePermissions !== undefined) {
    fields.push("page_permissions = ?");
    values.push(serializePagePermissions(data.pagePermissions));
  }
  if (data.isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(data.isActive ? 1 : 0);
  }

  if (fields.length === 0) return getUserById(id);

  values.push(id);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getUserById(id);
}

export function deleteUser(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getUserActivityById(id: string): UserActivityReport | null {
  const user = getUserById(id);
  if (!user) {
    return null;
  }
  return getUserActivityReport(user);
}

export function getUserShiftOperations(shiftId: string): UserShiftOperation[] {
  return listUserShiftOperations(shiftId);
}
