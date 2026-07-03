import { getDb } from "../database";
import { decrementStock, incrementStock } from "./products.service";
import type {
  PagedResult,
  Return,
  Sale,
  SaleItem,
  SaleRefundInput,
  SaleRefundResult,
  SalesListQuery,
  SalesTimelineQuery,
  SalesTimelineRow,
} from "../shared/types";

// ============================================
// Sales Service
// ============================================

const RECEIPT_NUMBER_MAX_GENERATION_ATTEMPTS = 12;
const RETURN_NUMBER_MAX_GENERATION_ATTEMPTS = 12;

function rowToSale(row: Record<string, unknown>): Omit<Sale, "items"> {
  return {
    id: row.id as string,
    receiptNumber: row.receipt_number as string,
    customerId: (row.customer_id as string) || null,
    customerName: row.customer_name as string,
    subtotal: row.subtotal as number,
    increaseAmount: (row.increase_amount as number) ?? 0,
    discountAmount: row.discount_amount as number,
    discountType: row.discount_type as Sale["discountType"],
    discountValue: row.discount_value as number,
    taxRate: row.tax_rate as number,
    taxAmount: row.tax_amount as number,
    total: row.total as number,
    paymentMethod: row.payment_method as Sale["paymentMethod"],
    amountReceived: row.amount_received as number,
    changeGiven: row.change_given as number,
    reference: row.reference as string,
    cashierId: row.cashier_id as string,
    cashierName: row.cashier_name as string,
    note: row.note as string,
    status: row.status as Sale["status"],
    createdAt: row.created_at as string,
  };
}

function rowToSaleItem(row: Record<string, unknown>): SaleItem {
  return {
    id: row.id as string,
    saleId: row.sale_id as string,
    productId: row.product_id as string,
    productName: row.product_name as string,
    price: row.price as number,
    quantity: row.quantity as number,
    discount: row.discount as number,
    discountType: row.discount_type as SaleItem["discountType"],
    subtotal: row.subtotal as number,
  };
}

function rowToReturn(row: Record<string, unknown>): Return {
  return {
    id: row.id as string,
    returnNumber: row.return_number as string,
    saleId: (row.sale_id as string) || null,
    productId: row.product_id as string,
    productName: row.product_name as string,
    quantity: row.quantity as number,
    refundAmount: row.refund_amount as number,
    reason: row.reason as string,
    status: row.status as Return["status"],
    processedById: row.processed_by_id as string,
    processedBy: row.processed_by as string,
    createdAt: row.created_at as string,
  };
}

function getSaleItemsBySaleIds(saleIds: string[]): Map<string, SaleItem[]> {
  const itemsBySaleId = new Map<string, SaleItem[]>();
  if (saleIds.length === 0) {
    return itemsBySaleId;
  }

  const db = getDb();
  const placeholders = saleIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT * FROM sale_items WHERE sale_id IN (${placeholders}) ORDER BY rowid ASC`,
    )
    .all(...saleIds) as Record<string, unknown>[];

  for (const row of rows) {
    const item = rowToSaleItem(row);
    const existing = itemsBySaleId.get(item.saleId) ?? [];
    existing.push(item);
    itemsBySaleId.set(item.saleId, existing);
  }

  return itemsBySaleId;
}

function getSaleItems(saleId: string): SaleItem[] {
  return getSaleItemsBySaleIds([saleId]).get(saleId) ?? [];
}

function clampMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

function normalizePaymentMethod(value: unknown): Sale["paymentMethod"] {
  if (value === "card" || value === "wallet" || value === "cash") {
    return value;
  }
  return "cash";
}

function normalizeSqlDateBoundary(
  value: string | undefined,
  boundary: "start" | "end",
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed} ${boundary === "start" ? "00:00:00" : "23:59:59"}`;
  }

  return trimmed.replace("T", " ").slice(0, 19);
}

function normalizeStatuses(
  statuses: SalesListQuery["statuses"],
): Sale["status"][] {
  if (!Array.isArray(statuses)) return [];
  const allowed = new Set<Sale["status"]>(["completed", "voided", "refunded"]);
  return statuses.filter((status): status is Sale["status"] =>
    allowed.has(status),
  );
}

function clampPage(value: number | undefined): number {
  if (!Number.isFinite(value) || !value) return 1;
  return Math.max(1, Math.trunc(value));
}

function clampPageSize(value: number | undefined, fallback = 20): number {
  if (!Number.isFinite(value) || !value) return fallback;
  return Math.min(500, Math.max(1, Math.trunc(value)));
}

function buildSalesWhereClause(query?: SalesListQuery): {
  whereSql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  const search = query?.search?.trim().toLowerCase();
  if (search) {
    const searchLike = `%${search}%`;
    clauses.push(
      `(
        LOWER(receipt_number) LIKE ?
        OR LOWER(customer_name) LIKE ?
        OR LOWER(cashier_name) LIKE ?
        OR LOWER(reference) LIKE ?
        OR LOWER(note) LIKE ?
      )`,
    );
    params.push(searchLike, searchLike, searchLike, searchLike, searchLike);
  }

  const statuses = normalizeStatuses(query?.statuses);
  if (statuses.length > 0) {
    clauses.push(`status IN (${statuses.map(() => "?").join(", ")})`);
    params.push(...statuses);
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

function normalizeReturnStatuses(
  statuses: SalesTimelineQuery["returnStatuses"],
): Return["status"][] {
  if (!Array.isArray(statuses)) return [];
  const allowed = new Set<Return["status"]>([
    "approved",
    "pending",
    "rejected",
  ]);
  return statuses.filter((status): status is Return["status"] =>
    allowed.has(status),
  );
}

function buildTimelineSalesWhereClause(query: SalesTimelineQuery): {
  whereSql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const search = query.search?.trim().toLowerCase();

  if (search) {
    const like = `%${search}%`;
    clauses.push(
      `(
        LOWER(s.receipt_number) LIKE ?
        OR LOWER(s.customer_name) LIKE ?
        OR LOWER(s.cashier_name) LIKE ?
        OR LOWER(s.reference) LIKE ?
        OR LOWER(s.note) LIKE ?
      )`,
    );
    params.push(like, like, like, like, like);
  }

  const statuses = normalizeStatuses(query.saleStatuses);
  if (statuses.length > 0) {
    clauses.push(`s.status IN (${statuses.map(() => "?").join(", ")})`);
    params.push(...statuses);
  }

  const fromDate = normalizeSqlDateBoundary(query.fromDate, "start");
  if (fromDate) {
    clauses.push("s.created_at >= ?");
    params.push(fromDate);
  }

  const toDate = normalizeSqlDateBoundary(query.toDate, "end");
  if (toDate) {
    clauses.push("s.created_at <= ?");
    params.push(toDate);
  }

  if (query.cashierId?.trim()) {
    clauses.push("s.cashier_id = ?");
    params.push(query.cashierId.trim());
  }

  if (clauses.length === 0) {
    return { whereSql: "", params };
  }

  return {
    whereSql: ` WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

function buildTimelineReturnsWhereClause(query: SalesTimelineQuery): {
  whereSql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const search = query.search?.trim().toLowerCase();

  if (search) {
    const like = `%${search}%`;
    clauses.push(
      `(
        LOWER(r.return_number) LIKE ?
        OR LOWER(r.product_name) LIKE ?
        OR LOWER(r.reason) LIKE ?
        OR LOWER(r.processed_by) LIKE ?
      )`,
    );
    params.push(like, like, like, like);
  }

  const statuses = normalizeReturnStatuses(query.returnStatuses);
  if (statuses.length > 0) {
    clauses.push(`r.status IN (${statuses.map(() => "?").join(", ")})`);
    params.push(...statuses);
  }

  const fromDate = normalizeSqlDateBoundary(query.fromDate, "start");
  if (fromDate) {
    clauses.push("r.created_at >= ?");
    params.push(fromDate);
  }

  const toDate = normalizeSqlDateBoundary(query.toDate, "end");
  if (toDate) {
    clauses.push("r.created_at <= ?");
    params.push(toDate);
  }

  if (query.cashierId?.trim()) {
    clauses.push("r.processed_by_id = ?");
    params.push(query.cashierId.trim());
  }

  if (clauses.length === 0) {
    return { whereSql: "", params };
  }

  return {
    whereSql: ` WHERE ${clauses.join(" AND ")}`,
    params,
  };
}

function mapSaleRows(
  rows: Record<string, unknown>[],
  includeItems: boolean,
): Sale[] {
  if (rows.length === 0) return [];
  const saleIds = rows.map((row) => row.id as string);
  const itemsBySaleId = includeItems
    ? getSaleItemsBySaleIds(saleIds)
    : new Map();

  return rows.map((row) => ({
    ...rowToSale(row),
    items: includeItems ? (itemsBySaleId.get(row.id as string) ?? []) : [],
  }));
}

function getNetCollected(
  sale: Pick<Sale, "amountReceived" | "changeGiven">,
): number {
  return clampMoney(sale.amountReceived - sale.changeGiven);
}

function getOutstandingDebt(
  sale: Pick<Sale, "total" | "amountReceived" | "changeGiven">,
): number {
  return clampMoney(sale.total - getNetCollected(sale));
}

function applyCustomerSaleImpact(
  db: ReturnType<typeof getDb>,
  sale: Pick<Sale, "customerId" | "total" | "amountReceived" | "changeGiven">,
  direction: "apply" | "revert",
): void {
  if (!sale.customerId) return;

  const sign = direction === "apply" ? 1 : -1;
  const totalDelta = clampMoney(sale.total) * sign;
  const debtDelta = getOutstandingDebt(sale) * sign;

  db.prepare(
    `
    UPDATE customers
    SET total_purchases = MAX(total_purchases + ?, 0),
        total_spent = MAX(total_spent + ?, 0),
        debt = MAX(debt + ?, 0),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `,
  ).run(sign, totalDelta, debtDelta, sale.customerId);
}

function toCompactTimePart(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}${mm}${ss}`;
}

function generateReceiptNumberCandidate(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = toCompactTimePart(now);
  const suffix = crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
  return `INV-${datePart}-${timePart}-${suffix}`;
}

function generateReturnNumberCandidate(): string {
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

function isUniqueConstraintErrorFor(
  error: unknown,
  tableName: string,
  columnName: string,
): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("UNIQUE constraint failed") &&
    error.message.includes(`${tableName}.${columnName}`)
  );
}

function getUniqueReturnNumber(
  db: ReturnType<typeof getDb>,
  used: Set<string>,
): string {
  const existsStmt = db.prepare(
    "SELECT 1 AS found FROM returns WHERE return_number = ? LIMIT 1",
  );

  for (
    let attempt = 1;
    attempt <= RETURN_NUMBER_MAX_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = generateReturnNumberCandidate();
    if (used.has(candidate)) continue;
    const exists = existsStmt.get(candidate) as { found: number } | undefined;
    if (!exists) {
      used.add(candidate);
      return candidate;
    }
  }

  throw new Error("Could not generate a unique return number. Please retry.");
}

export function listSales(query: SalesListQuery = {}): Sale[] {
  const db = getDb();
  const { whereSql, params } = buildSalesWhereClause(query);
  const includeItems = query.includeItems !== false;

  let sql = `SELECT * FROM sales${whereSql} ORDER BY created_at DESC`;
  const stmtParams = [...params];

  if (query.pageSize !== undefined) {
    const page = clampPage(query.page);
    const pageSize = clampPageSize(query.pageSize, 20);
    const offset = (page - 1) * pageSize;
    sql += " LIMIT ? OFFSET ?";
    stmtParams.push(pageSize, offset);
  }

  const rows = db.prepare(sql).all(...stmtParams) as Record<string, unknown>[];
  return mapSaleRows(rows, includeItems);
}

export function listSalesPaged(query: SalesListQuery = {}): PagedResult<Sale> {
  const db = getDb();
  const { whereSql, params } = buildSalesWhereClause(query);
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize, 20);
  const includeItems = query.includeItems !== false;
  const offset = (page - 1) * pageSize;

  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM sales${whereSql}`)
      .get(...params) as { count: number }
  ).count;

  const rows = db
    .prepare(
      `SELECT * FROM sales${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as Record<string, unknown>[];

  const items = mapSaleRows(rows, includeItems);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}

type TimelineIndexRow = {
  kind: "sale" | "return";
  record_id: string;
  created_at: string;
};

export function listSalesTimelinePaged(
  query: SalesTimelineQuery = {},
): PagedResult<SalesTimelineRow> {
  const db = getDb();
  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize, 20);
  const offset = (page - 1) * pageSize;
  const includeSaleItems = query.includeSaleItems !== false;

  const salesWhere = buildTimelineSalesWhereClause(query);
  const returnsWhere = buildTimelineReturnsWhereClause(query);

  const totalSales = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM sales s${salesWhere.whereSql}`)
      .get(...salesWhere.params) as { count: number }
  ).count;
  const totalReturns = (
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM returns r${returnsWhere.whereSql}`,
      )
      .get(...returnsWhere.params) as { count: number }
  ).count;
  const total = totalSales + totalReturns;

  const timelineRows = db
    .prepare(
      `
      SELECT kind, record_id, created_at
      FROM (
        SELECT 'sale' AS kind, s.id AS record_id, s.created_at AS created_at
        FROM sales s
        ${salesWhere.whereSql}
        UNION ALL
        SELECT 'return' AS kind, r.id AS record_id, r.created_at AS created_at
        FROM returns r
        ${returnsWhere.whereSql}
      ) timeline
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    )
    .all(
      ...salesWhere.params,
      ...returnsWhere.params,
      pageSize,
      offset,
    ) as TimelineIndexRow[];

  const saleIds = timelineRows
    .filter((row) => row.kind === "sale")
    .map((row) => row.record_id);
  const returnIds = timelineRows
    .filter((row) => row.kind === "return")
    .map((row) => row.record_id);

  const salesById = new Map<string, Sale>();
  if (saleIds.length > 0) {
    const placeholders = saleIds.map(() => "?").join(", ");
    const saleRows = db
      .prepare(`SELECT * FROM sales WHERE id IN (${placeholders})`)
      .all(...saleIds) as Record<string, unknown>[];
    const saleItemsById = includeSaleItems
      ? getSaleItemsBySaleIds(saleIds)
      : new Map<string, SaleItem[]>();

    for (const row of saleRows) {
      const saleId = row.id as string;
      salesById.set(saleId, {
        ...rowToSale(row),
        items: includeSaleItems ? (saleItemsById.get(saleId) ?? []) : [],
      });
    }
  }

  const returnsById = new Map<string, Return>();
  if (returnIds.length > 0) {
    const placeholders = returnIds.map(() => "?").join(", ");
    const returnRows = db
      .prepare(`SELECT * FROM returns WHERE id IN (${placeholders})`)
      .all(...returnIds) as Record<string, unknown>[];
    for (const row of returnRows) {
      const mapped = rowToReturn(row);
      returnsById.set(mapped.id, mapped);
    }
  }

  const items: SalesTimelineRow[] = [];
  for (const row of timelineRows) {
    if (row.kind === "sale") {
      const sale = salesById.get(row.record_id);
      if (!sale) continue;
      items.push({
        kind: "sale",
        id: sale.id,
        createdAt: sale.createdAt,
        sale,
      });
      continue;
    }

    const returnRecord = returnsById.get(row.record_id);
    if (!returnRecord) continue;
    items.push({
      kind: "return",
      id: `return:${returnRecord.id}`,
      createdAt: returnRecord.createdAt,
      returnRecord,
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function getSaleById(id: string): Sale | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return { ...rowToSale(row), items: getSaleItems(id) };
}

/**
 * Create a sale atomically:
 * 1. Insert the sale record
 * 2. Insert all sale items
 * 3. Decrement product stock
 * 4. Update customer purchase stats (if applicable)
 *
 * Rolls back everything on failure.
 */
export function createSale(data: {
  receiptNumber?: string;
  customerId?: string;
  customerName?: string;
  subtotal: number;
  increaseAmount?: number;
  discountAmount: number;
  discountType?: string;
  discountValue?: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paymentMethod?: Sale["paymentMethod"];
  amountReceived?: number;
  changeGiven?: number;
  reference?: string;
  cashierId?: string;
  cashierName?: string;
  note?: string;
  items?: {
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    discount?: number;
    discountType?: string;
    subtotal: number;
  }[];
  allowNegativeStock?: boolean;
}): Sale {
  const db = getDb();
  const paymentMethod = normalizePaymentMethod(data.paymentMethod);
  const safeItems = data.items ?? [];
  const preferredReceiptNumber = data.receiptNumber?.trim() || null;

  const normalizedTotal = clampMoney(data.total);
  const normalizedSubtotal = clampMoney(data.subtotal);
  const normalizedIncreaseAmount = clampMoney(data.increaseAmount ?? 0);
  const normalizedDiscountAmount = clampMoney(data.discountAmount);
  const normalizedDiscountValue = clampMoney(data.discountValue ?? 0);
  const normalizedTaxRate = clampMoney(data.taxRate);
  const normalizedTaxAmount = clampMoney(data.taxAmount);
  const normalizedAmountReceived = clampMoney(
    data.amountReceived ?? normalizedTotal,
  );
  const normalizedChangeGiven = clampMoney(data.changeGiven ?? 0);

  if (!Number.isFinite(normalizedTotal) || normalizedTotal < 0) {
    throw new Error("Invalid sale total.");
  }
  if (safeItems.length === 0) {
    throw new Error("Sale must contain at least one item.");
  }

  if (!Number.isFinite(normalizedAmountReceived)) {
    throw new Error("Invalid received amount.");
  }
  if (!Number.isFinite(normalizedChangeGiven)) {
    throw new Error("Invalid change amount.");
  }

  for (const item of safeItems) {
    if (!item.productId) {
      throw new Error("Sale item requires product id.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Invalid quantity for product "${item.productName}".`);
    }
    if (!Number.isFinite(item.price) || item.price < 0) {
      throw new Error(`Invalid price for product "${item.productName}".`);
    }
  }

  const maxAttempts = preferredReceiptNumber
    ? 1
    : RECEIPT_NUMBER_MAX_GENERATION_ATTEMPTS;
  let lastCollisionError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const saleId = crypto.randomUUID();
    const receiptNumber =
      preferredReceiptNumber ?? generateReceiptNumberCandidate();

    try {
      const txn = db.transaction(() => {
        // 1. Insert sale
        db.prepare(
          `
          INSERT INTO sales (id, receipt_number, customer_id, customer_name, subtotal, increase_amount, discount_amount, discount_type, discount_value, tax_rate, tax_amount, total, payment_method, amount_received, change_given, reference, cashier_id, cashier_name, note, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now','localtime'))
        `,
        ).run(
          saleId,
          receiptNumber,
          data.customerId || null,
          data.customerName ?? "",
          normalizedSubtotal,
          normalizedIncreaseAmount,
          normalizedDiscountAmount,
          data.discountType ?? "",
          normalizedDiscountValue,
          normalizedTaxRate,
          normalizedTaxAmount,
          normalizedTotal,
          paymentMethod,
          normalizedAmountReceived,
          normalizedChangeGiven,
          data.reference ?? "",
          data.cashierId ?? "",
          data.cashierName ?? "",
          data.note ?? "",
        );

        // 2. Insert sale items
        const insertItem = db.prepare(`
          INSERT INTO sale_items (id, sale_id, product_id, product_name, price, quantity, discount, discount_type, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of safeItems) {
          insertItem.run(
            crypto.randomUUID(),
            saleId,
            item.productId,
            item.productName,
            clampMoney(item.price),
            item.quantity,
            clampMoney(item.discount ?? 0),
            item.discountType ?? "percentage",
            clampMoney(item.subtotal),
          );
        }

        // 3. Decrement stock
        decrementStock(
          safeItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          data.allowNegativeStock ?? false,
        );

        // 4. Update customer stats if a customer is associated
        applyCustomerSaleImpact(
          db,
          {
            customerId: data.customerId ?? null,
            total: normalizedTotal,
            amountReceived: normalizedAmountReceived,
            changeGiven: normalizedChangeGiven,
          },
          "apply",
        );
      });

      txn();
      return getSaleById(saleId)!;
    } catch (error) {
      if (
        !preferredReceiptNumber &&
        isUniqueConstraintErrorFor(error, "sales", "receipt_number")
      ) {
        lastCollisionError = error;
        continue;
      }
      throw error;
    }
  }

  if (preferredReceiptNumber) {
    throw new Error(
      `Receipt number "${preferredReceiptNumber}" already exists. Please use another number.`,
    );
  }

  throw new Error(
    `Failed to create sale due to receipt-number collisions. ${
      lastCollisionError instanceof Error ? lastCollisionError.message : ""
    }`.trim(),
  );
}

/**
 * Update sale metadata (receipt number, customer, totals, payment method)
 * without touching items, stock, or the original timestamp.
 *
 * If the total changes and a customer is linked, customer purchase stats are
 * adjusted atomically (old impact reverted, new impact applied).
 */
export function updateSale(
  id: string,
  data: {
    receiptNumber?: string;
    customerName?: string;
    total?: number;
    subtotal?: number;
    paymentMethod?: Sale["paymentMethod"];
    note?: string;
  },
): Sale | null {
  const db = getDb();
  const existing = getSaleById(id);
  if (!existing) return null;

  const newReceiptNumber = data.receiptNumber?.trim() || existing.receiptNumber;
  const newCustomerName =
    data.customerName !== undefined
      ? data.customerName.trim()
      : existing.customerName;
  const newTotal =
    data.total !== undefined ? clampMoney(data.total) : existing.total;
  const newSubtotal =
    data.subtotal !== undefined ? clampMoney(data.subtotal) : existing.subtotal;
  const newPaymentMethod = data.paymentMethod
    ? normalizePaymentMethod(data.paymentMethod)
    : existing.paymentMethod;
  const newNote = data.note !== undefined ? data.note : existing.note;

  if (!Number.isFinite(newTotal) || newTotal < 0) {
    throw new Error("Invalid sale total.");
  }

  const totalChanged = newTotal !== existing.total;
  const receiptChanged = newReceiptNumber !== existing.receiptNumber;

  const txn = db.transaction(() => {
    // If the total changed we must adjust customer purchase stats.
    if (
      totalChanged &&
      existing.customerId &&
      existing.status === "completed"
    ) {
      // Revert old impact
      applyCustomerSaleImpact(db, existing, "revert");
      // Apply new impact with updated total (keep original amountReceived/changeGiven)
      applyCustomerSaleImpact(
        db,
        {
          customerId: existing.customerId,
          total: newTotal,
          amountReceived: existing.amountReceived,
          changeGiven: existing.changeGiven,
        },
        "apply",
      );
    }

    db.prepare(
      `UPDATE sales
       SET receipt_number = ?,
           customer_name  = ?,
           subtotal       = ?,
           total          = ?,
           payment_method = ?,
           note           = ?
       WHERE id = ?`,
    ).run(
      newReceiptNumber,
      newCustomerName,
      newSubtotal,
      newTotal,
      newPaymentMethod,
      newNote,
      id,
    );
  });

  try {
    txn();
  } catch (error) {
    if (
      receiptChanged &&
      isUniqueConstraintErrorFor(error, "sales", "receipt_number")
    ) {
      throw new Error(
        `Receipt number "${newReceiptNumber}" already exists. Please use another number.`,
      );
    }
    throw error;
  }

  return getSaleById(id);
}

export function updateSaleStatus(
  id: string,
  status: Sale["status"],
): Sale | null {
  const db = getDb();
  const existing = getSaleById(id);
  if (!existing) return null;
  const targetStatus =
    status === "completed" || status === "voided" || status === "refunded"
      ? status
      : existing.status;

  if (existing.status === targetStatus) {
    return existing;
  }

  const wasCompleted = existing.status === "completed";
  const willBeCompleted = targetStatus === "completed";
  const movingToVoided = targetStatus === "voided";
  const movingFromVoided = existing.status === "voided";

  const txn = db.transaction(() => {
    if (movingToVoided) {
      const approvedReturnsCount = (
        db
          .prepare(
            "SELECT COUNT(*) as count FROM returns WHERE sale_id = ? AND status = 'approved'",
          )
          .get(id) as { count: number }
      ).count;
      if (approvedReturnsCount > 0) {
        throw new Error(
          "Cannot void sale with approved returns. Use refunded status flow instead.",
        );
      }
    }

    db.prepare("UPDATE sales SET status = ? WHERE id = ?").run(
      targetStatus,
      id,
    );

    if (wasCompleted && movingToVoided) {
      for (const item of existing.items) {
        if (!item.productId) continue;
        incrementStock(item.productId, item.quantity);
      }
    } else if (movingFromVoided && willBeCompleted) {
      decrementStock(
        existing.items
          .filter((item) => !!item.productId)
          .map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        false,
      );
    }

    if (wasCompleted && !willBeCompleted) {
      applyCustomerSaleImpact(db, existing, "revert");
    } else if (!wasCompleted && willBeCompleted) {
      applyCustomerSaleImpact(db, existing, "apply");
    }
  });

  txn();
  return getSaleById(id);
}

export function refundSale(input: SaleRefundInput): SaleRefundResult {
  const db = getDb();
  const sale = getSaleById(input.saleId);

  if (!sale) {
    throw new Error("Sale not found.");
  }
  if (sale.status !== "completed") {
    throw new Error("Only completed sales can be refunded.");
  }
  if (sale.items.length === 0) {
    throw new Error("Sale has no items to refund.");
  }

  const processedById = input.processedById?.trim() ?? "";
  const processedByName = input.processedByName?.trim() ?? "";
  const reason = input.reason?.trim() || "SALE_REFUND";
  const createdReturnIds: string[] = [];

  const txn = db.transaction(() => {
    const approvedReturnsCount = (
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM returns WHERE sale_id = ? AND status = 'approved'",
        )
        .get(sale.id) as { count: number }
    ).count;
    if (approvedReturnsCount > 0) {
      throw new Error("Sale already has approved returns.");
    }

    const insertReturn = db.prepare(`
      INSERT INTO returns (id, return_number, sale_id, product_id, product_name, quantity, refund_amount, reason, status, processed_by_id, processed_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, datetime('now','localtime'))
    `);

    const usedReturnNumbers = new Set<string>();

    for (const item of sale.items) {
      if (!item.productId) {
        throw new Error(`Sale item "${item.productName}" has no product id.`);
      }

      const returnId = crypto.randomUUID();
      const returnNumber = getUniqueReturnNumber(db, usedReturnNumbers);

      insertReturn.run(
        returnId,
        returnNumber,
        sale.id,
        item.productId,
        item.productName,
        item.quantity,
        clampMoney(item.subtotal),
        reason,
        processedById,
        processedByName,
      );

      incrementStock(item.productId, item.quantity);
      createdReturnIds.push(returnId);
    }

    db.prepare("UPDATE sales SET status = 'refunded' WHERE id = ?").run(
      sale.id,
    );
    applyCustomerSaleImpact(db, sale, "revert");
  });

  txn();

  const refundedSale = getSaleById(sale.id);
  if (!refundedSale) {
    throw new Error("Refund completed but reloading sale failed.");
  }

  if (createdReturnIds.length === 0) {
    return { sale: refundedSale, returns: [] };
  }

  const placeholders = createdReturnIds.map(() => "?").join(", ");
  const returnRows = db
    .prepare(`SELECT * FROM returns WHERE id IN (${placeholders})`)
    .all(...createdReturnIds) as Record<string, unknown>[];

  const createdReturns: Return[] = returnRows.map((row) => ({
    id: row.id as string,
    returnNumber: row.return_number as string,
    saleId: (row.sale_id as string) || null,
    productId: row.product_id as string,
    productName: row.product_name as string,
    quantity: row.quantity as number,
    refundAmount: row.refund_amount as number,
    reason: row.reason as string,
    status: row.status as Return["status"],
    processedById: row.processed_by_id as string,
    processedBy: row.processed_by as string,
    createdAt: row.created_at as string,
  }));

  return { sale: refundedSale, returns: createdReturns };
}

export function deleteSale(id: string): boolean {
  const db = getDb();
  const existing = getSaleById(id);
  if (!existing) return false;

  const linkedApprovedReturns = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM returns WHERE sale_id = ? AND status = 'approved'",
      )
      .get(id) as { count: number }
  ).count;

  if (linkedApprovedReturns > 0) {
    throw new Error(
      "Cannot delete sale with approved returns. Remove related returns first.",
    );
  }

  const txn = db.transaction(() => {
    if (existing.status === "completed" && existing.items.length > 0) {
      for (const item of existing.items) {
        if (!item.productId) continue;
        incrementStock(item.productId, item.quantity);
      }
      applyCustomerSaleImpact(db, existing, "revert");
    }

    return db.prepare("DELETE FROM sales WHERE id = ?").run(id).changes > 0;
  });

  return txn();
}

export function deleteAllSales(): number {
  const db = getDb();

  const linkedReturnsCount = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM returns WHERE sale_id IS NOT NULL AND status IN ('approved', 'pending')",
      )
      .get() as { count: number }
  ).count;

  if (linkedReturnsCount > 0) {
    throw new Error(
      "لا يمكن حذف جميع المبيعات أثناء وجود مرتجعات معتمدة أو معلقة. احذف المرتجعات أولًا.",
    );
  }

  const txn = db.transaction(() => {
    const completedSales = db
      .prepare("SELECT * FROM sales WHERE status = 'completed'")
      .all() as Record<string, unknown>[];

    const saleIds = completedSales.map((row) => row.id as string);
    const saleItemsBySaleId = getSaleItemsBySaleIds(saleIds);

    for (const row of completedSales) {
      const sale = rowToSale(row);
      const items = saleItemsBySaleId.get(sale.id) ?? [];

      for (const item of items) {
        if (!item.productId) continue;
        incrementStock(item.productId, item.quantity);
      }

      applyCustomerSaleImpact(db, sale, "revert");
    }

    db.prepare("DELETE FROM sale_items").run();
    const result = db.prepare("DELETE FROM sales").run();
    return result.changes;
  });
  return txn();
}
