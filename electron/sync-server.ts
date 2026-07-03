/**
 * Monitor Sync Server
 *
 * A lightweight Express HTTP server that exposes the local SQLite data as a
 * read-only REST API for the owner's monitor web dashboard.
 *
 * - Binds only to 127.0.0.1 (localhost) — never reachable from the internet.
 * - Reuses the exact same service layer the Electron renderer uses via IPC.
 * - Must be started AFTER initDatabase() has been called.
 * - Automatically stops when the Electron app quits.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import type { Server } from "http";

import * as salesService from "./services/sales.service";
import * as returnsService from "./services/returns.service";
import * as treasuryService from "./services/treasury.service";
import * as reportsService from "./services/reports.service";
import * as customersService from "./services/customers.service";
import { getDb } from "./database/connection";

const SYNC_PORT = process.env.MONITOR_SYNC_PORT
  ? parseInt(process.env.MONITOR_SYNC_PORT, 10)
  : 3001;

let httpServer: Server | null = null;

// ============================================================================
// Helpers
// ============================================================================

function num(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function str(val: unknown): string | undefined {
  return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ success: false, error: message });
}

// ============================================================================
// Route builders
// ============================================================================

function buildApp(): express.Application {
  const app = express();

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json());

  // Simple request logger
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[sync] ${req.method} ${req.path}`);
    next();
  });

  // ------------------------------------------------------------------
  // GET /api/overview/summary
  // ------------------------------------------------------------------
  app.get("/api/overview/summary", (_req: Request, res: Response) => {
    try {
      const db = getDb();
      const today = new Date().toISOString().slice(0, 10);

      const todaySalesRow = db
        .prepare(
          `SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as rev
           FROM sales
           WHERE status='completed' AND date(created_at)=date('now','localtime')`
        )
        .get() as { cnt: number; rev: number };

      const todayReturnsRow = db
        .prepare(
          `SELECT COUNT(*) as cnt FROM returns
           WHERE status='approved' AND date(created_at)=date('now','localtime')`
        )
        .get() as { cnt: number };

      const totalProductsRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM products WHERE is_active=1`)
        .get() as { cnt: number };

      const lowStockRow = db
        .prepare(
          `SELECT COUNT(*) as cnt FROM products WHERE is_active=1 AND stock<=min_stock`
        )
        .get() as { cnt: number };

      const totalCustomersRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM customers`)
        .get() as { cnt: number };

      res.json({
        todaySales: todaySalesRow.cnt,
        todayRevenue: todaySalesRow.rev,
        todayReturns: todayReturnsRow.cnt,
        totalProducts: totalProductsRow.cnt,
        lowStockProducts: lowStockRow.cnt,
        totalCustomers: totalCustomersRow.cnt,
        _date: today,
      });
    } catch (err) {
      console.error("[sync] overview error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/sales
  // ------------------------------------------------------------------
  app.get("/api/sales", (req: Request, res: Response) => {
    try {
      const page = num(req.query.page, 1);
      const pageSize = num(req.query.pageSize, 20);
      const result = salesService.listSalesPaged({
        page,
        pageSize,
        search: str(req.query.search),
        fromDate: str(req.query.fromDate),
        toDate: str(req.query.toDate),
        statuses: req.query.statuses
          ? ([] as string[]).concat(req.query.statuses as string | string[]).filter(Boolean) as any
          : undefined,
        includeItems: true,
      });
      res.json(result);
    } catch (err) {
      console.error("[sync] sales list error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/sales/:id
  // ------------------------------------------------------------------
  app.get("/api/sales/:id", (req: Request, res: Response) => {
    try {
      const sale = salesService.getSaleById(req.params.id);
      if (!sale) return sendError(res, 404, "Sale not found");
      res.json(sale);
    } catch (err) {
      console.error("[sync] sales detail error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/returns
  // ------------------------------------------------------------------
  app.get("/api/returns", (req: Request, res: Response) => {
    try {
      const page = num(req.query.page, 1);
      const pageSize = num(req.query.pageSize, 20);
      const result = returnsService.listReturnsPaged({
        page,
        pageSize,
        search: str(req.query.search),
        fromDate: str(req.query.fromDate),
        toDate: str(req.query.toDate),
        statuses: req.query.statuses
          ? ([] as string[]).concat(req.query.statuses as string | string[]).filter(Boolean) as any
          : undefined,
      });
      res.json(result);
    } catch (err) {
      console.error("[sync] returns list error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/returns/:id
  // ------------------------------------------------------------------
  app.get("/api/returns/:id", (req: Request, res: Response) => {
    try {
      const ret = returnsService.getReturnById(req.params.id);
      if (!ret) return sendError(res, 404, "Return not found");
      res.json(ret);
    } catch (err) {
      console.error("[sync] returns detail error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/treasury/summary
  // ------------------------------------------------------------------
  app.get("/api/treasury/summary", (_req: Request, res: Response) => {
    try {
      const summary = treasuryService.getTreasurySummary();
      res.json(summary);
    } catch (err) {
      console.error("[sync] treasury summary error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/shifts  — all shifts across all users, newest first
  // ------------------------------------------------------------------
  app.get("/api/shifts", (req: Request, res: Response) => {
    try {
      const db = getDb();
      const page = num(req.query.page, 1);
      const pageSize = num(req.query.pageSize, 20);
      const offset = (page - 1) * pageSize;

      const clauses: string[] = [];
      const params: unknown[] = [];

      const search = str(req.query.search);
      if (search) {
        clauses.push("(user_name LIKE ?)");
        params.push(`%${search}%`);
      }

      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const totalRow = db
        .prepare(`SELECT COUNT(*) as cnt FROM user_shifts ${where}`)
        .get(...params) as { cnt: number };
      const total = totalRow.cnt;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      type ShiftRow = {
        id: string;
        user_id: string;
        user_name: string;
        user_role: string;
        login_at: string;
        logout_at: string | null;
        start_cash: number;
        end_cash: number | null;
        total_sales: number;
        total_returns: number;
        total_expenses: number;
        total_withdrawals: number;
        operations_count: number;
      };

      const rows = db
        .prepare(
          `SELECT * FROM user_shifts ${where}
           ORDER BY login_at DESC LIMIT ? OFFSET ?`
        )
        .all(...params, pageSize, offset) as ShiftRow[];

      const items = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        userRole: r.user_role,
        loginAt: r.login_at,
        logoutAt: r.logout_at ?? null,
        startCash: r.start_cash,
        endCash: r.end_cash ?? null,
        status: r.logout_at ? "closed" : "open",
        metrics: {
          totalSales: r.total_sales,
          totalReturns: r.total_returns,
          totalExpenses: r.total_expenses,
          totalWithdrawals: r.total_withdrawals,
          operationCount: r.operations_count,
          netCash:
            r.total_sales -
            r.total_returns -
            r.total_expenses -
            r.total_withdrawals,
        },
      }));

      res.json({ items, total, page, pageSize, totalPages });
    } catch (err) {
      console.error("[sync] shifts list error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/reports/summary
  // ------------------------------------------------------------------
  app.get("/api/reports/summary", (req: Request, res: Response) => {
    try {
      const summary = reportsService.getReportsSummary({
        fromDate: str(req.query.fromDate),
        toDate: str(req.query.toDate),
        topProductsLimit: req.query.topProductsLimit
          ? num(req.query.topProductsLimit, 10)
          : undefined,
      });
      res.json(summary);
    } catch (err) {
      console.error("[sync] reports summary error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/customers
  // ------------------------------------------------------------------
  app.get("/api/customers", (req: Request, res: Response) => {
    try {
      const page = num(req.query.page, 1);
      const pageSize = num(req.query.pageSize, 20);
      const result = customersService.listCustomersPaged({
        page,
        pageSize,
        search: str(req.query.search),
      });
      res.json(result);
    } catch (err) {
      console.error("[sync] customers list error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // GET /api/customers/:id
  // ------------------------------------------------------------------
  app.get("/api/customers/:id", (req: Request, res: Response) => {
    try {
      const customer = customersService.getCustomerById(req.params.id);
      if (!customer) return sendError(res, 404, "Customer not found");
      res.json(customer);
    } catch (err) {
      console.error("[sync] customers detail error:", err);
      sendError(res, 500, "Internal server error");
    }
  });

  // ------------------------------------------------------------------
  // Health check
  // ------------------------------------------------------------------
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  // ------------------------------------------------------------------
  // 404 fallback
  // ------------------------------------------------------------------
  app.use((_req: Request, res: Response) => {
    sendError(res, 404, "Not found");
  });

  return app;
}

// ============================================================================
// Public API
// ============================================================================

export function startSyncServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (httpServer) {
      resolve();
      return;
    }

    const app = buildApp();

    httpServer = app
      .listen(SYNC_PORT, "127.0.0.1", () => {
        console.log(
          `[sync] Monitor sync server running → http://127.0.0.1:${SYNC_PORT}/api`
        );
        resolve();
      })
      .on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.warn(
            `[sync] Port ${SYNC_PORT} already in use — sync server not started.`
          );
          resolve();
        } else {
          reject(err);
        }
      });
  });
}

export function stopSyncServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }
    httpServer.close(() => {
      httpServer = null;
      console.log("[sync] Monitor sync server stopped.");
      resolve();
    });
  });
}
