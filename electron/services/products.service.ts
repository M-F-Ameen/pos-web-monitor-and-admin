import { getDb } from "../database";
import type {
  Product,
  ProductLite,
  ProductsListQuery,
  ProductsPagedResult,
} from "../shared/types";

// ============================================
// Products Service
// ============================================

const PRODUCT_CODE_LENGTH = 5;
const PRODUCT_CODE_SPACE = 10 ** PRODUCT_CODE_LENGTH;
const PRODUCT_CODE_MAX_RANDOM_ATTEMPTS = 500;

function formatProductCode(value: number): string {
  return String(value).padStart(PRODUCT_CODE_LENGTH, "0");
}

function randomProductCodeCandidate(): string {
  return formatProductCode(Math.floor(Math.random() * PRODUCT_CODE_SPACE));
}

function generateUniqueProductCode(db: ReturnType<typeof getDb>): string {
  const countRow = db
    .prepare("SELECT COUNT(*) as count FROM products")
    .get() as {
    count: number;
  };

  if (countRow.count >= PRODUCT_CODE_SPACE) {
    throw new Error(
      "Cannot assign product code: all 5-digit codes are already in use.",
    );
  }

  const existsByCode = db.prepare(
    "SELECT 1 as found FROM products WHERE product_code = ? LIMIT 1",
  );

  for (
    let attempt = 0;
    attempt < PRODUCT_CODE_MAX_RANDOM_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = randomProductCodeCandidate();
    const exists = existsByCode.get(candidate) as { found: number } | undefined;
    if (!exists) {
      return candidate;
    }
  }

  // Fallback: deterministic scan guarantees success when a free code exists.
  for (let value = 0; value < PRODUCT_CODE_SPACE; value += 1) {
    const candidate = formatProductCode(value);
    const exists = existsByCode.get(candidate) as { found: number } | undefined;
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Failed to allocate a unique 5-digit product code.");
}

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    size: row.size as string,
    brand: row.brand as string,
    price: row.price as number,
    cost: row.cost as number,
    originalPrice: row.original_price as number,
    productCode: row.product_code as string,
    barcode: row.barcode as string,
    categoryId: row.category_id as string,
    categoryName: (row.category_name as string) ?? "",
    stock: row.stock as number,
    minStock: row.min_stock as number,
    isActive: (row.is_active as number) === 1,
    image: row.image as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToProductLite(row: Record<string, unknown>): ProductLite {
  return {
    id: row.id as string,
    name: row.name as string,
    productCode: row.product_code as string,
    barcode: row.barcode as string,
    categoryId: row.category_id as string,
    price: row.price as number,
    stock: row.stock as number,
    isActive: (row.is_active as number) === 1,
  };
}

const BASE_SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`;

export function listProducts(activeOnly = false): Product[] {
  const db = getDb();
  const where = activeOnly ? " WHERE p.is_active = 1" : "";
  const rows = db
    .prepare(`${BASE_SELECT}${where} ORDER BY p.created_at DESC`)
    .all() as Record<string, unknown>[];
  return rows.map(rowToProduct);
}

export function listProductsLite(activeOnly = false): ProductLite[] {
  const db = getDb();
  const where = activeOnly ? " WHERE is_active = 1" : "";
  const rows = db
    .prepare(
      `SELECT id, name, product_code, barcode, category_id, price, stock, is_active FROM products${where} ORDER BY created_at DESC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToProductLite);
}

export function listProductsPaged(
  query: ProductsListQuery = {},
): ProductsPagedResult {
  const db = getDb();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (query.activeOnly) {
    clauses.push("p.is_active = 1");
  }

  if (query.categoryId?.trim()) {
    clauses.push("p.category_id = ?");
    params.push(query.categoryId.trim());
  }

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    clauses.push(
      "(p.name LIKE ? OR p.size LIKE ? OR p.brand LIKE ? OR p.barcode LIKE ? OR p.product_code LIKE ? OR CAST(p.stock AS TEXT) LIKE ? OR c.name LIKE ?)",
    );
    params.push(term, term, term, term, term, term, term);
  }

  const whereSql = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM products p LEFT JOIN categories c ON p.category_id = c.id${whereSql}`,
      )
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `${BASE_SELECT}${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  // Summary stats across ALL products (not just the current page),
  // scoped only by activeOnly, not by search.
  const summaryWhere = query.activeOnly ? " WHERE is_active = 1" : "";
  const summaryRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(price * stock), 0) AS val FROM products${summaryWhere}`,
    )
    .get() as { cnt: number; val: number };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items: rows.map(rowToProduct),
    total,
    page,
    pageSize,
    totalPages,
    totalValue: summaryRow.val,
    totalCount: summaryRow.cnt,
  };
}

export function getProductById(id: string): Product | null {
  const db = getDb();
  const row = db.prepare(`${BASE_SELECT} WHERE p.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToProduct(row) : null;
}

export function getProductByBarcode(barcode: string): Product | null {
  if (!barcode) return null;
  const db = getDb();
  const row = db
    .prepare(`${BASE_SELECT} WHERE p.barcode = ? AND p.is_active = 1`)
    .get(barcode) as Record<string, unknown> | undefined;
  return row ? rowToProduct(row) : null;
}

export function createProduct(data: {
  name: string;
  description?: string;
  size?: string;
  brand?: string;
  price: number;
  cost?: number;
  originalPrice?: number;
  barcode?: string;
  categoryId?: string;
  stock?: number;
  minStock?: number;
  isActive?: boolean;
  image?: string;
}): Product {
  // Input validation
  if (!data.name?.trim()) {
    throw new Error("اسم المنتج مطلوب.");
  }
  if (!Number.isFinite(data.price) || data.price < 0) {
    throw new Error("سعر المنتج يجب أن يكون رقمًا غير سالب.");
  }
  if (
    data.cost !== undefined &&
    (!Number.isFinite(data.cost) || data.cost < 0)
  ) {
    throw new Error("تكلفة المنتج يجب أن تكون رقمًا غير سالب.");
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const productCode = generateUniqueProductCode(db);
  db.prepare(
    `
    INSERT INTO products (id, name, description, size, brand, price, cost, original_price, product_code, barcode, category_id, stock, min_stock, is_active, image, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
  `,
  ).run(
    id,
    data.name.trim(),
    data.description?.trim() ?? "",
    data.size?.trim() ?? "",
    data.brand?.trim() ?? "",
    data.price,
    data.cost ?? 0,
    data.originalPrice ?? 0,
    productCode,
    data.barcode?.trim() ?? "",
    data.categoryId ?? "",
    data.stock ?? 0,
    data.minStock ?? 0,
    data.isActive !== false ? 1 : 0,
    data.image ?? "",
  );
  return getProductById(id)!;
}

export function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    size: string;
    brand: string;
    price: number;
    cost: number;
    originalPrice: number;
    barcode: string;
    categoryId: string;
    stock: number;
    minStock: number;
    isActive: boolean;
    image: string;
  }>,
): Product | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  const map: Record<string, string> = {
    name: "name",
    description: "description",
    size: "size",
    brand: "brand",
    price: "price",
    cost: "cost",
    originalPrice: "original_price",
    barcode: "barcode",
    categoryId: "category_id",
    stock: "stock",
    minStock: "min_stock",
    image: "image",
  };

  for (const [key, col] of Object.entries(map)) {
    const val = (data as Record<string, unknown>)[key];
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      values.push(typeof val === "string" ? val.trim() : val);
    }
  }

  if (data.isActive !== undefined) {
    fields.push("is_active = ?");
    values.push(data.isActive ? 1 : 0);
  }

  if (fields.length === 0) return getProductById(id);

  fields.push("updated_at = datetime('now','localtime')");
  values.push(id);

  db.prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );
  return getProductById(id);
}

export function deleteProduct(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  return result.changes > 0;
}

export function deleteAllProducts(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM products").run();
  return result.changes;
}

/**
 * Decrement stock for a list of products (during a sale).
 * Returns true if all stock checks pass.
 * Throws if any product has insufficient stock and allowNegativeStock is false.
 */
export function decrementStock(
  items: { productId: string; quantity: number }[],
  allowNegativeStock: boolean,
): void {
  const db = getDb();
  const update = db.prepare(
    "UPDATE products SET stock = stock - ?, updated_at = datetime('now','localtime') WHERE id = ?",
  );
  const check = db.prepare("SELECT stock, name FROM products WHERE id = ?");

  for (const item of items) {
    if (!item.productId) {
      throw new Error("Product id is required for stock movement.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Stock quantity must be a positive integer.");
    }

    const row = check.get(item.productId) as
      | { stock: number; name: string }
      | undefined;
    if (!row) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    if (!allowNegativeStock && row.stock < item.quantity) {
      throw new Error(
        `Insufficient stock for "${row.name}" (available: ${row.stock}).`,
      );
    }

    update.run(item.quantity, item.productId);
  }
}

/**
 * Restore stock for a return.
 */
export function incrementStock(productId: string, quantity: number): void {
  if (!productId) {
    throw new Error("Product id is required for stock restoration.");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Stock quantity must be a positive integer.");
  }

  const db = getDb();
  const result = db
    .prepare(
      "UPDATE products SET stock = stock + ?, updated_at = datetime('now','localtime') WHERE id = ?",
    )
    .run(quantity, productId);

  if (result.changes === 0) {
    throw new Error(`Product not found: ${productId}`);
  }
}
