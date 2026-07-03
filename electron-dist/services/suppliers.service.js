"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSuppliers = listSuppliers;
exports.listSuppliersPaged = listSuppliersPaged;
exports.getSupplierById = getSupplierById;
exports.createSupplier = createSupplier;
exports.updateSupplier = updateSupplier;
exports.deleteSupplier = deleteSupplier;
exports.deleteAllSuppliers = deleteAllSuppliers;
exports.listSupplierOperations = listSupplierOperations;
exports.createSupplierOperation = createSupplierOperation;
exports.settleSupplierDebt = settleSupplierDebt;
exports.settleSupplierDebtAll = settleSupplierDebtAll;
const database_1 = require("../database");
// ============================================
// Suppliers Service
// ============================================
function rowToSupplier(row) {
    return {
        id: row.id,
        supplierCode: row.supplier_code,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        notes: row.notes,
        debt: row.debt,
        totalPurchases: row.total_purchases,
        totalPaid: row.total_paid,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function rowToSupplierOperation(row) {
    return {
        id: row.id,
        supplierId: row.supplier_id,
        type: row.type,
        purchaseAmount: row.purchase_amount,
        paidAmount: row.paid_amount,
        debtBefore: row.debt_before,
        debtAfter: row.debt_after,
        note: row.note,
        createdAt: row.created_at,
    };
}
function getSupplierBalanceRow(db, supplierId) {
    const row = db
        .prepare(`
      SELECT id, debt, total_purchases, total_paid
      FROM suppliers
      WHERE id = ?
    `)
        .get(supplierId);
    if (!row) {
        throw new Error("المورد غير موجود.");
    }
    return row;
}
function getSupplierOperationById(id) {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare("SELECT * FROM supplier_operations WHERE id = ?")
        .get(id);
    return row ? rowToSupplierOperation(row) : null;
}
function listSuppliers() {
    const db = (0, database_1.getDb)();
    const rows = db
        .prepare("SELECT * FROM suppliers ORDER BY created_at DESC")
        .all();
    return rows.map(rowToSupplier);
}
function listSuppliersPaged(query = {}) {
    const db = (0, database_1.getDb)();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const clauses = [];
    const params = [];
    if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        clauses.push("(supplier_code LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)");
        params.push(term, term, term, term);
    }
    const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
    const total = db
        .prepare(`SELECT COUNT(*) AS count FROM suppliers${whereSql}`)
        .get(...params).count;
    const rows = db
        .prepare(`SELECT * FROM suppliers${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, offset);
    // Summary stats across all suppliers (not scoped by search)
    const summaryRow = db
        .prepare("SELECT COUNT(*) AS cnt, COALESCE(SUM(debt), 0) AS totalDebt, COALESCE(SUM(total_paid), 0) AS totalPaid FROM suppliers")
        .get();
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
function getSupplierById(id) {
    const db = (0, database_1.getDb)();
    const row = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
    return row ? rowToSupplier(row) : null;
}
function createSupplier(data) {
    const db = (0, database_1.getDb)();
    const id = crypto.randomUUID();
    const displayCode = data.supplierCode?.trim() || generateSupplierCode();
    db.prepare(`
    INSERT INTO suppliers (
      id, supplier_code, name, phone, email, address, notes, debt, total_purchases, total_paid, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `).run(id, displayCode, data.name.trim(), data.phone?.trim() ?? "", data.email?.trim() ?? "", data.address?.trim() ?? "", data.notes?.trim() ?? "", data.debt ?? 0, data.totalPurchases ?? 0, data.totalPaid ?? 0);
    return getSupplierById(id);
}
function updateSupplier(id, data) {
    const db = (0, database_1.getDb)();
    const fields = [];
    const values = [];
    const map = {
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
        const val = data[key];
        if (val !== undefined) {
            fields.push(`${col} = ?`);
            values.push(typeof val === "string" ? val.trim() : val);
        }
    }
    if (fields.length === 0)
        return getSupplierById(id);
    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);
    db.prepare(`UPDATE suppliers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return getSupplierById(id);
}
function deleteSupplier(id) {
    const db = (0, database_1.getDb)();
    const result = db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
    return result.changes > 0;
}
function deleteAllSuppliers() {
    const db = (0, database_1.getDb)();
    const result = db.prepare("DELETE FROM suppliers").run();
    return result.changes;
}
function listSupplierOperations(supplierId) {
    const db = (0, database_1.getDb)();
    const rows = db
        .prepare(`
      SELECT *
      FROM supplier_operations
      WHERE supplier_id = ?
      ORDER BY created_at DESC
    `)
        .all(supplierId);
    return rows.map(rowToSupplierOperation);
}
function createSupplierOperation(data) {
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
    const db = (0, database_1.getDb)();
    const operationId = db.transaction(() => {
        const supplier = getSupplierBalanceRow(db, data.supplierId);
        const debtBefore = supplier.debt;
        const debtAfter = debtBefore + (purchaseAmount - paidAmount);
        const id = crypto.randomUUID();
        db.prepare(`
      UPDATE suppliers
      SET
        total_purchases = total_purchases + ?,
        total_paid = total_paid + ?,
        debt = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(purchaseAmount, paidAmount, debtAfter, data.supplierId);
        db.prepare(`
      INSERT INTO supplier_operations (
        id, supplier_id, type, purchase_amount, paid_amount, debt_before, debt_after, note, created_at
      )
      VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(id, data.supplierId, purchaseAmount, paidAmount, debtBefore, debtAfter, note);
        return id;
    })();
    const supplier = getSupplierById(data.supplierId);
    const operation = getSupplierOperationById(operationId);
    if (!supplier || !operation) {
        throw new Error("فشل في تسجيل العملية.");
    }
    return { supplier, operation };
}
function settleSupplierDebt(data) {
    const amount = Number(data.amount);
    const note = data.note?.trim() ?? "";
    if (!data.supplierId?.trim()) {
        throw new Error("يرجى اختيار المورد.");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("قيمة التسوية يجب أن تكون أكبر من صفر.");
    }
    const db = (0, database_1.getDb)();
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
        db.prepare(`
      UPDATE suppliers
      SET
        total_paid = total_paid + ?,
        debt = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(amount, debtAfter, data.supplierId);
        db.prepare(`
      INSERT INTO supplier_operations (
        id, supplier_id, type, purchase_amount, paid_amount, debt_before, debt_after, note, created_at
      )
      VALUES (?, ?, 'settlement', 0, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(id, data.supplierId, amount, debtBefore, debtAfter, note);
        return id;
    })();
    const supplier = getSupplierById(data.supplierId);
    const operation = getSupplierOperationById(operationId);
    if (!supplier || !operation) {
        throw new Error("فشل في تسجيل التسوية.");
    }
    return { supplier, operation };
}
function settleSupplierDebtAll(supplierId, note) {
    if (!supplierId?.trim()) {
        throw new Error("يرجى اختيار المورد.");
    }
    const db = (0, database_1.getDb)();
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
        db.prepare(`
      UPDATE suppliers
      SET
        total_paid = total_paid + ?,
        debt = 0,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(amount, supplierId);
        db.prepare(`
      INSERT INTO supplier_operations (
        id, supplier_id, type, purchase_amount, paid_amount, debt_before, debt_after, note, created_at
      )
      VALUES (?, ?, 'settlement', 0, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(id, supplierId, amount, debtBefore, debtAfter, operationNote);
        return id;
    })();
    const supplier = getSupplierById(supplierId);
    const operation = getSupplierOperationById(operationId);
    if (!supplier || !operation) {
        throw new Error("فشل في تسوية المديونية.");
    }
    return { supplier, operation };
}
function generateSupplierCode() {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare(`
      SELECT supplier_code AS code
      FROM suppliers
      WHERE supplier_code LIKE 'S-%'
      ORDER BY CAST(SUBSTR(supplier_code, 3) AS INTEGER) DESC
      LIMIT 1
    `)
        .get();
    const lastNumber = row?.code && /^S-\d+$/.test(row.code)
        ? Number.parseInt(row.code.slice(2), 10)
        : 0;
    return `S-${String(lastNumber + 1).padStart(4, "0")}`;
}
