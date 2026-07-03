/**
 * test-all.mjs
 * Comprehensive test suite for the Tobacco POS database.
 * Run: node scripts/test-all.mjs
 */
import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.join(process.cwd(), "tobacco_pos.db");
const db = new Database(dbPath, { readonly: true });

let passed = 0;
let failed = 0;

function assert(label, condition, extra = "") {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${extra ? "  →  " + extra : ""}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 55 - title.length))}`);
}

const q = (sql, ...params) => db.prepare(sql).get(...params);
const qa = (sql, ...params) => db.prepare(sql).all(...params);

// ════════════════════════════════════════════════════════
//  1. ROW COUNTS
// ════════════════════════════════════════════════════════
section("1. Row counts");

const counts = q(`
  SELECT
    (SELECT COUNT(*) FROM categories)          AS cats,
    (SELECT COUNT(*) FROM products)            AS prods,
    (SELECT COUNT(*) FROM customers)           AS custs,
    (SELECT COUNT(*) FROM suppliers)           AS sups,
    (SELECT COUNT(*) FROM sales)               AS sales,
    (SELECT COUNT(*) FROM sale_items)          AS items,
    (SELECT COUNT(*) FROM returns)             AS rets,
    (SELECT COUNT(*) FROM treasury_ops)        AS treasury,
    (SELECT COUNT(*) FROM supplier_operations) AS sup_ops,
    (SELECT COUNT(*) FROM users)               AS users,
    (SELECT COUNT(*) FROM settings)            AS settings
`);

assert("categories ≥ 15", counts.cats >= 15, `got ${counts.cats}`);
assert("products ≥ 100", counts.prods >= 100, `got ${counts.prods}`);
assert("customers ≥ 50", counts.custs >= 50, `got ${counts.custs}`);
assert("suppliers ≥ 15", counts.sups >= 15, `got ${counts.sups}`);
assert("sales ≥ 600", counts.sales >= 600, `got ${counts.sales}`);
assert("sale_items ≥ 600", counts.items >= 600, `got ${counts.items}`);
assert("returns ≥ 150", counts.rets >= 150, `got ${counts.rets}`);
assert("treasury_ops ≥ 60", counts.treasury >= 60, `got ${counts.treasury}`);
assert("supplier_ops ≥ 40", counts.sup_ops >= 40, `got ${counts.sup_ops}`);
assert("users ≥ 2", counts.users >= 2, `got ${counts.users}`);
assert("settings rows ≥ 5", counts.settings >= 5, `got ${counts.settings}`);

// ════════════════════════════════════════════════════════
//  2. CATEGORIES
// ════════════════════════════════════════════════════════
section("2. Categories");

const emptyNameCats = q(
  "SELECT COUNT(*) AS c FROM categories WHERE TRIM(name) = ''",
);
assert(
  "no blank-name categories",
  emptyNameCats.c === 0,
  `${emptyNameCats.c} found`,
);

const dupCats = q(
  "SELECT COUNT(*) AS c FROM (SELECT name FROM categories GROUP BY name HAVING COUNT(*) > 1)",
);
assert(
  "no duplicate category names",
  dupCats.c === 0,
  `${dupCats.c} duplicate(s)`,
);

// ════════════════════════════════════════════════════════
//  3. PRODUCTS
// ════════════════════════════════════════════════════════
section("3. Products");

const activeProd = q("SELECT COUNT(*) AS c FROM products WHERE is_active = 1");
assert("has active products", activeProd.c > 0, `got ${activeProd.c}`);

const negPriceProd = q("SELECT COUNT(*) AS c FROM products WHERE price <= 0");
assert(
  "no zero/negative price",
  negPriceProd.c === 0,
  `${negPriceProd.c} product(s)`,
);

const negCostProd = q("SELECT COUNT(*) AS c FROM products WHERE cost < 0");
assert("no negative cost", negCostProd.c === 0, `${negCostProd.c} product(s)`);

const negStockProd = q("SELECT COUNT(*) AS c FROM products WHERE stock < 0");
assert(
  "no negative stock",
  negStockProd.c === 0,
  `${negStockProd.c} product(s)`,
);

const orphanProd = q(`
  SELECT COUNT(*) AS c FROM products
  WHERE category_id <> '' AND category_id NOT IN (SELECT id FROM categories)
`);
assert(
  "no orphaned products (bad category_id)",
  orphanProd.c === 0,
  `${orphanProd.c} orphan(s)`,
);

const dupBarcode = q(`
  SELECT COUNT(*) AS c FROM (
    SELECT barcode FROM products
    WHERE barcode <> ''
    GROUP BY barcode HAVING COUNT(*) > 1
  )
`);
assert(
  "no duplicate barcodes",
  dupBarcode.c === 0,
  `${dupBarcode.c} duplicate(s)`,
);

const dupCode = q(`
  SELECT COUNT(*) AS c FROM (
    SELECT product_code FROM products
    WHERE product_code <> ''
    GROUP BY product_code HAVING COUNT(*) > 1
  )
`);
assert(
  "no duplicate product_codes",
  dupCode.c === 0,
  `${dupCode.c} duplicate(s)`,
);

// ════════════════════════════════════════════════════════
//  4. CUSTOMERS
// ════════════════════════════════════════════════════════
section("4. Customers");

const emptyNameCust = q(
  "SELECT COUNT(*) AS c FROM customers WHERE TRIM(name) = ''",
);
assert("no blank-name customers", emptyNameCust.c === 0);

const negDebtCust = q("SELECT COUNT(*) AS c FROM customers WHERE debt < 0");
assert(
  "no negative customer debt",
  negDebtCust.c === 0,
  `${negDebtCust.c} found`,
);

const negSpentCust = q(
  "SELECT COUNT(*) AS c FROM customers WHERE total_spent < 0",
);
assert("no negative total_spent", negSpentCust.c === 0);

// ════════════════════════════════════════════════════════
//  5. SALES
// ════════════════════════════════════════════════════════
section("5. Sales");

const salesStatusCounts = q(`
  SELECT
    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS comp,
    SUM(CASE WHEN status='voided'    THEN 1 ELSE 0 END) AS void,
    SUM(CASE WHEN status='refunded'  THEN 1 ELSE 0 END) AS refund
  FROM sales
`);
assert(
  "sales have completed records",
  salesStatusCounts.comp > 0,
  `got ${salesStatusCounts.comp}`,
);
assert("sales have voided records", salesStatusCounts.void > 0);
assert("sales have refunded records", salesStatusCounts.refund > 0);

const dupReceipt = q(`
  SELECT COUNT(*) AS c FROM (
    SELECT receipt_number FROM sales GROUP BY receipt_number HAVING COUNT(*) > 1
  )
`);
assert(
  "no duplicate receipt_numbers",
  dupReceipt.c === 0,
  `${dupReceipt.c} dup(s)`,
);

const negTotalSale = q("SELECT COUNT(*) AS c FROM sales WHERE total < 0");
assert("no negative sale totals", negTotalSale.c === 0);

const badPayMethod = q(`
  SELECT COUNT(*) AS c FROM sales
  WHERE payment_method NOT IN ('cash','card','wallet')
`);
assert(
  "all payment methods valid",
  badPayMethod.c === 0,
  `${badPayMethod.c} bad row(s)`,
);

const salesWithItems = q(`
  SELECT COUNT(DISTINCT sale_id) AS c FROM sale_items
`);
assert("every sale_item links to a sale", salesWithItems.c > 0);

// Sales that have NO items
const salesNoItems = q(`
  SELECT COUNT(*) AS c FROM sales
  WHERE id NOT IN (SELECT DISTINCT sale_id FROM sale_items)
  AND status = 'completed'
`);
assert(
  "no completed sales without items",
  salesNoItems.c === 0,
  `${salesNoItems.c} found`,
);

const badSubtotal = q(`
  SELECT COUNT(*) AS c FROM sales s
  WHERE ABS(s.subtotal - (
    SELECT COALESCE(SUM(si.subtotal),0) FROM sale_items si WHERE si.sale_id = s.id
  )) > 0.05
`);
assert(
  "sale subtotals match sum of items (±0.05)",
  badSubtotal.c === 0,
  `${badSubtotal.c} mismatch(es)`,
);

// ════════════════════════════════════════════════════════
//  6. SALE ITEMS
// ════════════════════════════════════════════════════════
section("6. Sale items");

const badQtyItem = q(
  "SELECT COUNT(*) AS c FROM sale_items WHERE quantity <= 0",
);
assert("all item quantities > 0", badQtyItem.c === 0);

const negSubItem = q("SELECT COUNT(*) AS c FROM sale_items WHERE subtotal < 0");
assert("no negative item subtotals", negSubItem.c === 0);

const orphanItem = q(`
  SELECT COUNT(*) AS c FROM sale_items
  WHERE sale_id NOT IN (SELECT id FROM sales)
`);
assert("no orphaned sale_items", orphanItem.c === 0);

const itemSubtotalCheck = q(`
  SELECT COUNT(*) AS c FROM sale_items
  WHERE ABS(subtotal - (price * quantity)) > 0.1
`);
assert(
  "item subtotal = price × qty (±0.10)",
  itemSubtotalCheck.c === 0,
  `${itemSubtotalCheck.c} mismatch(es)`,
);

// ════════════════════════════════════════════════════════
//  7. RETURNS
// ════════════════════════════════════════════════════════
section("7. Returns");

const retStatusCounts = q(`
  SELECT
    SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS appr,
    SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) AS pend,
    SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS rej
  FROM returns
`);
assert("returns have approved records", retStatusCounts.appr > 0);
assert("returns have pending records", retStatusCounts.pend > 0);
assert("returns have rejected records", retStatusCounts.rej > 0);

const dupReturnNum = q(`
  SELECT COUNT(*) AS c FROM (
    SELECT return_number FROM returns GROUP BY return_number HAVING COUNT(*) > 1
  )
`);
assert("no duplicate return_numbers", dupReturnNum.c === 0);

const negRefund = q(
  "SELECT COUNT(*) AS c FROM returns WHERE refund_amount < 0",
);
assert("no negative refund amounts", negRefund.c === 0);

const zeroQtyReturn = q(
  "SELECT COUNT(*) AS c FROM returns WHERE quantity <= 0",
);
assert("all return quantities > 0", zeroQtyReturn.c === 0);

// ════════════════════════════════════════════════════════
//  8. TREASURY OPS
// ════════════════════════════════════════════════════════
section("8. Treasury operations");

const treasuryTypes = q(`
  SELECT
    SUM(CASE WHEN type='expense'  THEN 1 ELSE 0 END) AS exp,
    SUM(CASE WHEN type='withdraw' THEN 1 ELSE 0 END) AS wd
  FROM treasury_ops
`);
assert("treasury has expense records", treasuryTypes.exp > 0);
assert("treasury has withdraw records", treasuryTypes.wd > 0);

const negTreasury = q(
  "SELECT COUNT(*) AS c FROM treasury_ops WHERE amount <= 0",
);
assert(
  "all treasury amounts > 0",
  negTreasury.c === 0,
  `${negTreasury.c} bad row(s)`,
);

const badTreasuryType = q(`
  SELECT COUNT(*) AS c FROM treasury_ops
  WHERE type NOT IN ('expense','withdraw')
`);
assert("all treasury types valid", badTreasuryType.c === 0);

// ════════════════════════════════════════════════════════
//  9. SUPPLIERS
// ════════════════════════════════════════════════════════
section("9. Suppliers");

const emptyNameSup = q(
  "SELECT COUNT(*) AS c FROM suppliers WHERE TRIM(name) = ''",
);
assert("no blank-name suppliers", emptyNameSup.c === 0);

const dupSupCode = q(`
  SELECT COUNT(*) AS c FROM (
    SELECT supplier_code FROM suppliers GROUP BY supplier_code HAVING COUNT(*) > 1
  )
`);
assert("no duplicate supplier_codes", dupSupCode.c === 0);

const negDebtSup = q("SELECT COUNT(*) AS c FROM suppliers WHERE debt < 0");
assert(
  "no negative supplier debt",
  negDebtSup.c === 0,
  `${negDebtSup.c} found`,
);

// ════════════════════════════════════════════════════════
//  10. SUPPLIER OPERATIONS
// ════════════════════════════════════════════════════════
section("10. Supplier operations");

const supOpTypes = q(`
  SELECT
    SUM(CASE WHEN type='purchase'    THEN 1 ELSE 0 END) AS pur,
    SUM(CASE WHEN type='settlement'  THEN 1 ELSE 0 END) AS setl
  FROM supplier_operations
`);
assert("supplier_ops has purchase records", supOpTypes.pur > 0);
assert("supplier_ops has settlement records", supOpTypes.setl > 0);

const orphanSupOp = q(`
  SELECT COUNT(*) AS c FROM supplier_operations
  WHERE supplier_id NOT IN (SELECT id FROM suppliers)
`);
assert("no orphaned supplier_operations", orphanSupOp.c === 0);

const negSupOp = q(
  "SELECT COUNT(*) AS c FROM supplier_operations WHERE purchase_amount < 0 OR paid_amount < 0",
);
assert("no negative amounts in supplier_ops", negSupOp.c === 0);

// ════════════════════════════════════════════════════════
//  11. REFERENTIAL INTEGRITY
// ════════════════════════════════════════════════════════
section("11. Referential integrity");

const custSaleLink = q(`
  SELECT COUNT(*) AS c FROM sales
  WHERE customer_id IS NOT NULL
  AND customer_id NOT IN (SELECT id FROM customers)
`);
assert(
  "all sales.customer_id exist in customers",
  custSaleLink.c === 0,
  `${custSaleLink.c} broken`,
);

const cashierExists = q(`
  SELECT COUNT(*) AS c FROM sales
  WHERE cashier_id <> '' AND cashier_id NOT IN (SELECT id FROM users)
`);
assert(
  "all sales.cashier_id exist in users",
  cashierExists.c === 0,
  `${cashierExists.c} broken`,
);

// ════════════════════════════════════════════════════════
//  12. USERS + SETTINGS
// ════════════════════════════════════════════════════════
section("12. Users & settings");

const adminExists = q(
  "SELECT COUNT(*) AS c FROM users WHERE role='admin' AND is_active=1",
);
assert("at least one active admin user", adminExists.c >= 1);

const validRoles = q(`
  SELECT COUNT(*) AS c FROM users
  WHERE role NOT IN ('admin','manager','cashier','pos')
`);
assert("all user roles valid", validRoles.c === 0);

const storeNameSetting = q("SELECT value FROM settings WHERE key='storeName'");
assert("storeName setting exists", !!storeNameSetting);

const taxSetting = q("SELECT value FROM settings WHERE key='taxRate'");
assert("taxRate setting exists", !!taxSetting);

// ════════════════════════════════════════════════════════
//  13. BUSINESS LOGIC SPOT-CHECKS
// ════════════════════════════════════════════════════════
section("13. Business logic spot-checks");

// Average items per sale
const avgItems = q(
  "SELECT CAST(COUNT(*) AS REAL) / (SELECT COUNT(*) FROM sales) AS avg FROM sale_items",
);
assert(
  "average items/sale ≥ 1.5",
  avgItems.avg >= 1.5,
  `got ${avgItems.avg.toFixed(2)}`,
);

// Revenue sanity (completed sales > 0)
const totalRevenue = q(
  "SELECT COALESCE(SUM(total),0) AS t FROM sales WHERE status='completed'",
);
assert(
  "total completed revenue > 0",
  totalRevenue.t > 0,
  `got ${totalRevenue.t}`,
);

// Expenses sanity
const totalExpenses = q(
  "SELECT COALESCE(SUM(amount),0) AS t FROM treasury_ops WHERE type='expense'",
);
assert("total expenses > 0", totalExpenses.t > 0);

// Returns refund total > 0
const totalRefund = q(
  "SELECT COALESCE(SUM(refund_amount),0) AS t FROM returns WHERE status='approved'",
);
assert("total refunds > 0", totalRefund.t > 0);

// Sales spread over > 30 distinct days
const distinctDays = q(
  "SELECT COUNT(DISTINCT DATE(created_at)) AS d FROM sales",
);
assert(
  "sales spread across ≥ 30 days",
  distinctDays.d >= 30,
  `got ${distinctDays.d} days`,
);

// Top-selling product has been sold
const topProd = q(`
  SELECT product_name, SUM(quantity) AS qty
  FROM sale_items GROUP BY product_id ORDER BY qty DESC LIMIT 1
`);
assert(
  "top product has qty > 0",
  topProd && topProd.qty > 0,
  topProd ? `${topProd.product_name} × ${topProd.qty}` : "none",
);

// ════════════════════════════════════════════════════════
//  SUMMARY
// ════════════════════════════════════════════════════════
const total = passed + failed;
console.log(`\n${"═".repeat(58)}`);
console.log(
  `  RESULTS: ${passed}/${total} passed   ${failed > 0 ? failed + " FAILED" : "ALL PASSED ✓"}`,
);
console.log(`${"═".repeat(58)}\n`);

db.close();
process.exit(failed > 0 ? 1 : 0);
