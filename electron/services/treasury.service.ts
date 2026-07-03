import { getDb } from "../database";
import type {
  TreasuryOperation,
  TreasurySummary,
  TreasuryOperationRow,
} from "../shared/types";

// ============================================
// Treasury Service
// ============================================

function rowToOp(row: Record<string, unknown>): TreasuryOperation {
  return {
    id: row.id as string,
    type: row.type as TreasuryOperation["type"],
    name: row.name as string,
    amount: row.amount as number,
    userId: row.user_id as string,
    user: row.user as string,
    date: row.date as string,
    createdAt: row.created_at as string,
  };
}

export function listTreasuryOps(): TreasuryOperation[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM treasury_ops ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];
  return rows.map(rowToOp);
}

export function createTreasuryOp(data: {
  type: TreasuryOperation["type"];
  name: string;
  amount: number;
  userId?: string;
  user?: string;
  date: string;
}): TreasuryOperation {
  // Input validation
  const trimmedName = (data.name ?? "").trim();
  if (!trimmedName) {
    throw new Error("اسم العملية مطلوب.");
  }
  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("المبلغ يجب أن يكون رقمًا موجبًا.");
  }
  if (data.type !== "withdraw" && data.type !== "expense") {
    throw new Error("نوع العملية غير صالح. يجب أن يكون سحب أو مصروف.");
  }
  if (!data.date || isNaN(Date.parse(data.date))) {
    throw new Error("التاريخ غير صالح.");
  }

  const db = getDb();
  const id = crypto.randomUUID();
  db.prepare(
    `
    INSERT INTO treasury_ops (id, type, name, amount, user_id, user, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `,
  ).run(
    id,
    data.type,
    trimmedName,
    data.amount,
    data.userId?.trim() ?? "",
    data.user ?? "",
    data.date,
  );

  const row = db
    .prepare("SELECT * FROM treasury_ops WHERE id = ?")
    .get(id) as Record<string, unknown>;
  return rowToOp(row);
}

export function deleteTreasuryOp(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM treasury_ops WHERE id = ?").run(id);
  return result.changes > 0;
}

export function deleteAllTreasuryOps(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM treasury_ops").run();
  return result.changes;
}

/**
 * Get a full treasury summary: real sales + real returns + manual ops.
 */
export function getTreasurySummary(): TreasurySummary {
  const db = getDb();

  // Aggregate sales cash-in (keeps refunded sales for full cash movement tracking).
  const salesAgg = db
    .prepare(
      "SELECT COALESCE(SUM(MAX(amount_received - change_given, 0)), 0) AS total FROM sales WHERE status IN ('completed', 'refunded')",
    )
    .get() as { total: number };

  // Aggregate returns
  const returnsAgg = db
    .prepare(
      "SELECT COALESCE(SUM(refund_amount), 0) AS total FROM returns WHERE status = 'approved'",
    )
    .get() as { total: number };

  // Aggregate manual ops
  const withdrawalsAgg = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM treasury_ops WHERE type = 'withdraw'",
    )
    .get() as { total: number };

  const expensesAgg = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM treasury_ops WHERE type = 'expense'",
    )
    .get() as { total: number };

  // Build operation rows list (recent 200)
  const operations: TreasuryOperationRow[] = [];

  // Sales as rows (including refunded sales for complete history)
  const saleRows = db
    .prepare(
      "SELECT id, receipt_number, total, amount_received, change_given, cashier_id, cashier_name, created_at, status FROM sales WHERE status IN ('completed', 'refunded') ORDER BY created_at DESC LIMIT 200",
    )
    .all() as Record<string, unknown>[];
  for (const r of saleRows) {
    const netCollected = Math.max(
      0,
      (r.amount_received as number) - (r.change_given as number),
    );

    const saleLabel =
      r.status === "refunded"
        ? `فاتورة ${r.receipt_number as string} (مرتجعة)`
        : `فاتورة ${r.receipt_number as string}`;

    operations.push({
      id: r.id as string,
      type: "sale",
      name: saleLabel,
      amount: netCollected,
      userId: (r.cashier_id as string) || "",
      user: r.cashier_name as string,
      date: r.created_at as string,
      source: "system",
    });
  }

  // Returns as rows
  const returnRows = db
    .prepare(
      "SELECT id, return_number, refund_amount, processed_by_id, processed_by, created_at FROM returns WHERE status = 'approved' ORDER BY created_at DESC LIMIT 200",
    )
    .all() as Record<string, unknown>[];
  for (const r of returnRows) {
    operations.push({
      id: r.id as string,
      type: "return",
      name: `مرتجع ${r.return_number as string}`,
      amount: r.refund_amount as number,
      userId: (r.processed_by_id as string) || "",
      user: r.processed_by as string,
      date: r.created_at as string,
      source: "system",
    });
  }

  // Manual ops
  const manualRows = db
    .prepare("SELECT * FROM treasury_ops ORDER BY created_at DESC LIMIT 200")
    .all() as Record<string, unknown>[];
  for (const r of manualRows) {
    operations.push({
      id: r.id as string,
      type: r.type as TreasuryOperationRow["type"],
      name: r.name as string,
      amount: r.amount as number,
      userId: (r.user_id as string) || "",
      user: r.user as string,
      date: r.date as string,
      source: "manual",
    });
  }

  // Sort by date descending
  operations.sort((a, b) => b.date.localeCompare(a.date));

  return {
    totalSales: salesAgg.total,
    totalReturns: returnsAgg.total,
    totalWithdrawals: withdrawalsAgg.total,
    totalExpenses: expensesAgg.total,
    currentCash:
      salesAgg.total -
      returnsAgg.total -
      withdrawalsAgg.total -
      expensesAgg.total,
    operations: operations.slice(0, 200),
  };
}
