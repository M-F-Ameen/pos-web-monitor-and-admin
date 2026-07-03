"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCategories = listCategories;
exports.getCategoryById = getCategoryById;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
exports.deleteAllCategories = deleteAllCategories;
const database_1 = require("../database");
// ============================================
// Categories Service
// ============================================
function rowToCategory(row) {
    return {
        id: row.id,
        name: row.name,
        image: row.image || "",
        createdAt: row.created_at,
    };
}
function listCategories() {
    const db = (0, database_1.getDb)();
    const rows = db
        .prepare("SELECT * FROM categories ORDER BY created_at DESC")
        .all();
    return rows.map(rowToCategory);
}
function getCategoryById(id) {
    const db = (0, database_1.getDb)();
    const row = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
    return row ? rowToCategory(row) : null;
}
function createCategory(data) {
    const db = (0, database_1.getDb)();
    const id = crypto.randomUUID();
    const imageToSave = data.image ?? "";
    db.prepare(`
    INSERT INTO categories (id, name, image, created_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
  `).run(id, data.name.trim(), imageToSave);
    return getCategoryById(id);
}
function updateCategory(id, data) {
    const db = (0, database_1.getDb)();
    const fields = [];
    const values = [];
    if (data.name !== undefined) {
        fields.push("name = ?");
        values.push(data.name.trim());
    }
    if (data.image !== undefined) {
        fields.push("image = ?");
        values.push(data.image);
    }
    if (fields.length > 0) {
        values.push(id);
        db.prepare(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    }
    return getCategoryById(id);
}
function deleteCategory(id) {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        // Unlink products from deleted category
        db.prepare("UPDATE products SET category_id = '' WHERE category_id = ?").run(id);
        const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
        return result.changes > 0;
    });
    return txn();
}
function deleteAllCategories() {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        db.prepare("UPDATE products SET category_id = ''").run();
        const result = db.prepare("DELETE FROM categories").run();
        return result.changes;
    });
    return txn();
}
