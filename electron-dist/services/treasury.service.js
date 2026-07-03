"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTreasuryOps = listTreasuryOps;
exports.createTreasuryOp = createTreasuryOp;
exports.deleteTreasuryOp = deleteTreasuryOp;
exports.deleteAllTreasuryOps = deleteAllTreasuryOps;
exports.getTreasurySummary = getTreasurySummary;
const database_1 = require("../database");
// ============================================
// Treasury Service
// ============================================
function rowToOp(row) {
    return {
        id: row.id,
        type: row.type,
        name: row.name,
        amount: row.amount,
        userId: row.user_id,
        user: row.user,
        date: row.date,
        createdAt: row.created_at,
    };
}
function listTreasuryOps() {
    const db = (0, database_1.getDb)();
    const rows = db
        .prepare("SELECT * FROM treasury_ops ORDER BY created_at DESC")
        .all();
    return rows.map(rowToOp);
}
function createTreasuryOp(data) {
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
    const db = (0, database_1.getDb)();
    const id = crypto.randomUUID();
    db.prepare(`
    INSERT INTO treasury_ops (id, type, name, amount, user_id, user, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
  `).run(id, data.type, trimmedName, data.amount, data.userId?.trim() ?? "", data.user ?? "", data.date);
    const row = db
        .prepare("SELECT * FROM treasury_ops WHERE id = ?")
        .get(id);
    return rowToOp(row);
}
function deleteTreasuryOp(id) {
    const db = (0, database_1.getDb)();
    const result = db.prepare("DELETE FROM treasury_ops WHERE id = ?").run(id);
    return result.changes > 0;
}
function deleteAllTreasuryOps() {
    const db = (0, database_1.getDb)();
    const result = db.prepare("DELETE FROM treasury_ops").run();
    return result.changes;
}
/**
 * Get a full treasury summary: real sales + real returns + manual ops.
 */
function getTreasurySummary() {
    const db = (0, database_1.getDb)();
    // Aggregate sales cash-in (keeps refunded sales for full cash movement tracking).
    const salesAgg = db
        .prepare("SELECT COALESCE(SUM(MAX(amount_received - change_given, 0)), 0) AS total FROM sales WHERE status IN ('completed', 'refunded')")
        .get();
    // Aggregate returns
    const returnsAgg = db
        .prepare("SELECT COALESCE(SUM(refund_amount), 0) AS total FROM returns WHERE status = 'approved'")
        .get();
    // Aggregate manual ops
    const withdrawalsAgg = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM treasury_ops WHERE type = 'withdraw'")
        .get();
    const expensesAgg = db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM treasury_ops WHERE type = 'expense'")
        .get();
    // Build operation rows list (recent 200)
    const operations = [];
    // Sales as rows (including refunded sales for complete history)
    const saleRows = db
        .prepare("SELECT id, receipt_number, total, amount_received, change_given, cashier_id, cashier_name, created_at, status FROM sales WHERE status IN ('completed', 'refunded') ORDER BY created_at DESC LIMIT 200")
        .all();
    for (const r of saleRows) {
        const netCollected = Math.max(0, r.amount_received - r.change_given);
        const saleLabel = r.status === "refunded"
            ? `فاتورة ${r.receipt_number} (مرتجعة)`
            : `فاتورة ${r.receipt_number}`;
        operations.push({
            id: r.id,
            type: "sale",
            name: saleLabel,
            amount: netCollected,
            userId: r.cashier_id || "",
            user: r.cashier_name,
            date: r.created_at,
            source: "system",
        });
    }
    // Returns as rows
    const returnRows = db
        .prepare("SELECT id, return_number, refund_amount, processed_by_id, processed_by, created_at FROM returns WHERE status = 'approved' ORDER BY created_at DESC LIMIT 200")
        .all();
    for (const r of returnRows) {
        operations.push({
            id: r.id,
            type: "return",
            name: `مرتجع ${r.return_number}`,
            amount: r.refund_amount,
            userId: r.processed_by_id || "",
            user: r.processed_by,
            date: r.created_at,
            source: "system",
        });
    }
    // Manual ops
    const manualRows = db
        .prepare("SELECT * FROM treasury_ops ORDER BY created_at DESC LIMIT 200")
        .all();
    for (const r of manualRows) {
        operations.push({
            id: r.id,
            type: r.type,
            name: r.name,
            amount: r.amount,
            userId: r.user_id || "",
            user: r.user,
            date: r.date,
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
        currentCash: salesAgg.total -
            returnsAgg.total -
            withdrawalsAgg.total -
            expensesAgg.total,
        operations: operations.slice(0, 200),
    };
}
