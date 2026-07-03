/**
 * API Routes — Read-only endpoints for the monitor web app
 *
 * These mirror the local sync-server endpoints but read from PostgreSQL.
 * Every query is scoped to the authenticated tenant via req.tenantId.
 *
 * Authentication: requireMonitorAuth middleware resolves tenant from monitor_key.
 */

import { Router, type Request, type Response } from "express";
import { query, queryOne } from "../db/pool.js";
import { requireMonitorAuth, devBypassAuth } from "../middleware/auth.js";

export const apiRouter = Router();

// ---------------------------------------------------------------------------
// Auth — applies to all routes below, except /health which is defined first
// ---------------------------------------------------------------------------

// Dev bypass: in development mode, set tenant context without auth header
if (process.env.NODE_ENV === "development") {
  apiRouter.use(devBypassAuth);
}

// Public health endpoint (no auth)
apiRouter.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// All routes below require monitor authentication
apiRouter.use(requireMonitorAuth);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function num(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function str(val: unknown): string | undefined {
  return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ success: false, error: message });
}

/**
 * Returns a parameter index tracker for building parameterized queries.
 * Each call to next() returns the next $N index.
 */
function paramCounter(start = 1) {
  let i = start;
  return { next: () => `$${i++}`, value: () => i };
}

// ---------------------------------------------------------------------------
// GET /api/overview/summary
// ---------------------------------------------------------------------------
apiRouter.get("/overview/summary", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const [sales, returns, products, lowStock, customers] = await Promise.all([
      queryOne<{ cnt: string; rev: string }>(
        `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as rev
         FROM sales
         WHERE tenant_id = $1 AND status='completed'
           AND created_at >= CURRENT_DATE`,
        [t]
      ),
      queryOne<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM returns
         WHERE tenant_id = $1 AND status='approved'
           AND created_at >= CURRENT_DATE`,
        [t]
      ),
      queryOne<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM products
         WHERE tenant_id = $1 AND is_active = true`,
        [t]
      ),
      queryOne<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM products
         WHERE tenant_id = $1 AND is_active = true AND stock <= min_stock`,
        [t]
      ),
      queryOne<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM customers WHERE tenant_id = $1`,
        [t]
      ),
    ]);

    res.json({
      todaySales: Number(sales?.cnt ?? 0),
      todayRevenue: Number(sales?.rev ?? 0),
      todayReturns: Number(returns?.cnt ?? 0),
      totalProducts: Number(products?.cnt ?? 0),
      lowStockProducts: Number(lowStock?.cnt ?? 0),
      totalCustomers: Number(customers?.cnt ?? 0),
    });
  } catch (err) {
    console.error("[api] overview error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/sales
// ---------------------------------------------------------------------------
apiRouter.get("/sales", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const page = num(req.query.page, 1);
    const pageSize = num(req.query.pageSize, 20);
    const offset = (page - 1) * pageSize;
    const pc = paramCounter(2); // $1 = tenant_id

    const clauses: string[] = ["s.tenant_id = $1"];
    const params: unknown[] = [t];

    const search = str(req.query.search);
    if (search) {
      clauses.push(`(s.receipt_number ILIKE ${pc.next()} OR s.customer_name ILIKE ${pc.next()} OR s.cashier_name ILIKE ${pc.next()})`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (str(req.query.fromDate)) {
      clauses.push(`s.created_at >= ${pc.next()}::date`);
      params.push(str(req.query.fromDate));
    }
    if (str(req.query.toDate)) {
      clauses.push(`s.created_at < (${pc.next()}::date + interval '1 day')`);
      params.push(str(req.query.toDate));
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const totalRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM sales s ${where}`,
      params
    );
    const total = Number(totalRow?.cnt ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    params.push(pageSize, offset);
    const list = await query(
      `SELECT s.*,
        COALESCE(json_agg(
          json_build_object(
            'id', si.id, 'saleId', si.sale_id, 'productId', si.product_id,
            'productName', si.product_name, 'price', si.price,
            'quantity', si.quantity, 'discount', si.discount,
            'discountType', si.discount_type, 'subtotal', si.subtotal
          ) ORDER BY si.id
        ) FILTER (WHERE si.id IS NOT NULL), '[]') as items
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id AND si.tenant_id = s.tenant_id
       ${where}
       GROUP BY s.id, s.tenant_id
       ORDER BY s.created_at DESC
       LIMIT ${pc.next()} OFFSET ${pc.next()}`,
      params
    );

    res.json({ items: list, total, page, pageSize, totalPages });
  } catch (err) {
    console.error("[api] sales error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/sales/:id
// ---------------------------------------------------------------------------
apiRouter.get("/sales/:id", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const sale = await queryOne(
      `SELECT s.*,
        COALESCE(json_agg(
          json_build_object(
            'id', si.id, 'saleId', si.sale_id, 'productId', si.product_id,
            'productName', si.product_name, 'price', si.price,
            'quantity', si.quantity, 'discount', si.discount,
            'discountType', si.discount_type, 'subtotal', si.subtotal
          ) ORDER BY si.id
        ) FILTER (WHERE si.id IS NOT NULL), '[]') as items
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id AND si.tenant_id = s.tenant_id
       WHERE s.tenant_id = $1 AND s.id = $2
       GROUP BY s.id, s.tenant_id`,
      [t, req.params.id]
    );

    if (!sale) return sendError(res, 404, "Sale not found");
    res.json(sale);
  } catch (err) {
    console.error("[api] sale detail error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/returns
// ---------------------------------------------------------------------------
apiRouter.get("/returns", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const page = num(req.query.page, 1);
    const pageSize = num(req.query.pageSize, 20);
    const offset = (page - 1) * pageSize;
    const pc = paramCounter(2);

    const clauses: string[] = ["r.tenant_id = $1"];
    const params: unknown[] = [t];

    const search = str(req.query.search);
    if (search) {
      clauses.push(`(r.return_number ILIKE ${pc.next()} OR r.product_name ILIKE ${pc.next()})`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const totalRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM returns r ${where}`,
      params
    );
    const total = Number(totalRow?.cnt ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    params.push(pageSize, offset);
    const list = await query(
      `SELECT * FROM returns r ${where}
       ORDER BY created_at DESC LIMIT ${pc.next()} OFFSET ${pc.next()}`,
      params
    );

    res.json({ items: list, total, page, pageSize, totalPages });
  } catch (err) {
    console.error("[api] returns error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/returns/:id
// ---------------------------------------------------------------------------
apiRouter.get("/returns/:id", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const ret = await queryOne(
      `SELECT * FROM returns WHERE tenant_id = $1 AND id = $2`,
      [t, req.params.id]
    );
    if (!ret) return sendError(res, 404, "Return not found");
    res.json(ret);
  } catch (err) {
    console.error("[api] return detail error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/treasury/summary
// ---------------------------------------------------------------------------
apiRouter.get("/treasury/summary", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const [sales, returns, withdrawals, expenses] = await Promise.all([
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount),0) as total FROM treasury_operations
         WHERE tenant_id = $1 AND type='sale'`, [t]
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount),0) as total FROM treasury_operations
         WHERE tenant_id = $1 AND type='return'`, [t]
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount),0) as total FROM treasury_operations
         WHERE tenant_id = $1 AND type='withdraw'`, [t]
      ),
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount),0) as total FROM treasury_operations
         WHERE tenant_id = $1 AND type='expense'`, [t]
      ),
    ]);

    const ops = await query(
      `SELECT * FROM treasury_operations
       WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [t]
    );

    res.json({
      totalSales: Number(sales?.total ?? 0),
      totalReturns: Number(returns?.total ?? 0),
      totalWithdrawals: Number(withdrawals?.total ?? 0),
      totalExpenses: Number(expenses?.total ?? 0),
      currentCash:
        Number(sales?.total ?? 0) -
        Number(returns?.total ?? 0) -
        Number(withdrawals?.total ?? 0) -
        Number(expenses?.total ?? 0),
      operations: ops.map((op) => ({
        id: op.id,
        type: op.type,
        name: op.name,
        amount: Number(op.amount),
        user_id: op.user_id,
        user_name: op.user_name,
        date: op.date,
        source: op.source,
      })),
    });
  } catch (err) {
    console.error("[api] treasury error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/shifts
// ---------------------------------------------------------------------------
apiRouter.get("/shifts", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const page = num(req.query.page, 1);
    const pageSize = num(req.query.pageSize, 20);
    const offset = (page - 1) * pageSize;
    const pc = paramCounter(2);

    const clauses: string[] = ["tenant_id = $1"];
    const params: unknown[] = [t];

    const search = str(req.query.search);
    if (search) {
      clauses.push(`user_name ILIKE ${pc.next()}`);
      params.push(`%${search}%`);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const totalRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM user_shifts ${where}`,
      params
    );
    const total = Number(totalRow?.cnt ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    params.push(pageSize, offset);
    const shifts = await query(
      `SELECT * FROM user_shifts ${where}
       ORDER BY login_at DESC LIMIT ${pc.next()} OFFSET ${pc.next()}`,
      params
    );

    const items = shifts.map((s) => ({
      id: s.id,
      userId: s.user_id,
      userName: s.user_name,
      userRole: s.user_role,
      loginAt: s.login_at,
      logoutAt: s.logout_at ?? null,
      startCash: Number(s.start_cash),
      endCash: s.end_cash != null ? Number(s.end_cash) : null,
      status: s.logout_at ? "closed" : "open",
      metrics: {
        totalSales: Number(s.total_sales),
        totalReturns: Number(s.total_returns),
        totalExpenses: Number(s.total_expenses),
        totalWithdrawals: Number(s.total_withdrawals),
        operationCount: Number(s.operations_count),
        netCash:
          Number(s.total_sales) -
          Number(s.total_returns) -
          Number(s.total_expenses) -
          Number(s.total_withdrawals),
      },
    }));

    res.json({ items, total, page, pageSize, totalPages });
  } catch (err) {
    console.error("[api] shifts error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/shifts/open
// ---------------------------------------------------------------------------
apiRouter.get("/shifts/open", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const shifts = await query(
      `SELECT * FROM user_shifts
       WHERE tenant_id = $1 AND logout_at IS NULL
       ORDER BY login_at DESC`,
      [t]
    );
    res.json({ items: shifts });
  } catch (err) {
    console.error("[api] open shifts error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/shifts/:id
// ---------------------------------------------------------------------------
apiRouter.get("/shifts/:id", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const shift = await queryOne(
      `SELECT * FROM user_shifts WHERE tenant_id = $1 AND id = $2`,
      [t, req.params.id]
    );
    if (!shift) return sendError(res, 404, "Shift not found");
    res.json(shift);
  } catch (err) {
    console.error("[api] shift detail error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/reports/summary
// ---------------------------------------------------------------------------
apiRouter.get("/reports/summary", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const topLimit = num(req.query.topProductsLimit, 10);
    const pc = paramCounter(2);

    const clauses: string[] = ["s.tenant_id = $1", "s.status='completed'"];
    const params: unknown[] = [t];

    if (str(req.query.fromDate)) {
      clauses.push(`s.created_at >= ${pc.next()}::date`);
      params.push(str(req.query.fromDate));
    }
    if (str(req.query.toDate)) {
      clauses.push(`s.created_at < (${pc.next()}::date + interval '1 day')`);
      params.push(str(req.query.toDate));
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const [kpi, topProducts, dailyRows, inventoryKpi, debtKpi] = await Promise.all([
      queryOne<{ gross: string; refunds: string; net: string; orders: string; units: string }>(
        `SELECT COALESCE(SUM(s.total),0) as gross,
                0 as refunds,
                COALESCE(SUM(s.total),0) as net,
                COUNT(*) as orders,
                COALESCE(SUM(si.qty),0) as units
         FROM sales s
         LEFT JOIN (SELECT tenant_id, sale_id, SUM(quantity) as qty FROM sale_items GROUP BY tenant_id, sale_id) si
           ON si.sale_id = s.id AND si.tenant_id = s.tenant_id
         ${where}`,
        params
      ),
      query(
        `SELECT si.product_id as key, si.product_name as name,
                COALESCE(c.name, '') as category,
                SUM(si.quantity) as "soldQty",
                0 as "returnedQty",
                SUM(si.subtotal) as "salesAmount",
                0 as "refundAmount",
                SUM(si.subtotal) as "netRevenue"
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id AND s.tenant_id = si.tenant_id
         LEFT JOIN categories c ON c.id = (SELECT category_id FROM products WHERE id = si.product_id AND tenant_id = si.tenant_id LIMIT 1)
         ${where}
         GROUP BY si.product_id, si.product_name, c.name
         ORDER BY SUM(si.subtotal) DESC
         LIMIT ${pc.next()}`,
        [...params, topLimit]
      ),
      query(
        `SELECT DATE(s.created_at) as "dateKey",
                COUNT(*) as orders,
                0 as units,
                COALESCE(SUM(s.total),0) as "grossSales",
                0 as refunds,
                COALESCE(SUM(s.total),0) as "netRevenue"
         FROM sales s ${where}
         GROUP BY DATE(s.created_at)
         ORDER BY DATE(s.created_at) DESC
         LIMIT 30`,
        params
      ),
      queryOne<{ units: string; value: string }>(
        `SELECT COALESCE(SUM(stock),0) as units,
                COALESCE(SUM(stock * cost),0) as value
         FROM products
         WHERE tenant_id = $1 AND is_active = true`,
        [t]
      ),
      queryOne<{ total: string; count: string }>(
        `SELECT COALESCE(SUM(debt),0) as total,
                COUNT(*) as count
         FROM customers
         WHERE tenant_id = $1 AND debt > 0`,
        [t]
      ),
    ]);

    res.json({
      grossSales: Number(kpi?.gross ?? 0),
      totalRefunds: Number(kpi?.refunds ?? 0),
      netRevenue: Number(kpi?.net ?? 0),
      totalOrders: Number(kpi?.orders ?? 0),
      soldUnits: Number(kpi?.units ?? 0),
      inventoryUnits: Number(inventoryKpi?.units ?? 0),
      inventoryValue: Number(inventoryKpi?.value ?? 0),
      totalCustomerDebt: Number(debtKpi?.total ?? 0),
      debtCustomersCount: Number(debtKpi?.count ?? 0),
      topProducts: topProducts.map((p) => ({
        ...p,
        soldQty: Number(p.soldQty),
        salesAmount: Number(p.salesAmount),
        refundAmount: Number(p.refundAmount),
        netRevenue: Number(p.netRevenue),
        returnedQty: Number(p.returnedQty),
      })),
      dailyRows: dailyRows.map((d) => ({
        ...d,
        orders: Number(d.orders),
        units: Number(d.units),
        grossSales: Number(d.grossSales),
        refunds: Number(d.refunds),
        netRevenue: Number(d.netRevenue),
      })),
    });
  } catch (err) {
    console.error("[api] reports error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/customers
// ---------------------------------------------------------------------------
apiRouter.get("/customers", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const page = num(req.query.page, 1);
    const pageSize = num(req.query.pageSize, 20);
    const offset = (page - 1) * pageSize;
    const pc = paramCounter(2);

    const clauses: string[] = ["tenant_id = $1"];
    const params: unknown[] = [t];

    const search = str(req.query.search);
    if (search) {
      clauses.push(`(name ILIKE ${pc.next()} OR phone ILIKE ${pc.next()})`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const totalRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM customers ${where}`,
      params
    );
    const total = Number(totalRow?.cnt ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    params.push(pageSize, offset);
    const rows = await query(
      `SELECT * FROM customers ${where}
       ORDER BY created_at DESC LIMIT ${pc.next()} OFFSET ${pc.next()}`,
      params
    );

    res.json({
      items: rows.map((c) => ({
        ...c,
        debt: Number(c.debt),
        totalPurchases: Number(c.total_purchases),
        totalSpent: Number(c.total_spent),
      })),
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (err) {
    console.error("[api] customers error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/customers/:id
// ---------------------------------------------------------------------------
apiRouter.get("/customers/:id", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const customer = await queryOne(
      `SELECT * FROM customers WHERE tenant_id = $1 AND id = $2`,
      [t, req.params.id]
    );
    if (!customer) return sendError(res, 404, "Customer not found");
    res.json({
      ...customer,
      debt: Number(customer.debt),
      totalPurchases: Number(customer.total_purchases),
      totalSpent: Number(customer.total_spent),
    });
  } catch (err) {
    console.error("[api] customer detail error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/inventory/summary
// ---------------------------------------------------------------------------
apiRouter.get("/inventory/summary", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const page = num(req.query.page, 1);
    const pageSize = num(req.query.pageSize, 50);
    const offset = (page - 1) * pageSize;
    const pc = paramCounter(2);

    const clauses: string[] = ["p.tenant_id = $1", "p.is_active = true"];
    const params: unknown[] = [t];

    const search = str(req.query.search);
    if (search) {
      clauses.push(`(p.name ILIKE ${pc.next()} OR p.barcode ILIKE ${pc.next()})`);
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const totalRow = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM products p ${where}`,
      params
    );
    const total = Number(totalRow?.cnt ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    params.push(pageSize, offset);
    const [rows, kpi] = await Promise.all([
      query(
        `SELECT p.id, p.name as "productName", p.barcode,
                COALESCE(c.name, '') as category,
                p.stock, p.min_stock as "minStock",
                p.price as "unitPrice", p.cost as "unitCost",
                (p.stock * p.cost) as "stockValue",
                (p.stock <= p.min_stock) as "isLowStock"
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
         ${where}
         ORDER BY p.name ASC
         LIMIT ${pc.next()} OFFSET ${pc.next()}`,
        params
      ),
      queryOne<{ total_products: string; total_units: string; inventory_value: string; low_stock_count: string }>(
        `SELECT COUNT(*) as total_products,
                COALESCE(SUM(stock),0) as total_units,
                COALESCE(SUM(stock * cost),0) as inventory_value,
                COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END),0) as low_stock_count
         FROM products
         WHERE tenant_id = $1 AND is_active = true`,
        [t]
      ),
    ]);

    res.json({
      totalProducts: Number(kpi?.total_products ?? 0),
      totalUnits: Number(kpi?.total_units ?? 0),
      inventoryValue: Number(kpi?.inventory_value ?? 0),
      lowStockCount: Number(kpi?.low_stock_count ?? 0),
      items: rows.map((r) => ({
        ...r,
        stock: Number(r.stock),
        minStock: Number(r.minStock),
        unitPrice: Number(r.unitPrice),
        unitCost: Number(r.unitCost),
        stockValue: Number(r.stockValue),
      })),
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (err) {
    console.error("[api] inventory error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/sync/status — sync health check
// ---------------------------------------------------------------------------
apiRouter.get("/sync/status", async (req: Request, res: Response) => {
  try {
    const t = req.tenantId;
    const meta = await queryOne<{ last_sync_at: string; pos_version: string; updated_at: string }>(
      `SELECT last_sync_at, pos_version, updated_at
       FROM sync_meta
       WHERE tenant_id = $1 AND id = 'default'`,
      [t]
    );
    res.json({
      connected: !!meta,
      lastSyncAt: meta?.last_sync_at ?? null,
      posVersion: meta?.pos_version ?? null,
    });
  } catch (err) {
    console.error("[api] sync status error:", err);
    sendError(res, 500, "Internal server error");
  }
});


