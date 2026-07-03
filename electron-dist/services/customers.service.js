"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomers = listCustomers;
exports.listCustomersPaged = listCustomersPaged;
exports.getCustomerById = getCustomerById;
exports.createCustomer = createCustomer;
exports.updateCustomer = updateCustomer;
exports.deleteCustomer = deleteCustomer;
exports.deleteAllCustomers = deleteAllCustomers;
const database_1 = require("../database");
// ============================================
// Customers Service
// ============================================
function rowToCustomer(row) {
    return {
        id: row.id,
        customerId: row.customer_id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        notes: row.notes,
        debt: row.debt,
        totalPurchases: row.total_purchases,
        totalSpent: row.total_spent,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function listCustomers() {
    const db = (0, database_1.getDb)();
    const rows = db
        .prepare("SELECT * FROM customers ORDER BY created_at DESC")
        .all();
    return rows.map(rowToCustomer);
}
function listCustomersPaged(query = {}) {
    const db = (0, database_1.getDb)();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const clauses = [];
    const params = [];
    if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        clauses.push("(customer_id LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ?)");
        params.push(term, term, term, term);
    }
    const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
    const total = db
        .prepare(`SELECT COUNT(*) AS count FROM customers${whereSql}`)
        .get(...params).count;
    const rows = db
        .prepare(`SELECT * FROM customers${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, offset);
    // Summary stats across ALL customers (not scoped by search)
    const summaryRow = db
        .prepare("SELECT COUNT(*) AS cnt, COALESCE(SUM(debt), 0) AS totalDebt, COALESCE(SUM(total_spent), 0) AS totalSpent FROM customers")
        .get();
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
function getCustomerById(id) {
    const db = (0, database_1.getDb)();
    const row = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    return row ? rowToCustomer(row) : null;
}
function createCustomer(data) {
    const db = (0, database_1.getDb)();
    const id = crypto.randomUUID();
    const displayId = data.customerId || generateCustomerId();
    db.prepare(`
    INSERT INTO customers (id, customer_id, name, phone, email, address, notes, debt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `).run(id, displayId, data.name.trim(), data.phone?.trim() ?? "", data.email?.trim() ?? "", data.address?.trim() ?? "", data.notes?.trim() ?? "", data.debt ?? 0);
    return getCustomerById(id);
}
function updateCustomer(id, data) {
    const db = (0, database_1.getDb)();
    const fields = [];
    const values = [];
    const map = {
        customerId: "customer_id",
        name: "name",
        phone: "phone",
        email: "email",
        address: "address",
        notes: "notes",
        debt: "debt",
    };
    for (const [key, col] of Object.entries(map)) {
        const val = data[key];
        if (val !== undefined) {
            fields.push(`${col} = ?`);
            values.push(typeof val === "string" ? val.trim() : val);
        }
    }
    if (fields.length === 0)
        return getCustomerById(id);
    fields.push("updated_at = datetime('now','localtime')");
    values.push(id);
    db.prepare(`UPDATE customers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return getCustomerById(id);
}
function deleteCustomer(id) {
    const db = (0, database_1.getDb)();
    const result = db.prepare("DELETE FROM customers WHERE id = ?").run(id);
    return result.changes > 0;
}
function deleteAllCustomers() {
    const db = (0, database_1.getDb)();
    const result = db.prepare("DELETE FROM customers").run();
    return result.changes;
}
function generateCustomerId() {
    const db = (0, database_1.getDb)();
    const row = db.prepare("SELECT COUNT(*) as count FROM customers").get();
    return `C-${String(row.count + 1).padStart(4, "0")}`;
}
