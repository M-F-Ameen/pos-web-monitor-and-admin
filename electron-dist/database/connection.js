"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.initDatabase = initDatabase;
exports.getDb = getDb;
exports.closeDatabase = closeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
// ============================================
// Database Connection
// ============================================
let db = null;
/**
 * Get the database file path.
 * In production: stored in the app's userData folder.
 * In development: stored in the project root.
 */
function getDbPath() {
    const isDev = !electron_1.app.isPackaged;
    if (isDev) {
        return node_path_1.default.join(electron_1.app.getAppPath(), "tobacco_pos.db");
    }
    return node_path_1.default.join(electron_1.app.getPath("userData"), "tobacco_pos.db");
}
/**
 * Absolute path to the SQLite database file.
 */
function getDatabasePath() {
    return getDbPath();
}
/**
 * Initialize the database connection and run migrations.
 * Call once during app startup.
 */
function initDatabase() {
    if (db)
        return db;
    db = new better_sqlite3_1.default(getDbPath());
    // Durability & performance pragmas
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = FULL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    db.pragma("wal_autocheckpoint = 1000");
    db.pragma("journal_size_limit = 67108864"); // 64MB WAL cap target
    db.pragma("cache_size = -64000"); // 64MB cache
    runMigrations(db);
    return db;
}
/**
 * Get the active database instance.
 * Throws if not initialized.
 */
function getDb() {
    if (!db) {
        throw new Error("[DB] Database not initialized. Call initDatabase() first.");
    }
    return db;
}
/**
 * Close the database connection gracefully.
 * Call during app shutdown.
 */
function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
// ============================================
// Migrations
// ============================================
const MIGRATIONS = [
    {
        version: 1,
        description: "Initial schema — all core tables",
        sql: `
      -- ==========================================
      -- Users
      -- ==========================================
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        full_name     TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'pos' CHECK(role IN ('admin','manager','cashier','pos')),
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ==========================================
      -- Categories
      -- ==========================================
      CREATE TABLE IF NOT EXISTS categories (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ==========================================
      -- Products
      -- ==========================================
      CREATE TABLE IF NOT EXISTS products (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        size          TEXT NOT NULL DEFAULT '',
        brand         TEXT NOT NULL DEFAULT '',
        price         REAL NOT NULL DEFAULT 0,
        cost          REAL NOT NULL DEFAULT 0,
        original_price REAL NOT NULL DEFAULT 0,
        barcode       TEXT NOT NULL DEFAULT '',
        category_id   TEXT NOT NULL DEFAULT '',
        stock         INTEGER NOT NULL DEFAULT 0,
        min_stock     INTEGER NOT NULL DEFAULT 0,
        is_active     INTEGER NOT NULL DEFAULT 1,
        image         TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET DEFAULT
      );

      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

      -- ==========================================
      -- Customers
      -- ==========================================
      CREATE TABLE IF NOT EXISTS customers (
        id              TEXT PRIMARY KEY,
        customer_id     TEXT NOT NULL DEFAULT '',
        name            TEXT NOT NULL,
        phone           TEXT NOT NULL DEFAULT '',
        email           TEXT NOT NULL DEFAULT '',
        address         TEXT NOT NULL DEFAULT '',
        notes           TEXT NOT NULL DEFAULT '',
        debt            REAL NOT NULL DEFAULT 0,
        total_purchases INTEGER NOT NULL DEFAULT 0,
        total_spent     REAL NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ==========================================
      -- Sales
      -- ==========================================
      CREATE TABLE IF NOT EXISTS sales (
        id               TEXT PRIMARY KEY,
        receipt_number   TEXT NOT NULL UNIQUE,
        customer_id      TEXT,
        customer_name    TEXT NOT NULL DEFAULT '',
        subtotal         REAL NOT NULL DEFAULT 0,
        discount_amount  REAL NOT NULL DEFAULT 0,
        discount_type    TEXT NOT NULL DEFAULT '',
        discount_value   REAL NOT NULL DEFAULT 0,
        tax_rate         REAL NOT NULL DEFAULT 0,
        tax_amount       REAL NOT NULL DEFAULT 0,
        total            REAL NOT NULL DEFAULT 0,
        payment_method   TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','card','wallet')),
        amount_received  REAL NOT NULL DEFAULT 0,
        change_given     REAL NOT NULL DEFAULT 0,
        reference        TEXT NOT NULL DEFAULT '',
        cashier_id       TEXT NOT NULL DEFAULT '',
        cashier_name     TEXT NOT NULL DEFAULT '',
        note             TEXT NOT NULL DEFAULT '',
        status           TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','voided','refunded')),
        created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_sales_receipt ON sales(receipt_number);

      -- ==========================================
      -- Sale Items
      -- ==========================================
      CREATE TABLE IF NOT EXISTS sale_items (
        id            TEXT PRIMARY KEY,
        sale_id       TEXT NOT NULL,
        product_id    TEXT NOT NULL DEFAULT '',
        product_name  TEXT NOT NULL,
        price         REAL NOT NULL DEFAULT 0,
        quantity      INTEGER NOT NULL DEFAULT 1,
        discount      REAL NOT NULL DEFAULT 0,
        discount_type TEXT NOT NULL DEFAULT 'percentage',
        subtotal      REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

      -- ==========================================
      -- Returns
      -- ==========================================
      CREATE TABLE IF NOT EXISTS returns (
        id            TEXT PRIMARY KEY,
        return_number TEXT NOT NULL UNIQUE,
        sale_id       TEXT,
        product_id    TEXT NOT NULL DEFAULT '',
        product_name  TEXT NOT NULL,
        quantity      INTEGER NOT NULL DEFAULT 1,
        refund_amount REAL NOT NULL DEFAULT 0,
        reason        TEXT NOT NULL DEFAULT '',
        status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        processed_by  TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(created_at);

      -- ==========================================
      -- Treasury Manual Operations
      -- ==========================================
      CREATE TABLE IF NOT EXISTS treasury_ops (
        id         TEXT PRIMARY KEY,
        type       TEXT NOT NULL CHECK(type IN ('withdraw','expense')),
        name       TEXT NOT NULL,
        amount     REAL NOT NULL DEFAULT 0,
        user       TEXT NOT NULL DEFAULT '',
        date       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      -- ==========================================
      -- Settings (key-value store)
      -- ==========================================
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- ==========================================
      -- Schema version tracker
      -- ==========================================
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `,
    },
    {
        version: 2,
        description: "Add image column to categories table",
        sql: `
      ALTER TABLE categories ADD COLUMN image TEXT DEFAULT '';
    `,
    },
    {
        version: 3,
        description: "Ensure image column exists and fix data",
        sql: `
      -- Update any NULL values to empty string
      UPDATE categories SET image = '' WHERE image IS NULL;
    `,
    },
    {
        version: 4,
        description: "Track user identity on returns/treasury operations",
        sql: `
      ALTER TABLE returns ADD COLUMN processed_by_id TEXT NOT NULL DEFAULT '';
      ALTER TABLE treasury_ops ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

      UPDATE returns
      SET processed_by_id = COALESCE(
        (
          SELECT users.id
          FROM users
          WHERE users.full_name = returns.processed_by
          LIMIT 1
        ),
        ''
      )
      WHERE processed_by_id = '' AND processed_by <> '';

      UPDATE treasury_ops
      SET user_id = COALESCE(
        (
          SELECT users.id
          FROM users
          WHERE users.full_name = treasury_ops.user
          LIMIT 1
        ),
        ''
      )
      WHERE user_id = '' AND user <> '';
    `,
    },
    {
        version: 5,
        description: "Add user shift sessions for login/logout accounting",
        sql: `
      CREATE TABLE IF NOT EXISTS user_shifts (
        id                TEXT PRIMARY KEY,
        user_id           TEXT NOT NULL,
        user_name         TEXT NOT NULL,
        user_role         TEXT NOT NULL,
        login_at          TEXT NOT NULL,
        logout_at         TEXT,
        start_cash        REAL NOT NULL DEFAULT 0,
        end_cash          REAL,
        total_sales       REAL NOT NULL DEFAULT 0,
        total_returns     REAL NOT NULL DEFAULT 0,
        total_expenses    REAL NOT NULL DEFAULT 0,
        total_withdrawals REAL NOT NULL DEFAULT 0,
        operations_count  INTEGER NOT NULL DEFAULT 0,
        created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_shifts_user_login
        ON user_shifts(user_id, login_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_shifts_open
        ON user_shifts(user_id, logout_at);
    `,
    },
    {
        version: 6,
        description: "Add internal 5-digit product codes (separate from barcode)",
        sql: `
      ALTER TABLE products ADD COLUMN product_code TEXT NOT NULL DEFAULT '';

      WITH ordered_products AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS seq
        FROM products
      )
      UPDATE products
      SET product_code = (
        SELECT substr(printf('%05d', ordered_products.seq), -5, 5)
        FROM ordered_products
        WHERE ordered_products.id = products.id
      )
      WHERE IFNULL(product_code, '') = '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_product_code
        ON products(product_code);
    `,
    },
    {
        version: 7,
        description: "Add per-user page permissions",
        sql: `
      ALTER TABLE users ADD COLUMN page_permissions TEXT NOT NULL DEFAULT '';

      UPDATE users
      SET page_permissions = ''
      WHERE page_permissions IS NULL;
    `,
    },
    {
        version: 8,
        description: "Add high-volume composite indexes for sales/returns reporting",
        sql: `
      CREATE INDEX IF NOT EXISTS idx_returns_sale_status
        ON returns(sale_id, status);

      CREATE INDEX IF NOT EXISTS idx_sales_cashier_date_status
        ON sales(cashier_id, created_at DESC, status);

      CREATE INDEX IF NOT EXISTS idx_returns_processed_date_status
        ON returns(processed_by_id, created_at DESC, status);

      CREATE INDEX IF NOT EXISTS idx_sales_status_date
        ON sales(status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_returns_status_date
        ON returns(status, created_at DESC);
    `,
    },
    {
        version: 9,
        description: "Add suppliers table",
        sql: `
      CREATE TABLE IF NOT EXISTS suppliers (
        id              TEXT PRIMARY KEY,
        supplier_code   TEXT NOT NULL UNIQUE,
        name            TEXT NOT NULL,
        phone           TEXT NOT NULL DEFAULT '',
        email           TEXT NOT NULL DEFAULT '',
        address         TEXT NOT NULL DEFAULT '',
        notes           TEXT NOT NULL DEFAULT '',
        debt            REAL NOT NULL DEFAULT 0,
        total_purchases INTEGER NOT NULL DEFAULT 0,
        total_paid      REAL NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
      CREATE INDEX IF NOT EXISTS idx_suppliers_phone ON suppliers(phone);
      CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers(created_at DESC);
    `,
    },
    {
        version: 10,
        description: "Add supplier operations ledger",
        sql: `
      CREATE TABLE IF NOT EXISTS supplier_operations (
        id              TEXT PRIMARY KEY,
        supplier_id     TEXT NOT NULL,
        type            TEXT NOT NULL CHECK(type IN ('purchase','settlement')),
        purchase_amount REAL NOT NULL DEFAULT 0,
        paid_amount     REAL NOT NULL DEFAULT 0,
        debt_before     REAL NOT NULL DEFAULT 0,
        debt_after      REAL NOT NULL DEFAULT 0,
        note            TEXT NOT NULL DEFAULT '',
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_supplier_operations_supplier_date
        ON supplier_operations(supplier_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_operations_type_date
        ON supplier_operations(type, created_at DESC);
    `,
    },
    {
        version: 11,
        description: "Add operational indexes for heavy load and retention cleanup",
        sql: `
      -- Customer aggregates and debt recomputation paths
      CREATE INDEX IF NOT EXISTS idx_sales_customer_status_date
        ON sales(customer_id, status, created_at DESC);

      -- Treasury hot paths (reports, shift metrics, retention deletes)
      CREATE INDEX IF NOT EXISTS idx_treasury_created_at
        ON treasury_ops(created_at);
      CREATE INDEX IF NOT EXISTS idx_treasury_user_created_at
        ON treasury_ops(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_treasury_type_created_at
        ON treasury_ops(type, created_at DESC);

      -- Retention cleanup paths
      CREATE INDEX IF NOT EXISTS idx_supplier_operations_created_at
        ON supplier_operations(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_shifts_logout_at
        ON user_shifts(logout_at);
    `,
    },
    {
        version: 12,
        description: "Persist sale price-increase amount separately",
        sql: `
      ALTER TABLE sales ADD COLUMN increase_amount REAL NOT NULL DEFAULT 0;
    `,
    },
    {
        version: 13,
        description: "Repair legacy discounted sale-item subtotals",
        sql: `
      UPDATE sale_items
      SET subtotal = ROUND(price * quantity, 2)
      WHERE discount > 0
        AND ABS((price * quantity) - (subtotal + discount)) <= 0.11;
    `,
    },
];
function runMigrations(database) {
    // Ensure schema_version table exists
    database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);
    const currentVersion = database.prepare("SELECT MAX(version) as v FROM schema_version").get()?.v ?? 0;
    const pendingMigrations = MIGRATIONS.filter((m) => m.version > currentVersion);
    if (pendingMigrations.length === 0) {
        return;
    }
    for (const migration of pendingMigrations) {
        const runMigration = database.transaction(() => {
            database.exec(migration.sql);
            database
                .prepare("INSERT INTO schema_version (version) VALUES (?)")
                .run(migration.version);
        });
        runMigration();
    }
}
