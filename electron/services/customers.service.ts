import { getDb } from "../database";
import type {
  Customer,
  CustomersListQuery,
  CustomersPagedResult,
} from "../shared/types";

// ============================================
// Customers Service
// ============================================

function rowToCustomer(row: Record<string, unknown>): Customer {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    name: row.name as string,
    phone: row.phone as string,
    email: row.email as string,
    address: row.address as string,
    notes: row.notes as string,
    debt: row.debt as number,
    totalPurchases: row.total_purchases as number,
    totalSpent: row.total_spent as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function listCustomers(): Customer[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM customers ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToCustomer);
}

export function listCustomersPaged(
  query: CustomersListQuery = {},
): CustomersPagedResult {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    clauses.push(
      "(customer_id LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)",
    );
    params.push(term, term, term, term);
  }

  const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM customers${whereSql}`)
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT * FROM customers${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  // Summary stats across ALL customers (not scoped by search)
  const summaryRow = db
    .prepare(
      "SELECT COUNT(*) AS cnt, COALESCE(SUM(debt), 0) AS totalDebt, COALESCE(SUM(total_spent), 0) AS totalSpent FROM customers",
    )
    .get() as { cnt: number; totalDebt: number; totalSpent: number };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: rows.map(rowToCustomer),
    total,
    page,
    pageSize,
    totalPages,
    totalDebt: summaryRow.totalDebt,
    totalSpent: summaryRow.totalSpent,
    totalCount: summaryRow.cnt,
  };
}

export function getCustomerById(id: string): Customer | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCustomer(row) : null;
}

export function createCustomer(data: {
  customerId?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  debt?: number;
}): Customer {
  const db = getDb();
  const id = crypto.randomUUID();
  const displayId = data.customerId || generateCustomerId();

  db.prepare(
    `
    INSERT INTO customers (id, customer_id, name, phone, email, address, notes, debt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `,
  ).run(
    id,
    displayId,
    data.name.trim(),
    data.phone?.trim() ?? "",
    data.email?.trim() ?? "",
    data.address?.trim() ?? "",
    data.notes?.trim() ?? "",
    data.debt ?? 0,
  );

  return getCustomerById(id)!;
}

export function updateCustomer(
  id: string,
  data: Partial<{
    customerId: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    debt: number;
  }>,
): Customer | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  const map: Record<string, string> = {
    customerId: "customer_id",
    name: "name",
    phone: "phone",
    email: "email",
    address: "address",
    notes: "notes",
    debt: "debt",
  };

  for (const [key, col] of Object.entries(map)) {
    const val = (data as Record<string, unknown>)[key];
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      values.push(typeof val === "string" ? val.trim() : val);
    }
  }

  if (fields.length === 0) return getCustomerById(id);

  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);

  db.prepare(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getCustomerById(id);
}

export function deleteCustomer(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  return result.changes > 0;
}

export function deleteAllCustomers(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM customers").run();
  return result.changes;
}

function generateCustomerId(): string {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM customers").get() as {
    count: number;
  };
  return `C-${String(row.count + 1).padStart(4, "0")}`;
}
