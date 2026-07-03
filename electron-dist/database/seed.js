"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.seedDatabase = seedDatabase;
const node_crypto_1 = __importDefault(require("node:crypto"));
const connection_1 = require("./connection");
// ============================================
// Seed Data
// ============================================
/**
 * Hash a password using SHA-256.
 * For a local desktop POS, this is adequate.
 * For network-exposed apps, use bcrypt/argon2.
 */
function hashPassword(password) {
    return node_crypto_1.default.createHash("sha256").update(password).digest("hex");
}
/**
 * Seed initial data if the database is empty.
 * Called during app startup after migrations.
 */
function seedDatabase() {
    const db = (0, connection_1.getDb)();
    // Only seed if users table is empty (first run)
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    if (userCount > 0) {
        return;
    }
    const seedAll = db.transaction(() => {
        // ---- Default Users ----
        const insertUser = db.prepare(`
      INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now','localtime'))
    `);
        insertUser.run("seed-admin", "مدير النظام", "admin@store.com", hashPassword("admin123"), "admin");
        insertUser.run("seed-pos", "موظف نقطة بيع", "pos@store.com", hashPassword("pos12345"), "pos");
        // ---- Default Settings ----
        const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    `);
        const defaultSettings = {
            storeName: "متجر التبغ",
            storeAddress: "شارع الملك فهد، الرياض",
            storePhone: "+966 50 123 4567",
            taxRate: "5",
            currency: "LE",
            currencySymbol: "ج.م",
            themeMode: "dark",
            receiptFooter: "نشكركم على تسوقكم معنا",
            defaultPaymentMethod: "cash",
            allowNegativeStock: "false",
            requireCustomer: "false",
            printReceiptAutomatically: "false",
            receiptPrinterName: "",
        };
        for (const [key, value] of Object.entries(defaultSettings)) {
            insertSetting.run(key, value);
        }
    });
    seedAll();
}
