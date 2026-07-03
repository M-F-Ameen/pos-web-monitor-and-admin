import { getDb } from "../database";
import type {
  CreateSupplierOperationInput,
  SettleSupplierDebtInput,
  Supplier,
  SupplierOperation,
  SupplierOperationResult,
  SuppliersListQuery,
  SuppliersPagedResult,
} from "../shared/types";

// ============================================
// Suppliers Service
// ============================================

function rowToSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: row.id as string,
    supplierCode: row.supplier_code as string,
    name: row.name as string,
    phone: row.phone as string,
    email: row.email as string,
    address: row.address as string,
    notes: row.notes as string,
    debt: row.debt as number,
    totalPurchases: row.total_purchases as number,
    totalPaid: row.total_paid as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToSupplierOperation(
  row: Record<string, unknown>,
): SupplierOperation {
  return {
    id: row.id as string,
    supplierId: row.supplier_id as string,
    type: row.type as SupplierOperation["type"],
    purchaseAmount: row.purchase_amount as number,
    paidAmount: row.paid_amount as number,
    debtBefore: row.debt_before as number,
    debtAfter: row.debt_after as number,
    note: row.note as string,
    createdAt: row.created_at as string,
  };
}

type SupplierBalanceRow = {
  id: string;
  debt: number;
  total_purchases: number;
  total_paid: number;
};

function getSupplierBalanceRow(
  db: ReturnType<typeof getDb>,
  supplierId: string,
): SupplierBalanceRow {
  const row = db
    .prepare(
      `
      SELECT id, debt, total_purchases, total_paid
      FROM suppliers
      WHERE id = ?
    `,
    )
    .get(supplierId) as SupplierBalanceRow | undefined;

  if (!row) {
    throw new Error("المورد غير موجود.");
  }

  return row;
}

function getSupplierOperationById(id: string): SupplierOperation | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM supplier_operations WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToSupplierOperation(row) : null;
}

export function listSuppliers(): Supplier[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM suppliers ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToSupplier);
}

export function listSuppliersPaged(
  query: SuppliersListQuery = {},
): SuppliersPagedResult {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    clauses.push(
      "(supplier_code LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)",
    );
    params.push(term, term, term, term);
  }

  const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM suppliers${whereSql}`)
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT * FROM suppliers${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  // Summary stats across all suppliers (not scoped by search)
  const summaryRow = db
    .prepare(
      "SELECT COUNT(*) AS cnt, COALESCE(SUM(debt), 0) AS totalDebt, COALESCE(SUM(total_paid), 0) AS totalPaid FROM suppliers",
    )
    .get() as { cnt: number; totalDebt: number; totalPaid: number };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: rows.map(rowToSupplier),
    total,
    page,
    pageSize,
    totalPages,
    totalDebt: summaryRow.totalDebt,
    totalPaid: summaryRow.totalPaid,
    totalCount: summaryRow.cnt,
  };
}

export function getSupplierById(id: string): Supplier | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToSupplier(row) : null;
}

export function createSupplier(data: {
  supplierCode?: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  debt?: number;
  totalPurchases?: number;
  totalPaid?: number;
}): Supplier {
  const db = getDb();
  const id = crypto.randomUUID();
  const displayCode = data.supplierCode?.trim() || generateSupplierCode();

  db.prepare(
    `
    INSERT INTO suppliers (
      id, supplier_code, name, phone, email, address, notes, debt, total_purchases, total_paid, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `,
  ).run(
    id,
    displayCode,
    data.name.trim(),
    data.phone?.trim() ?? "",
    data.email?.trim() ?? "",
    data.address?.trim() ?? "",
    data.notes?.trim() ?? "",
    data.debt ?? 0,
    data.totalPurchases ?? 0,
    data.totalPaid ?? 0,
  );

  return getSupplierById(id)!;
}

export function updateSupplier(
  id: string,
  data: Partial<{
    supplierCode: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    notes: string;
    debt: number;
    totalPurchases: number;
    totalPaid: number;
  }>,
): Supplier | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  const map: Record<string, string> = {
    supplierCode: "supplier_code",
    name: "name",
    phone: "phone",
    email: "email",
    address: "address",
    notes: "notes",
    debt: "debt",
    totalPurchases: "total_purchases",
    totalPaid: "total_paid",
  };

  for (const [key, col] of Object.entries(map)) {
    const val = (data as Record<string, unknown>)[key];
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      values.push(typeof val === "string" ? val.trim() : val);
    }
  }

  if (fields.length === 0) return getSupplierById(id);

  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);

  db.prepare(`UPDATE suppliers SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getSupplierById(id);
}

export function deleteSupplier(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
  return result.changes > 0;
}

export function deleteAllSuppliers(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM suppliers").run();
  return result.changes;
}

export function listSupplierOperations(supplierId: string): SupplierOperation[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT *
      FROM supplier_operations
      WHERE supplier_id = ?
      ORDER BY created_at DESC
    `,
    )
    .all(supplierId) as Record<string, unknown>[];
  return rows.map(rowToSupplierOperation);
}

export function createSupplierOperation(
  data: CreateSupplierOperationInput,
): SupplierOperationResult {
  const purchaseAmount = Number(data.purchaseAmount);
  const paidAmount = Number(data.paidAmount);
  const note = data.note?.trim() ?? "";

  if (!data.supplierId?.trim()) {
    throw new Error("يرجى اختيار المورد.");
  }
  if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
    throw new Error("قيمة المشتريات يجب أن تكون أكبر من صفر.");
  }
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error("المبلغ المدفوع غير صالح.");
  }
  if (paidAmount > purchaseAmount) {
    throw new Error("المبلغ المدفوع لا يمكن أن يكون أكبر من قيمة المشتريات.");
  }

  const db = getDb();

  const operationId = db.transaction(() => {
    const supplier = getSupplierBalanceRow(db, data.supplierId);
    const debtBefore = supplier.debt;
    const debtAfter = debtBefore + (purchaseAmount - paidAmount);
    const id = crypto.randomUUID();

    db.prepare(
      `
      UPDATE suppliers
      SET
        total_purchases = total_purchases + ?,
        total_paid = total_paid + ?,
        debt = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `,
    ).run(purchaseAmount, paidAmount, debtAfter, data.supplierId);

    db.prepare(
      `
      INSERT INTO supplier_operations (
        id, supplier_id, type, purchase_amount, paid_amount, debt_before, debt_after, note, created_at
      )
      VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?, datetime('now','localtime'))
    `,
    ).run(
      id,
      data.supplierId,
      purchaseAmount,
      paidAmount,
      debtBefore,
      debtAfter,
      note,
    );

    return id;
  })();

  const supplier = getSupplierById(data.supplierId);
  const operation = getSupplierOperationById(operationId);

  if (!supplier || !operation) {
    throw new Error("فشل في تسجيل العملية.");
  }

  return { supplier, operation };
}

export function settleSupplierDebt(
  data: SettleSupplierDebtInput,
): SupplierOperationResult {
  const amount = Number(data.amount);
  const note = data.note?.trim() ?? "";

  if (!data.supplierId?.trim()) {
    throw new Error("يرجى اختيار المورد.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("قيمة التسوية يجب أن تكون أكبر من صفر.");
  }

  const db = getDb();

  const operationId = db.transaction(() => {
    const supplier = getSupplierBalanceRow(db, data.supplierId);

    if (supplier.debt <= 0) {
      throw new Error("لا توجد مديونية على هذا المورد.");
    }
    if (amount > supplier.debt) {
      throw new Error("قيمة التسوية أكبر من المديونية الحالية.");
    }

    const debtBefore = supplier.debt;
    const debtAfter = debtBefore - amount;
    const id = crypto.randomUUID();

    db.prepare(
      `
      UPDATE suppliers
      SET
        total_paid = total_paid + ?,
        debt = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `,
    ).run(amount, debtAfter, data.supplierId);

    db.prepare(
      `
      INSERT INTO supplier_operations (
        id, supplier_id, type, purchase_amount, paid_amount, debt_before, debt_after, note, created_at
      )
      VALUES (?, ?, 'settlement', 0, ?, ?, ?, ?, datetime('now','localtime'))
    `,
    ).run(id, data.supplierId, amount, debtBefore, debtAfter, note);

    return id;
  })();

  const supplier = getSupplierById(data.supplierId);
  const operation = getSupplierOperationById(operationId);

  if (!supplier || !operation) {
    throw new Error("فشل في تسجيل التسوية.");
  }

  return { supplier, operation };
}

export function settleSupplierDebtAll(
  supplierId: string,
  note?: string,
): SupplierOperationResult {
  if (!supplierId?.trim()) {
    throw new Error("يرجى اختيار المورد.");
  }

  const db = getDb();
  const operationNote = note?.trim() ?? "";

  const operationId = db.transaction(() => {
    const supplier = getSupplierBalanceRow(db, supplierId);

    if (supplier.debt <= 0) {
      throw new Error("لا توجد مديونية لتسويتها.");
    }

    const amount = supplier.debt;
    const debtBefore = supplier.debt;
    const debtAfter = 0;
    const id = crypto.randomUUID();

    db.prepare(
      `
      UPDATE suppliers
      SET
        total_paid = total_paid + ?,
        debt = 0,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `,
    ).run(amount, supplierId);

    db.prepare(
      `
      INSERT INTO supplier_operations (
        id, supplier_id, type, purchase_amount, paid_amount, debt_before, debt_after, note, created_at
      )
      VALUES (?, ?, 'settlement', 0, ?, ?, ?, ?, datetime('now','localtime'))
    `,
    ).run(id, supplierId, amount, debtBefore, debtAfter, operationNote);

    return id;
  })();

  const supplier = getSupplierById(supplierId);
  const operation = getSupplierOperationById(operationId);

  if (!supplier || !operation) {
    throw new Error("فشل في تسوية المديونية.");
  }

  return { supplier, operation };
}

function generateSupplierCode(): string {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT supplier_code AS code
      FROM suppliers
      WHERE supplier_code LIKE 'S-%'
      ORDER BY CAST(SUBSTR(supplier_code, 3) AS INTEGER) DESC
      LIMIT 1
    `,
    )
    .get() as { code: string } | undefined;

  const lastNumber =
    row?.code && /^S-\d+$/.test(row.code)
      ? Number.parseInt(row.code.slice(2), 10)
      : 0;

  return `S-${String(lastNumber + 1).padStart(4, "0")}`;
}
