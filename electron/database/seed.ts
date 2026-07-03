import crypto from "node:crypto";
import { getDb } from "./connection";

// ============================================
// Seed Data
// ============================================

/**
 * Hash a password using SHA-256.
 * For a local desktop POS, this is adequate.
 * For network-exposed apps, use bcrypt/argon2.
 */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/**
 * Seed initial data if the database is empty.
 * Called during app startup after migrations.
 */
export function seedDatabase(): void {
  const db = getDb();

  // Only seed if users table is empty (first run)
  const userCount = (
    db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }
  ).count;

  if (userCount > 0) {
    return;
  }

  const seedAll = db.transaction(() => {
    // ---- Default Users ----
    const insertUser = db.prepare(`
      INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, datetime('now','localtime'))
    `);

    insertUser.run(
      "seed-admin",
      "مدير النظام",
      "admin@store.com",
      hashPassword("admin123"),
      "admin",
    );

    insertUser.run(
      "seed-pos",
      "موظف نقطة بيع",
      "pos@store.com",
      hashPassword("pos12345"),
      "pos",
    );

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
