"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReportsNetRevenue = getReportsNetRevenue;
exports.getReportsSummary = getReportsSummary;
const database_1 = require("../database");
const DEFAULT_TOP_PRODUCTS_LIMIT = 25;
const DEFAULT_LOW_STOCK_LIMIT = 25;
const DEFAULT_DEBT_CUSTOMERS_LIMIT = 25;
const DEFAULT_DAILY_ROWS_LIMIT = 31;
const REPORTS_RETENTION_DAYS = 30;
function clampLimit(value, fallback) {
    if (!Number.isFinite(value) || !value)
        return fallback;
    return Math.min(200, Math.max(1, Math.trunc(value)));
}
function roundMoney(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function normalizeSqlDateBoundary(value, boundary) {
    const trimmed = value?.trim();
    if (!trimmed)
        return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return `${trimmed} ${boundary === "start" ? "00:00:00" : "23:59:59"}`;
    }
    return trimmed.replace("T", " ").slice(0, 19);
}
function buildDateRangeClause(columnName, query, params) {
    const clauses = [
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
function getReportsNetRevenue(query = {}) {
    const db = (0, database_1.getDb)();
    const salesDateParams = [];
    const salesDateClause = buildDateRangeClause("created_at", query, salesDateParams);
    const returnsDateParams = [];
    const returnsDateClause = buildDateRangeClause("created_at", query, returnsDateParams);
    const grossSales = roundMoney(db
        .prepare(`
          SELECT COALESCE(SUM(total), 0) AS gross_sales
          FROM sales
          WHERE status <> 'voided'
          ${salesDateClause}
        `)
        .get(...salesDateParams).gross_sales);
    const totalRefunds = roundMoney(db
        .prepare(`
          SELECT COALESCE(SUM(refund_amount), 0) AS total_refunds
          FROM returns
          WHERE status = 'approved'
          ${returnsDateClause}
        `)
        .get(...returnsDateParams).total_refunds);
    return {
        grossSales,
        totalRefunds,
        netRevenue: roundMoney(grossSales - totalRefunds),
    };
}
function getReportsSummary(query = {}) {
    const db = (0, database_1.getDb)();
    const topProductsLimit = clampLimit(query.topProductsLimit, DEFAULT_TOP_PRODUCTS_LIMIT);
    const lowStockLimit = clampLimit(query.lowStockLimit, DEFAULT_LOW_STOCK_LIMIT);
    const debtCustomersLimit = clampLimit(query.debtCustomersLimit, DEFAULT_DEBT_CUSTOMERS_LIMIT);
    const dailyRowsLimit = clampLimit(query.dailyRowsLimit, DEFAULT_DAILY_ROWS_LIMIT);
    const salesDateParams = [];
    const salesDateClause = buildDateRangeClause("s.created_at", query, salesDateParams);
    const salesDateParamsNoAlias = [];
    const salesDateClauseNoAlias = buildDateRangeClause("created_at", query, salesDateParamsNoAlias);
    const returnsDateParams = [];
    const returnsDateClause = buildDateRangeClause("r.created_at", query, returnsDateParams);
    const returnsDateParamsNoAlias = [];
    const returnsDateClauseNoAlias = buildDateRangeClause("created_at", query, returnsDateParamsNoAlias);
    const salesAgg = db
        .prepare(`
      SELECT
        COALESCE(SUM(total), 0) AS gross_sales,
        COUNT(*) AS total_orders
      FROM sales
      WHERE status <> 'voided'
      ${salesDateClauseNoAlias}
    `)
        .get(...salesDateParamsNoAlias);
    const soldUnitsAgg = db
        .prepare(`
      SELECT COALESCE(SUM(si.quantity), 0) AS sold_units
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status <> 'voided'
      ${salesDateClause}
    `)
        .get(...salesDateParams);
    const returnsAgg = db
        .prepare(`
      SELECT COALESCE(SUM(refund_amount), 0) AS total_refunds
      FROM returns
      WHERE status = 'approved'
      ${returnsDateClauseNoAlias}
    `)
        .get(...returnsDateParamsNoAlias);
    const inventoryAgg = db
        .prepare(`
      SELECT
        COALESCE(SUM(stock), 0) AS inventory_units,
        COALESCE(SUM(stock * price), 0) AS inventory_value
      FROM products
    `)
        .get();
    const debtRows = db
        .prepare(`
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
    `)
        .all(debtCustomersLimit);
    const debtCustomers = debtRows.map((row) => ({
        id: row.id,
        name: row.name || "عميل بدون اسم",
        phone: row.phone || "-",
        totalPurchases: row.total_purchases,
        totalSpent: roundMoney(row.total_spent),
        debt: roundMoney(row.debt),
        debtRatio: row.total_spent > 0 ? roundMoney((row.debt / row.total_spent) * 100) : 0,
    }));
    const totalCustomerDebt = roundMoney(db
        .prepare("SELECT COALESCE(SUM(debt), 0) AS total_debt FROM customers")
        .get().total_debt);
    const debtCustomersCount = db.prepare("SELECT COUNT(*) AS count FROM customers WHERE debt > 0").get().count;
    const lowStockRows = db
        .prepare(`
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
    `)
        .all(lowStockLimit);
    const lowStockProducts = lowStockRows.map((row) => ({
        id: row.id,
        name: row.name,
        categoryName: row.category_name || "-",
        stock: row.stock,
        alertThreshold: row.alert_threshold,
        stockValue: roundMoney(row.stock * row.price),
    }));
    const salesProductRows = db
        .prepare(`
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
    `)
        .all(...salesDateParams);
    const returnsProductRows = db
        .prepare(`
      SELECT
        COALESCE(r.product_id, '') AS product_id,
        r.product_name AS product_name,
        COALESCE(SUM(r.quantity), 0) AS returned_qty,
        COALESCE(SUM(r.refund_amount), 0) AS refund_amount
      FROM returns r
      WHERE r.status = 'approved'
      ${returnsDateClause}
      GROUP BY COALESCE(r.product_id, ''), r.product_name
    `)
        .all(...returnsDateParams);
    const productCategoryRows = db
        .prepare(`
      SELECT p.id, COALESCE(c.name, '-') AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
    `)
        .all();
    const categoryByProductId = new Map(productCategoryRows.map((row) => [row.id, row.category_name || "-"]));
    const productSummaryMap = new Map();
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
        .prepare(`
      SELECT
        substr(created_at, 1, 10) AS date_key,
        COUNT(*) AS orders,
        COALESCE(SUM(total), 0) AS gross_sales
      FROM sales
      WHERE status <> 'voided'
      ${salesDateClauseNoAlias}
      GROUP BY substr(created_at, 1, 10)
    `)
        .all(...salesDateParamsNoAlias);
    const dailyUnitsRows = db
        .prepare(`
      SELECT
        substr(s.created_at, 1, 10) AS date_key,
        COALESCE(SUM(si.quantity), 0) AS units
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      WHERE s.status <> 'voided'
      ${salesDateClause}
      GROUP BY substr(s.created_at, 1, 10)
    `)
        .all(...salesDateParams);
    const dailyReturnsRows = db
        .prepare(`
      SELECT
        substr(created_at, 1, 10) AS date_key,
        COALESCE(SUM(refund_amount), 0) AS refunds
      FROM returns
      WHERE status = 'approved'
      ${returnsDateClauseNoAlias}
      GROUP BY substr(created_at, 1, 10)
    `)
        .all(...returnsDateParamsNoAlias);
    const dailyMap = new Map();
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
