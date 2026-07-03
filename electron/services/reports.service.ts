import { getDb } from "../database";
import type {
  ReportsDebtCustomerRow,
  ReportsLowStockRow,
  ReportsNetRevenuePayload,
  ReportsProductSummaryRow,
  ReportsQuery,
  ReportsSummaryPayload,
} from "../shared/types";

const DEFAULT_TOP_PRODUCTS_LIMIT = 25;
const DEFAULT_LOW_STOCK_LIMIT = 25;
const DEFAULT_DEBT_CUSTOMERS_LIMIT = 25;
const DEFAULT_DAILY_ROWS_LIMIT = 31;
const REPORTS_RETENTION_DAYS = 30;

function clampLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || !value) return fallback;
  return Math.min(200, Math.max(1, Math.trunc(value)));
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function buildDateRangeClause(
  columnName: string,
  query: ReportsQuery,
  params: unknown[],
): string {
  const clauses: string[] = [
    `${columnName} >= datetime('now','localtime', '-${REPORTS_RETENTION_DAYS} days')`,
    `${columnName} <= datetime('now','localtime')`,
  ];
  const fromDate = normalizeSqlDateBoundary(query.fromDate, "start");
  const toDate = normalizeSqlDateBoundary(query.toDate, "end");

  if (fromDate) {
    clauses.push(`${columnName} >= ?`);
    params.push(fromDate);
  }
  if (toDate) {
    clauses.push(`${columnName} <= ?`);
    params.push(toDate);
  }

  return ` AND ${clauses.join(" AND ")}`;
}

export function getReportsNetRevenue(
  query: ReportsQuery = {},
): ReportsNetRevenuePayload {
  const db = getDb();

  const salesDateParams: unknown[] = [];
  const salesDateClause = buildDateRangeClause(
    "created_at",
    query,
    salesDateParams,
  );
  const returnsDateParams: unknown[] = [];
  const returnsDateClause = buildDateRangeClause(
    "created_at",
    query,
    returnsDateParams,
  );

  const grossSales = roundMoney(
    (
      db
        .prepare(
          `
          SELECT COALESCE(SUM(total), 0) AS gross_sales
          FROM sales
          WHERE status <> 'voided'
          ${salesDateClause}
        `,
        )
        .get(...salesDateParams) as { gross_sales: number }
    ).gross_sales,
  );

  const totalRefunds = roundMoney(
    (
      db
        .prepare(
          `
          SELECT COALESCE(SUM(refund_amount), 0) AS total_refunds
          FROM returns
          WHERE status = 'approved'
          ${returnsDateClause}
        `,
        )
        .get(...returnsDateParams) as { total_refunds: number }
    ).total_refunds,
  );

  return {
    grossSales,
    totalRefunds,
    netRevenue: roundMoney(grossSales - totalRefunds),
  };
}

export function getReportsSummary(query: ReportsQuery = {}): ReportsSummaryPayload {
  const db = getDb();
  const topProductsLimit = clampLimit(
    query.topProductsLimit,
    DEFAULT_TOP_PRODUCTS_LIMIT,
  );
  const lowStockLimit = clampLimit(
    query.lowStockLimit,
    DEFAULT_LOW_STOCK_LIMIT,
  );
  const debtCustomersLimit = clampLimit(
    query.debtCustomersLimit,
    DEFAULT_DEBT_CUSTOMERS_LIMIT,
  );
  const dailyRowsLimit = clampLimit(query.dailyRowsLimit, DEFAULT_DAILY_ROWS_LIMIT);

  const salesDateParams: unknown[] = [];
  const salesDateClause = buildDateRangeClause(
    "s.created_at",
    query,
    salesDateParams,
  );
  const salesDateParamsNoAlias: unknown[] = [];
  const salesDateClauseNoAlias = buildDateRangeClause(
    "created_at",
    query,
    salesDateParamsNoAlias,
  );

  const returnsDateParams: unknown[] = [];
  const returnsDateClause = buildDateRangeClause(
    "r.created_at",
    query,
    returnsDateParams,
  );
  const returnsDateParamsNoAlias: unknown[] = [];
  const returnsDateClauseNoAlias = buildDateRangeClause(
    "created_at",
    query,
    returnsDateParamsNoAlias,
  );

  const salesAgg = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(total), 0) AS gross_sales,
        COUNT(*) AS total_orders
      FROM sales
      WHERE status <> 'voided'
      ${salesDateClauseNoAlias}
    `,
    )
    .get(...salesDateParamsNoAlias) as {
    gross_sales: number;
    total_orders: number;
  };

  const soldUnitsAgg = db
    .prepare(
      `
      SELECT COALESCE(SUM(si.quantity), 0) AS sold_units
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status <> 'voided'
      ${salesDateClause}
    `,
    )
    .get(...salesDateParams) as { sold_units: number };

  const returnsAgg = db
    .prepare(
      `
      SELECT COALESCE(SUM(refund_amount), 0) AS total_refunds
      FROM returns
      WHERE status = 'approved'
      ${returnsDateClauseNoAlias}
    `,
    )
    .get(...returnsDateParamsNoAlias) as { total_refunds: number };

  const inventoryAgg = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(stock), 0) AS inventory_units,
        COALESCE(SUM(stock * price), 0) AS inventory_value
      FROM products
    `,
    )
    .get() as { inventory_units: number; inventory_value: number };

  const debtRows = db
    .prepare(
      `
      SELECT
        id,
        name,
        phone,
        total_purchases,
        total_spent,
        debt
      FROM customers
      WHERE debt > 0
      ORDER BY debt DESC
      LIMIT ?
    `,
    )
    .all(debtCustomersLimit) as {
    id: string;
    name: string;
    phone: string;
    total_purchases: number;
    total_spent: number;
    debt: number;
  }[];

  const debtCustomers: ReportsDebtCustomerRow[] = debtRows.map((row) => ({
    id: row.id,
    name: row.name || "عميل بدون اسم",
    phone: row.phone || "-",
    totalPurchases: row.total_purchases,
    totalSpent: roundMoney(row.total_spent),
    debt: roundMoney(row.debt),
    debtRatio:
      row.total_spent > 0 ? roundMoney((row.debt / row.total_spent) * 100) : 0,
  }));

  const totalCustomerDebt = roundMoney(
    (
      db
        .prepare("SELECT COALESCE(SUM(debt), 0) AS total_debt FROM customers")
        .get() as { total_debt: number }
    ).total_debt,
  );
  const debtCustomersCount = (
    db.prepare("SELECT COUNT(*) AS count FROM customers WHERE debt > 0").get() as {
      count: number;
    }
  ).count;

  const lowStockRows = db
    .prepare(
      `
      SELECT
        p.id,
        p.name,
        p.stock,
        p.min_stock,
        p.price,
        COALESCE(c.name, '-') AS category_name,
        CASE WHEN p.min_stock > 0 THEN p.min_stock ELSE 5 END AS alert_threshold
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.stock <= CASE WHEN p.min_stock > 0 THEN p.min_stock ELSE 5 END
      ORDER BY p.stock ASC, p.updated_at DESC
      LIMIT ?
    `,
    )
    .all(lowStockLimit) as {
    id: string;
    name: string;
    stock: number;
    min_stock: number;
    price: number;
    category_name: string;
    alert_threshold: number;
  }[];

  const lowStockProducts: ReportsLowStockRow[] = lowStockRows.map((row) => ({
    id: row.id,
    name: row.name,
    categoryName: row.category_name || "-",
    stock: row.stock,
    alertThreshold: row.alert_threshold,
    stockValue: roundMoney(row.stock * row.price),
  }));

  const salesProductRows = db
    .prepare(
      `
      SELECT
        COALESCE(si.product_id, '') AS product_id,
        si.product_name AS product_name,
        COALESCE(SUM(si.quantity), 0) AS sold_qty,
        COALESCE(SUM(si.subtotal), 0) AS sales_amount
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status <> 'voided'
      ${salesDateClause}
      GROUP BY COALESCE(si.product_id, ''), si.product_name
    `,
    )
    .all(...salesDateParams) as {
    product_id: string;
    product_name: string;
    sold_qty: number;
    sales_amount: number;
  }[];

  const returnsProductRows = db
    .prepare(
      `
      SELECT
        COALESCE(r.product_id, '') AS product_id,
        r.product_name AS product_name,
        COALESCE(SUM(r.quantity), 0) AS returned_qty,
        COALESCE(SUM(r.refund_amount), 0) AS refund_amount
      FROM returns r
      WHERE r.status = 'approved'
      ${returnsDateClause}
      GROUP BY COALESCE(r.product_id, ''), r.product_name
    `,
    )
    .all(...returnsDateParams) as {
    product_id: string;
    product_name: string;
    returned_qty: number;
    refund_amount: number;
  }[];

  const productCategoryRows = db
    .prepare(
      `
      SELECT p.id, COALESCE(c.name, '-') AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
    `,
    )
    .all() as { id: string; category_name: string }[];
  const categoryByProductId = new Map<string, string>(
    productCategoryRows.map((row) => [row.id, row.category_name || "-"]),
  );

  const productSummaryMap = new Map<string, ReportsProductSummaryRow>();

  for (const row of salesProductRows) {
    const key = row.product_id || `name:${row.product_name.trim()}`;
    productSummaryMap.set(key, {
      key,
      name: row.product_name || "منتج غير معروف",
      category: row.product_id
        ? categoryByProductId.get(row.product_id) || "-"
        : "-",
      soldQty: row.sold_qty,
      returnedQty: 0,
      salesAmount: roundMoney(row.sales_amount),
      refundAmount: 0,
      netRevenue: roundMoney(row.sales_amount),
    });
  }

  for (const row of returnsProductRows) {
    const key = row.product_id || `name:${row.product_name.trim()}`;
    const existing = productSummaryMap.get(key);

    if (!existing) {
      productSummaryMap.set(key, {
        key,
        name: row.product_name || "منتج غير معروف",
        category: row.product_id
          ? categoryByProductId.get(row.product_id) || "-"
          : "-",
        soldQty: 0,
        returnedQty: row.returned_qty,
        salesAmount: 0,
        refundAmount: roundMoney(row.refund_amount),
        netRevenue: roundMoney(-row.refund_amount),
      });
      continue;
    }

    existing.returnedQty += row.returned_qty;
    existing.refundAmount = roundMoney(existing.refundAmount + row.refund_amount);
    existing.netRevenue = roundMoney(existing.salesAmount - existing.refundAmount);
  }

  const topProducts = Array.from(productSummaryMap.values())
    .sort((a, b) => b.netRevenue - a.netRevenue || b.soldQty - a.soldQty)
    .slice(0, topProductsLimit);

  const dailySalesRows = db
    .prepare(
      `
      SELECT
        substr(created_at, 1, 10) AS date_key,
        COUNT(*) AS orders,
        COALESCE(SUM(total), 0) AS gross_sales
      FROM sales
      WHERE status <> 'voided'
      ${salesDateClauseNoAlias}
      GROUP BY substr(created_at, 1, 10)
    `,
    )
    .all(...salesDateParamsNoAlias) as {
    date_key: string;
    orders: number;
    gross_sales: number;
  }[];

  const dailyUnitsRows = db
    .prepare(
      `
      SELECT
        substr(s.created_at, 1, 10) AS date_key,
        COALESCE(SUM(si.quantity), 0) AS units
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status <> 'voided'
      ${salesDateClause}
      GROUP BY substr(s.created_at, 1, 10)
    `,
    )
    .all(...salesDateParams) as { date_key: string; units: number }[];

  const dailyReturnsRows = db
    .prepare(
      `
      SELECT
        substr(created_at, 1, 10) AS date_key,
        COALESCE(SUM(refund_amount), 0) AS refunds
      FROM returns
      WHERE status = 'approved'
      ${returnsDateClauseNoAlias}
      GROUP BY substr(created_at, 1, 10)
    `,
    )
    .all(...returnsDateParamsNoAlias) as { date_key: string; refunds: number }[];

  const dailyMap = new Map<
    string,
    {
      dateKey: string;
      orders: number;
      units: number;
      grossSales: number;
      refunds: number;
      netRevenue: number;
    }
  >();

  for (const row of dailySalesRows) {
    dailyMap.set(row.date_key, {
      dateKey: row.date_key,
      orders: row.orders,
      units: 0,
      grossSales: roundMoney(row.gross_sales),
      refunds: 0,
      netRevenue: roundMoney(row.gross_sales),
    });
  }

  for (const row of dailyUnitsRows) {
    const existing = dailyMap.get(row.date_key);
    if (!existing) {
      dailyMap.set(row.date_key, {
        dateKey: row.date_key,
        orders: 0,
        units: row.units,
        grossSales: 0,
        refunds: 0,
        netRevenue: 0,
      });
      continue;
    }
    existing.units = row.units;
  }

  for (const row of dailyReturnsRows) {
    const existing = dailyMap.get(row.date_key);
    if (!existing) {
      dailyMap.set(row.date_key, {
        dateKey: row.date_key,
        orders: 0,
        units: 0,
        grossSales: 0,
        refunds: roundMoney(row.refunds),
        netRevenue: roundMoney(-row.refunds),
      });
      continue;
    }
    existing.refunds = roundMoney(row.refunds);
    existing.netRevenue = roundMoney(existing.grossSales - existing.refunds);
  }

  const dailyRows = Array.from(dailyMap.values())
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, dailyRowsLimit);

  const grossSales = roundMoney(salesAgg.gross_sales);
  const totalRefunds = roundMoney(returnsAgg.total_refunds);

  return {
    grossSales,
    totalRefunds,
    netRevenue: roundMoney(grossSales - totalRefunds),
    totalOrders: salesAgg.total_orders,
    soldUnits: soldUnitsAgg.sold_units,
    inventoryUnits: inventoryAgg.inventory_units,
    inventoryValue: roundMoney(inventoryAgg.inventory_value),
    totalCustomerDebt,
    debtCustomersCount,
    topProducts,
    lowStockProducts,
    debtCustomers,
    dailyRows,
  };
}
