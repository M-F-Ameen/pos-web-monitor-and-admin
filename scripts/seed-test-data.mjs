/**
 * seed-test-data.mjs
 *
 * Inserts a large volume of realistic test data into tobacco_pos.db:
 *   - 15 categories
 *   - 100 products
 *   - 50 customers
 *   - 15 suppliers
 *   - 600 sales  (with 1-4 items each)
 *   - 150 returns
 *   - 80  treasury operations (expenses + withdrawals)
 *   - 50  supplier operations (purchases + settlements)
 *
 * Run via:  npm run seed:test
 *       or: electron scripts/seed-test-data.mjs
 *
 * Guard: skips silently when the DB already has > 100 sales.
 */

import crypto from "node:crypto";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = path.join(process.cwd(), "tobacco_pos.db");
console.log("[SEED] Opening:", dbPath);
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

// ─── guard ────────────────────────────────────────────────────────────────────
const existingSales = db.prepare("SELECT COUNT(*) as c FROM sales").get().c;
if (existingSales > 100) {
  console.log(`[SEED] DB already has ${existingSales} sales — skipping.`);
  console.log("[SEED] Delete the DB and restart the app to re-seed.");
  db.close();
  process.exit(0);
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID();

function rInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rFrom(arr) {
  return arr[rInt(0, arr.length - 1)];
}
function rBool(prob = 0.5) {
  return Math.random() < prob;
}

/** Return a datetime string N..M days ago from 2026-03-05 */
function rDate(minDaysAgo = 0, maxDaysAgo = 180) {
  const base = new Date("2026-03-05T12:00:00");
  const d = new Date(
    base.getTime() - rInt(minDaysAgo, maxDaysAgo) * 86_400_000,
  );
  d.setHours(rInt(8, 22), rInt(0, 59), rInt(0, 59));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// Dynamic receipt / return counters (avoid clashing with existing rows)
const maxReceiptRow = db
  .prepare(
    "SELECT MAX(CAST(SUBSTR(receipt_number,5) AS INTEGER)) as m FROM sales WHERE receipt_number LIKE 'REC-%'",
  )
  .get();
let receiptSeq = Math.max((maxReceiptRow?.m ?? 0) + 1, 10001);

const maxReturnRow = db
  .prepare(
    "SELECT MAX(CAST(SUBSTR(return_number,5) AS INTEGER)) as m FROM returns WHERE return_number LIKE 'RTN-%'",
  )
  .get();
let returnSeq = Math.max((maxReturnRow?.m ?? 0) + 1, 5001);

const nextReceipt = () => `REC-${String(receiptSeq++).padStart(6, "0")}`;
const nextReturn = () => `RTN-${String(returnSeq++).padStart(5, "0")}`;

const fmt2 = (n) => parseFloat(n.toFixed(2));

// ─── static data ──────────────────────────────────────────────────────────────

const CASHIER_ADMIN = { id: "seed-admin", name: "مدير النظام" };
const CASHIER_POS = { id: "seed-pos", name: "موظف نقطة بيع" };
const cashierPool = [
  CASHIER_ADMIN,
  CASHIER_ADMIN,
  CASHIER_ADMIN,
  CASHIER_ADMIN,
  CASHIER_POS,
];

const categories = [
  { id: "td-cat-01", name: "سجائر مصرية" },
  { id: "td-cat-02", name: "سجائر أجنبية" },
  { id: "td-cat-03", name: "سيجار وغليون" },
  { id: "td-cat-04", name: "معسل وشيشة" },
  { id: "td-cat-05", name: "ولاعات وإكسسوارات" },
  { id: "td-cat-06", name: "مشروبات غازية" },
  { id: "td-cat-07", name: "مياه معدنية" },
  { id: "td-cat-08", name: "عصائر وطاقة" },
  { id: "td-cat-09", name: "شيبس ووجبات خفيفة" },
  { id: "td-cat-10", name: "حلوى وشيكولاتة" },
  { id: "td-cat-11", name: "علكة ونعناع" },
  { id: "td-cat-12", name: "قهوة وشاي" },
  { id: "td-cat-13", name: "بطاقات شحن" },
  { id: "td-cat-14", name: "إلكترونيات صغيرة" },
  { id: "td-cat-15", name: "متفرقات" },
];

// prettier-ignore
const products = [
  // ── Egyptian Cigarettes ────────────────────────────────────────────────────
  { id: "td-pr-001", name: "كليوباترا سوفت",        size: "20s",   brand: "Eastern Company", price: 25,  cost: 18,   cat: "td-cat-01", stock: 500, minStock: 50, barcode: "6221030000001" },
  { id: "td-pr-002", name: "كليوباترا بوكس",        size: "20s",   brand: "Eastern Company", price: 28,  cost: 20,   cat: "td-cat-01", stock: 450, minStock: 50, barcode: "6221030000002" },
  { id: "td-pr-003", name: "L&M أحمر",               size: "20s",   brand: "PMI",             price: 35,  cost: 26,   cat: "td-cat-01", stock: 300, minStock: 30, barcode: "6221030000003" },
  { id: "td-pr-004", name: "بنسون آند هيدجز",       size: "20s",   brand: "BAT",             price: 40,  cost: 30,   cat: "td-cat-01", stock: 250, minStock: 25, barcode: "6221030000004" },
  { id: "td-pr-005", name: "وينستون أحمر",           size: "20s",   brand: "JTI",             price: 38,  cost: 28,   cat: "td-cat-01", stock: 280, minStock: 30, barcode: "6221030000005" },
  { id: "td-pr-006", name: "كنت 1 أبيض",             size: "20s",   brand: "BAT",             price: 36,  cost: 27,   cat: "td-cat-01", stock: 260, minStock: 25, barcode: "6221030000006" },
  { id: "td-pr-007", name: "كنت 4 أزرق",             size: "20s",   brand: "BAT",             price: 36,  cost: 27,   cat: "td-cat-01", stock: 240, minStock: 25, barcode: "6221030000007" },
  { id: "td-pr-008", name: "بارليامنت مصري",         size: "20s",   brand: "PMI",             price: 55,  cost: 42,   cat: "td-cat-01", stock: 150, minStock: 20, barcode: "6221030000008" },
  { id: "td-pr-009", name: "كابستان أزرق",           size: "20s",   brand: "PMI",             price: 45,  cost: 34,   cat: "td-cat-01", stock: 200, minStock: 20, barcode: "6221030000009" },
  // ── Foreign Cigarettes ─────────────────────────────────────────────────────
  { id: "td-pr-010", name: "مارلبورو أحمر",          size: "20s",   brand: "PMI",             price: 75,  cost: 60,   cat: "td-cat-02", stock: 200, minStock: 20, barcode: "6221030000010" },
  { id: "td-pr-011", name: "مارلبورو ذهبي",          size: "20s",   brand: "PMI",             price: 75,  cost: 60,   cat: "td-cat-02", stock: 180, minStock: 20, barcode: "6221030000011" },
  { id: "td-pr-012", name: "مارلبورو آيس مينت",     size: "20s",   brand: "PMI",             price: 85,  cost: 68,   cat: "td-cat-02", stock: 120, minStock: 15, barcode: "6221030000012" },
  { id: "td-pr-013", name: "كاميل",                  size: "20s",   brand: "RJ Reynolds",    price: 70,  cost: 56,   cat: "td-cat-02", stock: 150, minStock: 15, barcode: "6221030000013" },
  { id: "td-pr-014", name: "دنهيل سوفت",             size: "20s",   brand: "BAT",             price: 80,  cost: 64,   cat: "td-cat-02", stock: 130, minStock: 15, barcode: "6221030000014" },
  { id: "td-pr-015", name: "روثمانز",                size: "20s",   brand: "BAT",             price: 65,  cost: 52,   cat: "td-cat-02", stock: 160, minStock: 15, barcode: "6221030000015" },
  { id: "td-pr-016", name: "L&M أزرق إمبورت",        size: "20s",   brand: "PMI",             price: 65,  cost: 52,   cat: "td-cat-02", stock: 140, minStock: 15, barcode: "6221030000016" },
  { id: "td-pr-017", name: "مارلبورو مينثول",        size: "20s",   brand: "PMI",             price: 85,  cost: 68,   cat: "td-cat-02", stock: 100, minStock: 10, barcode: "6221030000017" },
  { id: "td-pr-018", name: "دنهيل فاين كت",          size: "20s",   brand: "BAT",             price: 90,  cost: 72,   cat: "td-cat-02", stock:  80, minStock: 10, barcode: "6221030000018" },
  // ── Cigars & Pipes ─────────────────────────────────────────────────────────
  { id: "td-pr-019", name: "سيجار بيتيرو",           size: "1pc",   brand: "Petrus",          price: 120, cost: 90,   cat: "td-cat-03", stock:  50, minStock:  5, barcode: "6221030000019" },
  { id: "td-pr-020", name: "سيجار داود كلاسيك",      size: "1pc",   brand: "Davidoff",        price: 200, cost: 160,  cat: "td-cat-03", stock:  30, minStock:  3, barcode: "6221030000020" },
  { id: "td-pr-021", name: "سيجار كوهيبا",           size: "1pc",   brand: "Cohiba",          price: 180, cost: 140,  cat: "td-cat-03", stock:  25, minStock:  3, barcode: "6221030000021" },
  { id: "td-pr-022", name: "غليون خشب كلاسيك",       size: "1pc",   brand: "Generic",         price: 250, cost: 180,  cat: "td-cat-03", stock:  15, minStock:  2, barcode: "6221030000022" },
  { id: "td-pr-023", name: "تبغ غليون لاتاكيا",      size: "50g",   brand: "Generic",         price: 95,  cost: 70,   cat: "td-cat-03", stock:  40, minStock:  5, barcode: "6221030000023" },
  // ── Molasses / Shisha ──────────────────────────────────────────────────────
  { id: "td-pr-024", name: "نخلة بطيخ",              size: "250g",  brand: "Nakhla",          price: 85,  cost: 65,   cat: "td-cat-04", stock: 120, minStock: 15, barcode: "6221030000024" },
  { id: "td-pr-025", name: "نخلة توت",               size: "250g",  brand: "Nakhla",          price: 85,  cost: 65,   cat: "td-cat-04", stock: 110, minStock: 15, barcode: "6221030000025" },
  { id: "td-pr-026", name: "نخلة كوكتيل فواكه",      size: "250g",  brand: "Nakhla",          price: 85,  cost: 65,   cat: "td-cat-04", stock: 100, minStock: 12, barcode: "6221030000026" },
  { id: "td-pr-027", name: "أوراس ليمون نعناع",      size: "250g",  brand: "Oras",            price: 75,  cost: 57,   cat: "td-cat-04", stock:  80, minStock: 10, barcode: "6221030000027" },
  { id: "td-pr-028", name: "جوكر عنب مارجريتا",      size: "250g",  brand: "Joker",           price: 90,  cost: 68,   cat: "td-cat-04", stock:  75, minStock: 10, barcode: "6221030000028" },
  { id: "td-pr-029", name: "أسطورة خوخ مانجو",       size: "250g",  brand: "Astoura",         price: 80,  cost: 60,   cat: "td-cat-04", stock:  70, minStock:  8, barcode: "6221030000029" },
  { id: "td-pr-030", name: "مزاج فاخر عنب",          size: "250g",  brand: "Mazaj",           price: 110, cost: 82,   cat: "td-cat-04", stock:  60, minStock:  8, barcode: "6221030000030" },
  { id: "td-pr-031", name: "ستار باز كوكتيل",        size: "50g",   brand: "Star Buzz",       price: 65,  cost: 48,   cat: "td-cat-04", stock:  90, minStock: 10, barcode: "6221030000031" },
  // ── Lighters & Accessories ─────────────────────────────────────────────────
  { id: "td-pr-032", name: "ولاعة BIC صغيرة",        size: "1pc",   brand: "BIC",             price: 10,  cost:  6,   cat: "td-cat-05", stock: 300, minStock: 50, barcode: "6221030000032" },
  { id: "td-pr-033", name: "ولاعة BIC كبيرة",        size: "1pc",   brand: "BIC",             price: 18,  cost: 12,   cat: "td-cat-05", stock: 200, minStock: 30, barcode: "6221030000033" },
  { id: "td-pr-034", name: "ولاعة قداحة بسيطة",      size: "1pc",   brand: "Generic",         price: 35,  cost: 22,   cat: "td-cat-05", stock: 100, minStock: 15, barcode: "6221030000034" },
  { id: "td-pr-035", name: "ولاعة قداحة فاخرة",      size: "1pc",   brand: "Generic",         price: 85,  cost: 55,   cat: "td-cat-05", stock:  40, minStock:  5, barcode: "6221030000035" },
  { id: "td-pr-036", name: "فلتر شيشة",              size: "1pc",   brand: "Generic",         price: 15,  cost:  8,   cat: "td-cat-05", stock: 200, minStock: 30, barcode: "6221030000036" },
  { id: "td-pr-037", name: "حجر نار صوان",           size: "1pc",   brand: "Generic",         price: 10,  cost:  5,   cat: "td-cat-05", stock: 150, minStock: 20, barcode: "6221030000037" },
  { id: "td-pr-038", name: "مبسم شيشة",              size: "1pc",   brand: "Generic",         price: 45,  cost: 28,   cat: "td-cat-05", stock:  80, minStock: 10, barcode: "6221030000038" },
  // ── Carbonated Drinks ──────────────────────────────────────────────────────
  { id: "td-pr-039", name: "كوكاكولا 330ml",         size: "330ml", brand: "Coca-Cola",       price: 22,  cost: 14,   cat: "td-cat-06", stock: 240, minStock: 30, barcode: "6224000000001" },
  { id: "td-pr-040", name: "بيبسي 330ml",            size: "330ml", brand: "PepsiCo",         price: 20,  cost: 13,   cat: "td-cat-06", stock: 220, minStock: 30, barcode: "6224000000002" },
  { id: "td-pr-041", name: "سبرايت 330ml",           size: "330ml", brand: "Coca-Cola",       price: 20,  cost: 13,   cat: "td-cat-06", stock: 200, minStock: 25, barcode: "6224000000003" },
  { id: "td-pr-042", name: "فانتا برتقال 330ml",     size: "330ml", brand: "Coca-Cola",       price: 20,  cost: 13,   cat: "td-cat-06", stock: 180, minStock: 25, barcode: "6224000000004" },
  { id: "td-pr-043", name: "7UP 330ml",              size: "330ml", brand: "PepsiCo",         price: 20,  cost: 13,   cat: "td-cat-06", stock: 160, minStock: 20, barcode: "6224000000005" },
  { id: "td-pr-044", name: "ميرندا برتقال 330ml",    size: "330ml", brand: "PepsiCo",         price: 20,  cost: 13,   cat: "td-cat-06", stock: 150, minStock: 20, barcode: "6224000000006" },
  { id: "td-pr-045", name: "كوكاكولا زيرو 330ml",    size: "330ml", brand: "Coca-Cola",       price: 22,  cost: 14,   cat: "td-cat-06", stock: 120, minStock: 15, barcode: "6224000000007" },
  { id: "td-pr-046", name: "كوكاكولا 1L",            size: "1L",    brand: "Coca-Cola",       price: 38,  cost: 24,   cat: "td-cat-06", stock: 100, minStock: 15, barcode: "6224000000008" },
  // ── Mineral Water ──────────────────────────────────────────────────────────
  { id: "td-pr-047", name: "سافي 600ml",             size: "600ml", brand: "Safi",            price: 10,  cost:  6,   cat: "td-cat-07", stock: 300, minStock: 40, barcode: "6224100000001" },
  { id: "td-pr-048", name: "نستله 600ml",            size: "600ml", brand: "Nestlé",          price: 10,  cost:  6,   cat: "td-cat-07", stock: 280, minStock: 40, barcode: "6224100000002" },
  { id: "td-pr-049", name: "بيور لايف 1.5L",         size: "1.5L",  brand: "Nestlé",          price: 18,  cost: 11,   cat: "td-cat-07", stock: 200, minStock: 30, barcode: "6224100000003" },
  { id: "td-pr-050", name: "باراكا 600ml",           size: "600ml", brand: "Baraka",          price:  8,  cost:  5,   cat: "td-cat-07", stock: 250, minStock: 35, barcode: "6224100000004" },
  // ── Juices & Energy ────────────────────────────────────────────────────────
  { id: "td-pr-051", name: "ريد بول 250ml",          size: "250ml", brand: "Red Bull",        price: 55,  cost: 42,   cat: "td-cat-08", stock: 120, minStock: 15, barcode: "6224200000001" },
  { id: "td-pr-052", name: "مونستر أخضر 500ml",      size: "500ml", brand: "Monster",         price: 70,  cost: 55,   cat: "td-cat-08", stock:  80, minStock: 10, barcode: "6224200000002" },
  { id: "td-pr-053", name: "باور هورس 250ml",        size: "250ml", brand: "Power Horse",     price: 40,  cost: 30,   cat: "td-cat-08", stock: 100, minStock: 12, barcode: "6224200000003" },
  { id: "td-pr-054", name: "تروبيكانا مانجو 230ml",  size: "230ml", brand: "Tropicana",       price: 25,  cost: 16,   cat: "td-cat-08", stock:  90, minStock: 12, barcode: "6224200000004" },
  { id: "td-pr-055", name: "لانجو برتقال 330ml",     size: "330ml", brand: "Lango",           price: 20,  cost: 13,   cat: "td-cat-08", stock: 110, minStock: 15, barcode: "6224200000005" },
  // ── Chips & Snacks ─────────────────────────────────────────────────────────
  { id: "td-pr-056", name: "ليز أوريجنال 37g",       size: "37g",   brand: "Lay's",           price: 22,  cost: 14,   cat: "td-cat-09", stock: 200, minStock: 25, barcode: "6224300000001" },
  { id: "td-pr-057", name: "شيبسي كاتشب 25g",        size: "25g",   brand: "Chipsy",          price: 10,  cost:  6,   cat: "td-cat-09", stock: 250, minStock: 30, barcode: "6224300000002" },
  { id: "td-pr-058", name: "شيبسي جبن 25g",          size: "25g",   brand: "Chipsy",          price: 10,  cost:  6,   cat: "td-cat-09", stock: 220, minStock: 30, barcode: "6224300000003" },
  { id: "td-pr-059", name: "كيتو خيار وليمون 25g",   size: "25g",   brand: "Keto",            price: 12,  cost:  7,   cat: "td-cat-09", stock: 180, minStock: 20, barcode: "6224300000004" },
  { id: "td-pr-060", name: "برينجلز أوريجنال 40g",   size: "40g",   brand: "Pringles",        price: 35,  cost: 22,   cat: "td-cat-09", stock: 120, minStock: 15, barcode: "6224300000005" },
  { id: "td-pr-061", name: "ريتز أصلي 40g",          size: "40g",   brand: "Nabisco",         price: 22,  cost: 14,   cat: "td-cat-09", stock: 140, minStock: 15, barcode: "6224300000006" },
  { id: "td-pr-062", name: "شيكو شيبس 28g",          size: "28g",   brand: "Halawany",        price: 10,  cost:  6,   cat: "td-cat-09", stock: 160, minStock: 20, barcode: "6224300000007" },
  // ── Candy & Chocolate ──────────────────────────────────────────────────────
  { id: "td-pr-063", name: "كيت-كات 2 أصابع",        size: "1pc",   brand: "Nestlé",          price: 18,  cost: 11,   cat: "td-cat-10", stock: 200, minStock: 25, barcode: "6224400000001" },
  { id: "td-pr-064", name: "مارس",                   size: "1pc",   brand: "Mars",            price: 22,  cost: 14,   cat: "td-cat-10", stock: 180, minStock: 20, barcode: "6224400000002" },
  { id: "td-pr-065", name: "سنيكرز",                 size: "1pc",   brand: "Mars",            price: 25,  cost: 16,   cat: "td-cat-10", stock: 160, minStock: 20, barcode: "6224400000003" },
  { id: "td-pr-066", name: "توبليرون 100g",          size: "100g",  brand: "Mondelez",        price: 55,  cost: 40,   cat: "td-cat-10", stock:  80, minStock: 10, barcode: "6224400000004" },
  { id: "td-pr-067", name: "كيندر بوينو",            size: "1pc",   brand: "Ferrero",         price: 25,  cost: 16,   cat: "td-cat-10", stock: 120, minStock: 15, barcode: "6224400000005" },
  { id: "td-pr-068", name: "دراجيه شيكولاتة",        size: "1pc",   brand: "Local",           price:  8,  cost:  5,   cat: "td-cat-10", stock: 300, minStock: 40, barcode: "6224400000006" },
  { id: "td-pr-069", name: "كراميل لاكي",            size: "1pc",   brand: "Local",           price:  5,  cost:  3,   cat: "td-cat-10", stock: 400, minStock: 50, barcode: "6224400000007" },
  { id: "td-pr-100", name: "أوريو شيكولاتة",         size: "1pc",   brand: "Nabisco",         price: 15,  cost:  9,   cat: "td-cat-10", stock: 180, minStock: 20, barcode: "6224400000008" },
  // ── Gum & Mints ────────────────────────────────────────────────────────────
  { id: "td-pr-070", name: "اكسترا 14 حبة",          size: "1pc",   brand: "Wrigley",         price: 12,  cost:  7,   cat: "td-cat-11", stock: 200, minStock: 25, barcode: "6224500000001" },
  { id: "td-pr-071", name: "أوربيت فريش مينت",       size: "1pc",   brand: "Wrigley",         price: 12,  cost:  7,   cat: "td-cat-11", stock: 180, minStock: 25, barcode: "6224500000002" },
  { id: "td-pr-072", name: "ديرتي فريش",             size: "1pc",   brand: "Fresh",           price: 10,  cost:  6,   cat: "td-cat-11", stock: 220, minStock: 30, barcode: "6224500000003" },
  { id: "td-pr-073", name: "منتوس فروت",             size: "1pc",   brand: "Mentos",          price: 15,  cost:  9,   cat: "td-cat-11", stock: 160, minStock: 20, barcode: "6224500000004" },
  { id: "td-pr-074", name: "ادمز برمتين",            size: "1pc",   brand: "Adams",           price:  8,  cost:  5,   cat: "td-cat-11", stock: 250, minStock: 30, barcode: "6224500000005" },
  // ── Coffee & Tea ───────────────────────────────────────────────────────────
  { id: "td-pr-075", name: "نسكافيه كلاسيك 50g",     size: "50g",   brand: "Nestlé",          price: 95,  cost: 72,   cat: "td-cat-12", stock:  80, minStock: 10, barcode: "6224600000001" },
  { id: "td-pr-076", name: "نسكافيه 3×1 10 كيس",    size: "10pcs", brand: "Nestlé",          price: 40,  cost: 28,   cat: "td-cat-12", stock: 100, minStock: 15, barcode: "6224600000002" },
  { id: "td-pr-077", name: "ماكسيم 12 كيس",          size: "12pcs", brand: "Maxim",           price: 65,  cost: 48,   cat: "td-cat-12", stock:  70, minStock:  8, barcode: "6224600000003" },
  { id: "td-pr-078", name: "شاي ليبتون 25 كيس",      size: "25pcs", brand: "Lipton",          price: 55,  cost: 38,   cat: "td-cat-12", stock:  90, minStock: 10, barcode: "6224600000004" },
  { id: "td-pr-079", name: "نسكافيه ذهبي 20g",       size: "20g",   brand: "Nestlé",          price: 55,  cost: 40,   cat: "td-cat-12", stock:  60, minStock:  8, barcode: "6224600000005" },
  // ── Recharge Cards ─────────────────────────────────────────────────────────
  { id: "td-pr-080", name: "شحن فودافون 15ج",        size: "1pc",   brand: "Vodafone",        price: 15,  cost: 13.5, cat: "td-cat-13", stock: 100, minStock: 20, barcode: "6224700000001" },
  { id: "td-pr-081", name: "شحن أورنج 15ج",          size: "1pc",   brand: "Orange",          price: 15,  cost: 13.5, cat: "td-cat-13", stock: 100, minStock: 20, barcode: "6224700000002" },
  { id: "td-pr-082", name: "شحن اتصالات 20ج",        size: "1pc",   brand: "Etisalat",        price: 20,  cost: 18.5, cat: "td-cat-13", stock:  80, minStock: 15, barcode: "6224700000003" },
  { id: "td-pr-083", name: "شحن WE 25ج",             size: "1pc",   brand: "WE",              price: 25,  cost: 23.5, cat: "td-cat-13", stock:  80, minStock: 15, barcode: "6224700000004" },
  { id: "td-pr-084", name: "شحن فودافون 50ج",        size: "1pc",   brand: "Vodafone",        price: 50,  cost: 47,   cat: "td-cat-13", stock:  60, minStock: 10, barcode: "6224700000005" },
  // ── Small Electronics ──────────────────────────────────────────────────────
  { id: "td-pr-085", name: "سماعة بلوتوث زراريع",    size: "1pc",   brand: "Generic",         price: 350, cost: 220,  cat: "td-cat-14", stock:  30, minStock:  3, barcode: "6224800000001" },
  { id: "td-pr-086", name: "شاحن USB سريع 2A",       size: "1pc",   brand: "Generic",         price: 150, cost:  90,  cat: "td-cat-14", stock:  50, minStock:  5, barcode: "6224800000002" },
  { id: "td-pr-087", name: "كابل شحن تايب سي 1m",    size: "1m",    brand: "Generic",         price: 100, cost:  55,  cat: "td-cat-14", stock:  60, minStock:  8, barcode: "6224800000003" },
  { id: "td-pr-088", name: "بطارية AA 4pcs",          size: "4pcs",  brand: "Duracell",        price: 35,  cost:  20,  cat: "td-cat-14", stock:  80, minStock: 10, barcode: "6224800000004" },
  { id: "td-pr-089", name: "بطارية AAA 4pcs",         size: "4pcs",  brand: "Duracell",        price: 35,  cost:  20,  cat: "td-cat-14", stock:  70, minStock: 10, barcode: "6224800000005" },
  // ── Miscellaneous ──────────────────────────────────────────────────────────
  { id: "td-pr-090", name: "كبريت خشبي",             size: "1pc",   brand: "Generic",         price:  3,  cost:  1.5, cat: "td-cat-15", stock: 500, minStock:100, barcode: "6224900000001" },
  { id: "td-pr-091", name: "علبة مناديل 100",        size: "1box",  brand: "Local",           price: 28,  cost: 18,   cat: "td-cat-15", stock: 100, minStock: 15, barcode: "6224900000002" },
  { id: "td-pr-092", name: "مناديل ورقية مطبوعة",    size: "1pc",   brand: "Local",           price:  5,  cost:  3,   cat: "td-cat-15", stock: 400, minStock: 50, barcode: "6224900000003" },
  { id: "td-pr-093", name: "سلفن شفاف",              size: "1roll", brand: "Local",           price: 10,  cost:  6,   cat: "td-cat-15", stock: 150, minStock: 20, barcode: "6224900000004" },
  { id: "td-pr-094", name: "ورق سندويتش فويل",       size: "1pc",   brand: "Local",           price:  8,  cost:  5,   cat: "td-cat-15", stock: 200, minStock: 25, barcode: "6224900000005" },
  { id: "td-pr-095", name: "سكر بياض 1kg",           size: "1kg",   brand: "Local",           price: 42,  cost: 33,   cat: "td-cat-15", stock:  80, minStock: 10, barcode: "6224900000006" },
  { id: "td-pr-096", name: "ملح طعام 1kg",           size: "1kg",   brand: "Local",           price: 12,  cost:  8,   cat: "td-cat-15", stock:  60, minStock:  8, barcode: "6224900000007" },
  { id: "td-pr-097", name: "زيت ذرة 750ml",          size: "750ml", brand: "Hayat",           price: 85,  cost: 66,   cat: "td-cat-15", stock:  60, minStock:  8, barcode: "6224900000008" },
  { id: "td-pr-098", name: "عسل نحل طبيعي 250g",     size: "250g",  brand: "Local",           price: 120, cost: 90,   cat: "td-cat-15", stock:  30, minStock:  4, barcode: "6224900000009" },
  { id: "td-pr-099", name: "بسكويت مراحيبي",         size: "1pc",   brand: "Local",           price:  6,  cost:  3.5, cat: "td-cat-15", stock: 300, minStock: 40, barcode: "6224900000010" },
];

const customers = [
  {
    id: "td-cu-001",
    name: "محمد أحمد علي",
    phone: "01012345678",
    address: "القاهرة - مصر الجديدة",
  },
  {
    id: "td-cu-002",
    name: "أحمد محمد إبراهيم",
    phone: "01023456789",
    address: "الجيزة - المهندسين",
  },
  {
    id: "td-cu-003",
    name: "علي حسن محمود",
    phone: "01034567890",
    address: "الإسكندرية",
  },
  {
    id: "td-cu-004",
    name: "مصطفى عبدالله سيد",
    phone: "01045678901",
    address: "المنصورة",
  },
  {
    id: "td-cu-005",
    name: "عمر خالد يوسف",
    phone: "01056789012",
    address: "القاهرة - النزهة",
  },
  {
    id: "td-cu-006",
    name: "خالد عمر فاروق",
    phone: "01067890123",
    address: "طنطا",
  },
  {
    id: "td-cu-007",
    name: "يوسف سامي الشاذلي",
    phone: "01078901234",
    address: "الإسكندرية - سموحة",
  },
  {
    id: "td-cu-008",
    name: "سامي ناصر إبراهيم",
    phone: "01089012345",
    address: "القاهرة - عين شمس",
  },
  {
    id: "td-cu-009",
    name: "حسين علاء عبدالرحمن",
    phone: "01090123456",
    address: "بورسعيد",
  },
  {
    id: "td-cu-010",
    name: "إبراهيم جمال الدين",
    phone: "01101234567",
    address: "الإسماعيلية",
  },
  {
    id: "td-cu-011",
    name: "عبدالرحمن فتحي",
    phone: "01112345678",
    address: "القاهرة - الزيتون",
  },
  {
    id: "td-cu-012",
    name: "رامي مجدي العيسوي",
    phone: "01123456789",
    address: "الجيزة - الدقي",
  },
  {
    id: "td-cu-013",
    name: "طارق رضا سلامة",
    phone: "01134567890",
    address: "الإسكندرية - الانفوشي",
  },
  {
    id: "td-cu-014",
    name: "ماجد صلاح الدين",
    phone: "01145678901",
    address: "شبرا الخيمة",
  },
  {
    id: "td-cu-015",
    name: "وليد أمين مرسي",
    phone: "01156789012",
    address: "القاهرة - المقطم",
  },
  {
    id: "td-cu-016",
    name: "هشام الحوفي عبداللطيف",
    phone: "01167890123",
    address: "الفيوم",
  },
  {
    id: "td-cu-017",
    name: "عادل حمدي السيد",
    phone: "01178901234",
    address: "سوهاج",
  },
  {
    id: "td-cu-018",
    name: "نادر محمود عارف",
    phone: "01189012345",
    address: "أسيوط",
  },
  {
    id: "td-cu-019",
    name: "أشرف إبراهيم فودة",
    phone: "01190123456",
    address: "القاهرة - حدائق الأهرام",
  },
  {
    id: "td-cu-020",
    name: "كريم محمد حسين",
    phone: "01201234567",
    address: "الجيزة - أكتوبر",
  },
  {
    id: "td-cu-021",
    name: "فريد عبد الحكيم",
    phone: "01212345678",
    address: "القاهرة - المعادي",
  },
  {
    id: "td-cu-022",
    name: "عز الدين وليد",
    phone: "01223456789",
    address: "الإسكندرية - العجمي",
  },
  {
    id: "td-cu-023",
    name: "نبيل جورج وهبة",
    phone: "01234567890",
    address: "الجيزة - هرم",
  },
  {
    id: "td-cu-024",
    name: "شريف وحيد عزب",
    phone: "01245678901",
    address: "القاهرة - التجمع",
  },
  {
    id: "td-cu-025",
    name: "حازم كمال توفيق",
    phone: "01256789012",
    address: "المنوفية",
  },
  {
    id: "td-cu-026",
    name: "بسام الدكروري",
    phone: "01267890123",
    address: "بنها",
  },
  {
    id: "td-cu-027",
    name: "أيمن صادق إبراهيم",
    phone: "01278901234",
    address: "طنطا",
  },
  {
    id: "td-cu-028",
    name: "مروان أحمد زيدان",
    phone: "01289012345",
    address: "شرم الشيخ",
  },
  {
    id: "td-cu-029",
    name: "تامر حسني عطية",
    phone: "01290123456",
    address: "دمياط",
  },
  {
    id: "td-cu-030",
    name: "عمرو صلاح خليل",
    phone: "01301234567",
    address: "الإسكندرية - كرموز",
  },
  {
    id: "td-cu-031",
    name: "ياسر حسام بكر",
    phone: "01312345678",
    address: "القاهرة - مدينة نصر",
  },
  {
    id: "td-cu-032",
    name: "زياد أنور الأنصاري",
    phone: "01323456789",
    address: "الجيزة - فيصل",
  },
  {
    id: "td-cu-033",
    name: "حمدي سعيد رزق",
    phone: "01334567890",
    address: "الزقازيق",
  },
  {
    id: "td-cu-034",
    name: "باسم أيمن توفيق",
    phone: "01345678901",
    address: "القاهرة - السلام",
  },
  {
    id: "td-cu-035",
    name: "سعد الله الغندور",
    phone: "01356789012",
    address: "بلطيم",
  },
  {
    id: "td-cu-036",
    name: "بلال منصور عوض",
    phone: "01367890123",
    address: "الإسكندرية - المنتزه",
  },
  {
    id: "td-cu-037",
    name: "داوود رياض نصر",
    phone: "01378901234",
    address: "القاهرة - التبين",
  },
  {
    id: "td-cu-038",
    name: "منصور أبو السعود",
    phone: "01389012345",
    address: "الفيوم - إطسا",
  },
  {
    id: "td-cu-039",
    name: "ثروت عصمت عبيد",
    phone: "01390123456",
    address: "المنيا",
  },
  {
    id: "td-cu-040",
    name: "وائل السباعي سعادة",
    phone: "01401234567",
    address: "الجيزة - بولاق الدكرور",
  },
  {
    id: "td-cu-041",
    name: "إيهاب رياض مرزوق",
    phone: "01412345678",
    address: "الإسكندرية - العامرية",
  },
  {
    id: "td-cu-042",
    name: "حسام عادل سعيد",
    phone: "01423456789",
    address: "أسوان",
  },
  {
    id: "td-cu-043",
    name: "جمال الفار نجيب",
    phone: "01434567890",
    address: "لوكسور",
  },
  {
    id: "td-cu-044",
    name: "سيد أبو زيد جاد",
    phone: "01445678901",
    address: "الإسماعيلية - أبو خليفة",
  },
  {
    id: "td-cu-045",
    name: "فتح الباب حامد",
    phone: "01456789012",
    address: "الدقهلية",
  },
  {
    id: "td-cu-046",
    name: "أحمد رجب عوض",
    phone: "01467890123",
    address: "الشرقية - العاشر",
  },
  {
    id: "td-cu-047",
    name: "محمود لطفي سهيل",
    phone: "01478901234",
    address: "القاهرة - الشروق",
  },
  {
    id: "td-cu-048",
    name: "مدحت الغزاوي حجاج",
    phone: "01489012345",
    address: "الإسكندرية - مرسى مطروح",
  },
  {
    id: "td-cu-049",
    name: "نائل سلطان الفار",
    phone: "01490123456",
    address: "القاهرة - شبرا",
  },
  {
    id: "td-cu-050",
    name: "شريف مجاهد وهدان",
    phone: "01501234567",
    address: "الجيزة - الواحات",
  },
];

const suppliers = [
  {
    id: "td-sp-001",
    code: "SUP-TD-001",
    name: "شركة الشرقية للتبغ والسجائر",
    phone: "01011112222",
    address: "القاهرة - النزهة",
  },
  {
    id: "td-sp-002",
    code: "SUP-TD-002",
    name: "موزع مارلبورو مصر",
    phone: "01022223333",
    address: "الجيزة - الدقي",
  },
  {
    id: "td-sp-003",
    code: "SUP-TD-003",
    name: "مستودع BAT للتوزيع",
    phone: "01033334444",
    address: "الإسكندرية",
  },
  {
    id: "td-sp-004",
    code: "SUP-TD-004",
    name: "شركة كوكاكولا مصر للتوزيع",
    phone: "01044445555",
    address: "القاهرة - الزيتون",
  },
  {
    id: "td-sp-005",
    code: "SUP-TD-005",
    name: "موزع بيبسي كولا الرسمي",
    phone: "01055556666",
    address: "الجيزة",
  },
  {
    id: "td-sp-006",
    code: "SUP-TD-006",
    name: "شركة نستله مصر",
    phone: "01066667777",
    address: "القاهرة - مدينة نصر",
  },
  {
    id: "td-sp-007",
    code: "SUP-TD-007",
    name: "مستودع نخلة للمعسل",
    phone: "01077778888",
    address: "الإسكندرية",
  },
  {
    id: "td-sp-008",
    code: "SUP-TD-008",
    name: "موزع BIC للولاعات",
    phone: "01088889999",
    address: "القاهرة",
  },
  {
    id: "td-sp-009",
    code: "SUP-TD-009",
    name: "شركة شيبسي للوجبات الخفيفة",
    phone: "01099990000",
    address: "الجيزة - أكتوبر",
  },
  {
    id: "td-sp-010",
    code: "SUP-TD-010",
    name: "مستودع المشروبات الوطنية",
    phone: "01100001111",
    address: "المنوفية",
  },
  {
    id: "td-sp-011",
    code: "SUP-TD-011",
    name: "شركة فوديكو للتوزيع",
    phone: "01111112222",
    address: "القاهرة - المرج",
  },
  {
    id: "td-sp-012",
    code: "SUP-TD-012",
    name: "مستودع الإلكترونيات الصغيرة",
    phone: "01122223333",
    address: "الجيزة - إمبابة",
  },
  {
    id: "td-sp-013",
    code: "SUP-TD-013",
    name: "موزع ليبتون وشاي التوزيع",
    phone: "01133334444",
    address: "القاهرة - التجمع",
  },
  {
    id: "td-sp-014",
    code: "SUP-TD-014",
    name: "موزع Red Bull مصر",
    phone: "01144445555",
    address: "القاهرة - الزمالك",
  },
  {
    id: "td-sp-015",
    code: "SUP-TD-015",
    name: "شركة مواد التعبئة والتغليف",
    phone: "01155556666",
    address: "شبرا الخيمة",
  },
];

const expenseLabels = [
  "فاتورة كهرباء",
  "إيجار المحل",
  "صيانة تكييف",
  "راتب الموظف",
  "فاتورة مياه",
  "نظافة وتطهير",
  "أدوات مكتبية",
  "صيانة كاميرات مراقبة",
  "فاتورة الإنترنت",
  "صيانة أجهزة نقاط البيع",
  "تكاليف نقل وشحن",
  "رسوم ترخيص تجارية",
  "إعلانات ودعاية",
  "مصاريف صيانة عامة",
  "خدمات تنظيف شهرية",
];
const withdrawLabels = [
  "سحب نقدي يومي",
  "صرف إكراميات",
  "مصاريف طوارئ شخصية",
  "دفع دين مستحق",
  "سحب حصة أرباح",
  "مصاريف صيانة طارئة",
];
const returnReasons = [
  "منتج تالف",
  "خطأ في الطلب",
  "منتج منتهي الصلاحية",
  "جودة غير مقبولة",
  "رغبة العميل في الاسترجاع",
  "منتج مكسور",
  "خطأ في السعر",
  "منتج غير مطابق للمواصفات",
];

// ─── main seed transaction ────────────────────────────────────────────────────
const seedAll = db.transaction(() => {
  // ── 1. Categories ───────────────────────────────────────────────────────────
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, image)
    VALUES (?, ?, '')
  `);
  for (const c of categories) insertCat.run(c.id, c.name);
  console.log(`[SEED] ✓ ${categories.length} categories`);

  // ── 2. Products ─────────────────────────────────────────────────────────────
  const { max_code } = db
    .prepare(
      `SELECT COALESCE(MAX(CAST(product_code AS INTEGER)), 0) AS max_code
       FROM products WHERE product_code GLOB '[0-9]*'`,
    )
    .get();
  let codeSeq = Math.max(max_code + 1, 10001);

  const insertProd = db.prepare(`
    INSERT OR IGNORE INTO products
      (id, name, description, size, brand, price, cost, original_price,
       barcode, category_id, stock, min_stock, is_active, image, product_code,
       created_at, updated_at)
    VALUES (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '', ?, ?, ?)
  `);
  for (const p of products) {
    const ts = rDate(90, 180);
    insertProd.run(
      p.id,
      p.name,
      p.size,
      p.brand,
      p.price,
      p.cost,
      p.price,
      p.barcode,
      p.cat,
      p.stock,
      p.minStock,
      String(codeSeq++).padStart(5, "0"),
      ts,
      ts,
    );
  }
  console.log(`[SEED] ✓ ${products.length} products`);

  // After inserting, load ALL products (includes any pre-existing ones)
  const allProducts = db
    .prepare("SELECT id, name, price FROM products WHERE is_active = 1")
    .all();

  // ── 3. Customers ────────────────────────────────────────────────────────────
  const insertCust = db.prepare(`
    INSERT OR IGNORE INTO customers
      (id, customer_id, name, phone, email, address, notes,
       debt, total_purchases, total_spent, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, '', 0, 0, 0, ?, ?)
  `);
  customers.forEach((c, i) => {
    const ts = rDate(60, 180);
    insertCust.run(
      c.id,
      `C${String(i + 1).padStart(4, "0")}`,
      c.name,
      c.phone,
      c.address,
      ts,
      ts,
    );
  });
  console.log(`[SEED] ✓ ${customers.length} customers`);

  // ── 4. Suppliers ────────────────────────────────────────────────────────────
  const insertSup = db.prepare(`
    INSERT OR IGNORE INTO suppliers
      (id, supplier_code, name, phone, email, address, notes,
       debt, total_purchases, total_paid, created_at, updated_at)
    VALUES (?, ?, ?, ?, '', ?, '', 0, 0, 0, ?, ?)
  `);
  for (const s of suppliers) {
    const ts = rDate(90, 180);
    insertSup.run(s.id, s.code, s.name, s.phone, s.address, ts, ts);
  }
  console.log(`[SEED] ✓ ${suppliers.length} suppliers`);

  // ── 5. Sales + sale items ───────────────────────────────────────────────────
  const insertSale = db.prepare(`
    INSERT OR IGNORE INTO sales
      (id, receipt_number, customer_id, customer_name,
       subtotal, discount_amount, discount_type, discount_value,
       tax_rate, tax_amount, total,
       payment_method, amount_received, change_given, reference,
       cashier_id, cashier_name, note, status, created_at)
    VALUES (?, ?, ?, ?,  ?, 0, '', 0,  0, 0, ?,  ?, ?, ?, '',  ?, ?, '', ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO sale_items
      (id, sale_id, product_id, product_name, price, quantity, discount, discount_type, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'percentage', ?)
  `);

  const customerAgg = {}; // { custId: { purchases, spent } }
  const NUM_SALES = 600;
  const payMethods = [
    "cash",
    "cash",
    "cash",
    "cash",
    "cash",
    "cash",
    "card",
    "card",
    "wallet",
  ];
  const statuses = [
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "completed",
    "voided",
    "voided",
    "refunded",
  ];

  for (let i = 0; i < NUM_SALES; i++) {
    const saleId = uid();
    const receipt = nextReceipt();
    const cashier = rFrom(cashierPool);
    const saleDate = rDate(0, 180);
    const payMethod = rFrom(payMethods);
    const status = rFrom(statuses);

    // 40 % of sales are linked to a customer
    let custId = null,
      custName = "";
    if (rBool(0.4)) {
      const cust = rFrom(customers);
      custId = cust.id;
      custName = cust.name;
    }

    // 1-4 distinct items
    const numItems = rInt(1, 4);
    const seenProd = new Set();
    let subtotal = 0;
    const lineItems = [];

    for (let j = 0; j < numItems; j++) {
      let prod,
        attempts = 0;
      do {
        prod = rFrom(allProducts);
        attempts++;
      } while (seenProd.has(prod.id) && attempts < 15);
      seenProd.add(prod.id);

      const qty = rInt(1, rBool(0.75) ? 3 : 8);
      const lineSub = fmt2(prod.price * qty);
      subtotal += lineSub;
      lineItems.push({ prod, qty, lineSub });
    }

    subtotal = fmt2(subtotal);
    const total = subtotal; // no tax in default settings
    const received = payMethod === "cash" ? fmt2(total + rInt(0, 25)) : total;
    const change = fmt2(Math.max(0, received - total));

    insertSale.run(
      saleId,
      receipt,
      custId,
      custName,
      subtotal,
      total,
      payMethod,
      received,
      change,
      cashier.id,
      cashier.name,
      status,
      saleDate,
    );

    for (const li of lineItems) {
      insertItem.run(
        uid(),
        saleId,
        li.prod.id,
        li.prod.name,
        li.prod.price,
        li.qty,
        li.lineSub,
      );
    }

    if (custId && status === "completed") {
      if (!customerAgg[custId])
        customerAgg[custId] = { purchases: 0, spent: 0 };
      customerAgg[custId].purchases++;
      customerAgg[custId].spent += total;
    }
  }
  console.log(`[SEED] ✓ ${NUM_SALES} sales`);

  // Update customer aggregates
  const updateCust = db.prepare(`
    UPDATE customers SET total_purchases = ?, total_spent = ?,
      updated_at = datetime('now','localtime') WHERE id = ?
  `);
  for (const [cid, agg] of Object.entries(customerAgg)) {
    updateCust.run(agg.purchases, fmt2(agg.spent), cid);
  }

  // ── 6. Returns ──────────────────────────────────────────────────────────────
  const insertReturn = db.prepare(`
    INSERT OR IGNORE INTO returns
      (id, return_number, sale_id, product_id, product_name,
       quantity, refund_amount, reason, status,
       processed_by, processed_by_id, created_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const returnStatuses = [
    "approved",
    "approved",
    "approved",
    "approved",
    "pending",
    "rejected",
  ];

  const NUM_RETURNS = 150;
  for (let i = 0; i < NUM_RETURNS; i++) {
    const prod = rFrom(allProducts);
    const qty = rInt(1, 2);
    const refund = fmt2(prod.price * qty);
    insertReturn.run(
      uid(),
      nextReturn(),
      prod.id,
      prod.name,
      qty,
      refund,
      rFrom(returnReasons),
      rFrom(returnStatuses),
      "مدير النظام",
      "seed-admin",
      rDate(0, 150),
    );
  }
  console.log(`[SEED] ✓ ${NUM_RETURNS} returns`);

  // ── 7. Treasury operations ──────────────────────────────────────────────────
  const insertTreasury = db.prepare(`
    INSERT OR IGNORE INTO treasury_ops
      (id, type, name, amount, user, user_id, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const NUM_TREASURY = 80;
  for (let i = 0; i < NUM_TREASURY; i++) {
    const isExpense = rBool(0.65);
    const type = isExpense ? "expense" : "withdraw";
    const name = isExpense ? rFrom(expenseLabels) : rFrom(withdrawLabels);
    const amount = isExpense ? fmt2(rInt(50, 2500)) : fmt2(rInt(200, 5000));
    const ts = rDate(0, 180);
    insertTreasury.run(
      uid(),
      type,
      name,
      amount,
      "مدير النظام",
      "seed-admin",
      ts,
      ts,
    );
  }
  console.log(`[SEED] ✓ ${NUM_TREASURY} treasury operations`);

  // ── 8. Supplier operations ──────────────────────────────────────────────────
  const insertSupOp = db.prepare(`
    INSERT OR IGNORE INTO supplier_operations
      (id, supplier_id, type, purchase_amount, paid_amount,
       debt_before, debt_after, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const supplierDebt = {};
  const NUM_SUP_OPS = 50;

  for (let i = 0; i < NUM_SUP_OPS; i++) {
    const sup = rFrom(suppliers);
    if (!supplierDebt[sup.id]) supplierDebt[sup.id] = 0;
    const debtBefore = supplierDebt[sup.id];
    const isPurchase = rBool(0.68);

    let purchaseAmt = 0,
      paidAmt = 0,
      debtAfter = debtBefore;
    if (isPurchase) {
      purchaseAmt = fmt2(rInt(1500, 18000));
      paidAmt = fmt2(purchaseAmt * (0.5 + Math.random() * 0.5));
      debtAfter = fmt2(debtBefore + purchaseAmt - paidAmt);
    } else {
      paidAmt = fmt2(Math.min(rInt(500, 4000), Math.max(0, debtBefore)));
      debtAfter = fmt2(Math.max(0, debtBefore - paidAmt));
    }
    supplierDebt[sup.id] = debtAfter;

    insertSupOp.run(
      uid(),
      sup.id,
      isPurchase ? "purchase" : "settlement",
      purchaseAmt,
      paidAmt,
      debtBefore,
      debtAfter,
      isPurchase ? "شراء بضاعة" : "سداد مستحقات",
      rDate(0, 180),
    );
  }
  console.log(`[SEED] ✓ ${NUM_SUP_OPS} supplier operations`);

  // Update supplier aggregates
  const updateSup = db.prepare(`
    UPDATE suppliers
    SET debt = ?,
        total_purchases = (SELECT COALESCE(SUM(purchase_amount),0) FROM supplier_operations WHERE supplier_id = ? AND type = 'purchase'),
        total_paid      = (SELECT COALESCE(SUM(paid_amount),0)     FROM supplier_operations WHERE supplier_id = ? AND type = 'purchase'),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `);
  for (const [supId, debt] of Object.entries(supplierDebt)) {
    updateSup.run(fmt2(debt), supId, supId, supId);
  }
});

// ─── run ──────────────────────────────────────────────────────────────────────
try {
  seedAll();

  const summary = db
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM categories)             AS cats,
      (SELECT COUNT(*) FROM products)               AS prods,
      (SELECT COUNT(*) FROM customers)              AS custs,
      (SELECT COUNT(*) FROM suppliers)              AS sups,
      (SELECT COUNT(*) FROM sales)                  AS sales,
      (SELECT COUNT(*) FROM sale_items)             AS items,
      (SELECT COUNT(*) FROM returns)                AS returns,
      (SELECT COUNT(*) FROM treasury_ops)           AS treasury,
      (SELECT COUNT(*) FROM supplier_operations)    AS sup_ops
  `,
    )
    .get();

  console.log("\n[SEED] ── Summary ─────────────────────────────");
  console.log(`  Categories        : ${summary.cats}`);
  console.log(`  Products          : ${summary.prods}`);
  console.log(`  Customers         : ${summary.custs}`);
  console.log(`  Suppliers         : ${summary.sups}`);
  console.log(`  Sales             : ${summary.sales}`);
  console.log(`  Sale items        : ${summary.items}`);
  console.log(`  Returns           : ${summary.returns}`);
  console.log(`  Treasury ops      : ${summary.treasury}`);
  console.log(`  Supplier ops      : ${summary.sup_ops}`);
  console.log("[SEED] ── Done ✓ ──────────────────────────────\n");
} catch (err) {
  console.error("[SEED] Error:", err);
  process.exit(1);
} finally {
  db.close();
}
