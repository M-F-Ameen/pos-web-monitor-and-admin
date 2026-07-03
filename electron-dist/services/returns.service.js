"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReturns = listReturns;
exports.listReturnsPaged = listReturnsPaged;
exports.getReturnById = getReturnById;
exports.createReturn = createReturn;
exports.createReturnsBatch = createReturnsBatch;
exports.updateReturnStatus = updateReturnStatus;
exports.deleteReturn = deleteReturn;
exports.deleteAllReturns = deleteAllReturns;
const database_1 = require("../database");
const products_service_1 = require("./products.service");
// ============================================
// Returns Service
// ============================================
const RETURN_NUMBER_MAX_GENERATION_ATTEMPTS = 12;
function rowToReturn(row) {
    return {
        id: row.id,
        returnNumber: row.return_number,
        saleId: row.sale_id || null,
        productId: row.product_id,
        productName: row.product_name,
        quantity: row.quantity,
        refundAmount: row.refund_amount,
        reason: row.reason,
        status: row.status,
        processedById: row.processed_by_id,
        processedBy: row.processed_by,
        createdAt: row.created_at,
    };
}
function toCompactTimePart(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}${mm}${ss}`;
}
function generateReturnNumberCandidate() {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
    const timePart = toCompactTimePart(now);
    const suffix = crypto
        .randomUUID()
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase();
    return `RET-${datePart}-${timePart}-${suffix}`;
}
function isUniqueConstraintErrorFor(error, tableName, columnName) {
    if (!(error instanceof Error))
        return false;
    return (error.message.includes("UNIQUE constraint failed") &&
        error.message.includes(`${tableName}.${columnName}`));
}
function normalizeSqlDateBoundary(value, boundary) {
    const trimmed = value?.trim();
    if (!trimmed)
        return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed} ${boundary === "start" ? "00:00:00" : "23:59:59"}`;
    }
    return trimmed.replace("T", " ").slice(0, 19);
}
function normalizeStatuses(statuses) {
    if (!Array.isArray(statuses))
        return [];
    const allowed = new Set([
        "approved",
        "pending",
        "rejected",
    ]);
    return statuses.filter((status) => allowed.has(status));
}
function clampPage(value) {
    if (!Number.isFinite(value) || !value)
        return 1;
    return Math.max(1, Math.trunc(value));
}
function clampPageSize(value, fallback = 20) {
    if (!Number.isFinite(value) || !value)
        return fallback;
    return Math.min(500, Math.max(1, Math.trunc(value)));
}
function buildReturnsWhereClause(query) {
    const clauses = [];
    const params = [];
    const search = query?.search?.trim().toLowerCase();
    if (search) {
        const searchLike = `%${search}%`;
        clauses.push(`(
        LOWER(return_number) LIKE ?
        OR LOWER(product_name) LIKE ?
        OR LOWER(reason) LIKE ?
        OR LOWER(processed_by) LIKE ?
      )`);
        params.push(searchLike, searchLike, searchLike, searchLike);
    }
    const statuses = normalizeStatuses(query?.statuses);
    if (statuses.length > 0) {
        clauses.push(`status IN (${statuses.map(() => "?").join(", ")})`);
        params.push(...statuses);
    }
    if (query?.saleId?.trim()) {
        clauses.push("sale_id = ?");
        params.push(query.saleId.trim());
    }
    if (query?.productId?.trim()) {
        clauses.push("product_id = ?");
        params.push(query.productId.trim());
    }
    if (query?.processedById?.trim()) {
        clauses.push("processed_by_id = ?");
        params.push(query.processedById.trim());
    }
    const fromDate = normalizeSqlDateBoundary(query?.fromDate, "start");
    if (fromDate) {
        clauses.push("created_at >= ?");
        params.push(fromDate);
    }
    const toDate = normalizeSqlDateBoundary(query?.toDate, "end");
    if (toDate) {
        clauses.push("created_at <= ?");
        params.push(toDate);
    }
    if (clauses.length === 0) {
        return { whereSql: "", params };
    }
    return {
        whereSql: ` WHERE ${clauses.join(" AND ")}`,
        params,
    };
}
function validateReturnInput(data) {
    if (!data.productName?.trim()) {
        throw new Error("Return product name is required.");
    }
    if (!Number.isInteger(data.quantity) || data.quantity <= 0) {
        throw new Error("Return quantity must be a positive integer.");
    }
    if (!Number.isFinite(data.refundAmount) || data.refundAmount < 0) {
        throw new Error("Return refund amount is invalid.");
    }
}
function normalizeReturnStatus(value) {
    if (value === "approved" || value === "rejected" || value === "pending") {
        return value;
    }
    return "pending";
}
function getUniqueReturnNumber(db, used) {
    const existsStmt = db.prepare("SELECT 1 AS found FROM returns WHERE return_number = ? LIMIT 1");
    for (let attempt = 1; attempt <= RETURN_NUMBER_MAX_GENERATION_ATTEMPTS; attempt += 1) {
        const candidate = generateReturnNumberCandidate();
        if (used.has(candidate))
            continue;
        const exists = existsStmt.get(candidate);
        if (!exists) {
            used.add(candidate);
            return candidate;
        }
    }
    throw new Error("Could not generate a unique return number. Please retry.");
}
function listReturns(query = {}) {
    const db = (0, database_1.getDb)();
    const { whereSql, params } = buildReturnsWhereClause(query);
    let sql = `SELECT * FROM returns${whereSql} ORDER BY created_at DESC`;
    const stmtParams = [...params];
    if (query.pageSize !== undefined) {
        const page = clampPage(query.page);
        const pageSize = clampPageSize(query.pageSize, 20);
        const offset = (page - 1) * pageSize;
        sql += " LIMIT ? OFFSET ?";
        stmtParams.push(pageSize, offset);
    }
    const rows = db.prepare(sql).all(...stmtParams);
    return rows.map(rowToReturn);
}
function listReturnsPaged(query = {}) {
    const db = (0, database_1.getDb)();
    const { whereSql, params } = buildReturnsWhereClause(query);
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize, 20);
    const offset = (page - 1) * pageSize;
    const total = db
        .prepare(`SELECT COUNT(*) AS count FROM returns${whereSql}`)
        .get(...params).count;
    const rows = db
        .prepare(`SELECT * FROM returns${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, offset);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
        items: rows.map(rowToReturn),
        total,
        page,
        pageSize,
        totalPages,
    };
}
function getReturnById(id) {
    const db = (0, database_1.getDb)();
    const row = db.prepare("SELECT * FROM returns WHERE id = ?").get(id);
    return row ? rowToReturn(row) : null;
}
/**
 * Create a return atomically:
 * 1. Insert the return record
 * 2. If status is 'approved', restore stock
 */
function createReturn(data) {
    validateReturnInput(data);
    const db = (0, database_1.getDb)();
    const status = normalizeReturnStatus(data.status);
    const normalizedRefundAmount = Math.round(data.refundAmount * 100) / 100;
    const preferredReturnNumber = null;
    const maxAttempts = preferredReturnNumber
        ? 1
        : RETURN_NUMBER_MAX_GENERATION_ATTEMPTS;
    let lastCollisionError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const id = crypto.randomUUID();
        const returnNumber = preferredReturnNumber ?? generateReturnNumberCandidate();
        try {
            const txn = db.transaction(() => {
                db.prepare(`
          INSERT INTO returns (id, return_number, sale_id, product_id, product_name, quantity, refund_amount, reason, status, processed_by_id, processed_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
        `).run(id, returnNumber, data.saleId || null, data.productId ?? "", data.productName.trim(), data.quantity, normalizedRefundAmount, data.reason?.trim() ?? "", status, data.processedById?.trim() ?? "", data.processedByName?.trim() ?? data.processedBy?.trim() ?? "");
                // Restore stock if approved
                if (status === "approved" && data.productId) {
                    (0, products_service_1.incrementStock)(data.productId, data.quantity);
                }
            });
            txn();
            return getReturnById(id);
        }
        catch (error) {
            if (isUniqueConstraintErrorFor(error, "returns", "return_number")) {
                lastCollisionError = error;
                continue;
            }
            throw error;
        }
    }
    throw new Error(`Failed to create return due to number collisions. ${lastCollisionError instanceof Error ? lastCollisionError.message : ""}`.trim());
}
function createReturnsBatch(input) {
    const db = (0, database_1.getDb)();
    const entries = input.entries ?? [];
    if (entries.length === 0)
        return [];
    for (const entry of entries) {
        validateReturnInput(entry);
    }
    const createdIds = [];
    const txn = db.transaction(() => {
        const insertReturn = db.prepare(`
      INSERT INTO returns (id, return_number, sale_id, product_id, product_name, quantity, refund_amount, reason, status, processed_by_id, processed_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `);
        const usedNumbers = new Set();
        for (const entry of entries) {
            const id = crypto.randomUUID();
            const status = normalizeReturnStatus(entry.status);
            const returnNumber = getUniqueReturnNumber(db, usedNumbers);
            const normalizedRefundAmount = Math.round((entry.refundAmount + Number.EPSILON) * 100) / 100;
            insertReturn.run(id, returnNumber, entry.saleId || null, entry.productId ?? "", entry.productName.trim(), entry.quantity, normalizedRefundAmount, entry.reason?.trim() ?? "", status, entry.processedById?.trim() ?? "", entry.processedByName?.trim() ?? entry.processedBy?.trim() ?? "");
            if (status === "approved" && entry.productId) {
                (0, products_service_1.incrementStock)(entry.productId, entry.quantity);
            }
            createdIds.push(id);
        }
    });
    txn();
    const placeholders = createdIds.map(() => "?").join(", ");
    const rows = db
        .prepare(`SELECT * FROM returns WHERE id IN (${placeholders})`)
        .all(...createdIds);
    return rows.map(rowToReturn);
}
function updateReturnStatus(id, status) {
    const db = (0, database_1.getDb)();
    const existing = getReturnById(id);
    if (!existing)
        return null;
    const normalizedStatus = normalizeReturnStatus(status);
    const txn = db.transaction(() => {
        db.prepare("UPDATE returns SET status = ? WHERE id = ?").run(normalizedStatus, id);
        // If moving to approved, restore stock
        if (normalizedStatus === "approved" &&
            existing.status !== "approved" &&
            existing.productId) {
            (0, products_service_1.incrementStock)(existing.productId, existing.quantity);
        }
        else if (normalizedStatus !== "approved" &&
            existing.status === "approved" &&
            existing.productId) {
            // Revert previously-restored stock when un-approving a return.
            (0, products_service_1.decrementStock)([{ productId: existing.productId, quantity: existing.quantity }], false);
        }
    });
    txn();
    return getReturnById(id);
}
function deleteReturn(id) {
    const db = (0, database_1.getDb)();
    const existing = getReturnById(id);
    if (!existing)
        return false;
    const txn = db.transaction(() => {
        if (existing.status === "approved" && existing.productId) {
            (0, products_service_1.decrementStock)([{ productId: existing.productId, quantity: existing.quantity }], false);
        }
        const result = db.prepare("DELETE FROM returns WHERE id = ?").run(id);
        return result.changes > 0;
    });
    return txn();
}
function deleteAllReturns() {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        const approvedReturns = db
            .prepare("SELECT * FROM returns WHERE status = 'approved'")
            .all();
        for (const row of approvedReturns) {
            const entry = rowToReturn(row);
            if (!entry.productId)
                continue;
            // Check if product still exists before decrementing stock
            const productExists = db
                .prepare("SELECT 1 FROM products WHERE id = ? LIMIT 1")
                .get(entry.productId);
            if (!productExists)
                continue;
            (0, products_service_1.decrementStock)([{ productId: entry.productId, quantity: entry.quantity }], true);
        }
        const result = db.prepare("DELETE FROM returns").run();
        return result.changes;
    });
    return txn();
}
