"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.listUsersPaged = listUsersPaged;
exports.getUserById = getUserById;
exports.authenticateUser = authenticateUser;
exports.logoutUserSession = logoutUserSession;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.getUserActivityById = getUserActivityById;
exports.getUserShiftOperations = getUserShiftOperations;
const database_1 = require("../database");
const user_shifts_service_1 = require("./user-shifts.service");
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
];
// ============================================
// Users Service
// ============================================
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function normalizePagePermissionsInput(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const allowed = new Set(APP_PAGE_IDS);
    const picked = new Set();
    value.forEach((item) => {
        if (typeof item !== "string") {
            return;
        }
        if (allowed.has(item)) {
            picked.add(item);
        }
    });
    return APP_PAGE_IDS.filter((page) => picked.has(page));
}
function parsePagePermissions(raw) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return normalizePagePermissionsInput(parsed);
    }
    catch {
        return [];
    }
}
function serializePagePermissions(value) {
    return JSON.stringify(normalizePagePermissionsInput(value));
}
function rowToUser(row) {
    return {
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
        pagePermissions: parsePagePermissions(row.page_permissions),
        isActive: row.is_active === 1,
        createdAt: row.created_at,
    };
}
function listUsers() {
    const db = (0, database_1.getDb)();
    const rows = db
        .prepare("SELECT id, full_name, email, role, page_permissions, is_active, created_at FROM users ORDER BY created_at DESC")
        .all();
    return rows.map(rowToUser);
}
function listUsersPaged(query = {}) {
    const db = (0, database_1.getDb)();
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const clauses = [];
    const params = [];
    if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        clauses.push("(full_name LIKE ? OR email LIKE ? OR role LIKE ?)");
        params.push(term, term, term);
    }
    const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
    const total = db
        .prepare(`SELECT COUNT(*) AS count FROM users${whereSql}`)
        .get(...params).count;
    const rows = db
        .prepare(`SELECT id, full_name, email, role, page_permissions, is_active, created_at FROM users${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
        .all(...params, pageSize, offset);
    // Summary stats across ALL users (not scoped by search)
    const adminsCount = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
        .get().count;
    const totalCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
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
function getUserById(id) {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare("SELECT id, full_name, email, role, page_permissions, is_active, created_at FROM users WHERE id = ?")
        .get(id);
    return row ? rowToUser(row) : null;
}
function authenticateUser(email, password) {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare("SELECT id, full_name, email, password_hash, role, page_permissions, is_active, created_at FROM users WHERE email = ?")
        .get(normalizeEmail(email));
    if (!row) {
        return {
            success: false,
            error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        };
    }
    if (row.is_active !== 1) {
        return { success: false, error: "هذا الحساب معطل" };
    }
    const expectedHash = row.password_hash;
    const inputHash = (0, database_1.hashPassword)(password);
    if (inputHash !== expectedHash) {
        return {
            success: false,
            error: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        };
    }
    const user = rowToUser(row);
    const shift = (0, user_shifts_service_1.startUserShift)({
        userId: user.id,
        userName: user.fullName,
        userRole: user.role,
    });
    return { success: true, user, shiftId: shift.id };
}
function logoutUserSession(userId, shiftId) {
    const ended = (0, user_shifts_service_1.endUserShift)(userId, shiftId);
    return !!ended;
}
function createUser(data) {
    const db = (0, database_1.getDb)();
    const id = crypto.randomUUID();
    db.prepare(`
    INSERT INTO users (id, full_name, email, password_hash, role, page_permissions, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now','localtime'))
  `).run(id, data.fullName, normalizeEmail(data.email), (0, database_1.hashPassword)(data.password), data.role, serializePagePermissions(data.pagePermissions));
    return getUserById(id);
}
function updateUser(id, data) {
    const db = (0, database_1.getDb)();
    const fields = [];
    const values = [];
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
        values.push((0, database_1.hashPassword)(data.password));
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
    if (fields.length === 0)
        return getUserById(id);
    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return getUserById(id);
}
function deleteUser(id) {
    const db = (0, database_1.getDb)();
    const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return result.changes > 0;
}
function getUserActivityById(id) {
    const user = getUserById(id);
    if (!user) {
        return null;
    }
    return (0, user_shifts_service_1.getUserActivityReport)(user);
}
function getUserShiftOperations(shiftId) {
    return (0, user_shifts_service_1.listUserShiftOperations)(shiftId);
}
