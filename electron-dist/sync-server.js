"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSyncServer = startSyncServer;
exports.stopSyncServer = stopSyncServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const salesService = __importStar(require("./services/sales.service"));
const returnsService = __importStar(require("./services/returns.service"));
const treasuryService = __importStar(require("./services/treasury.service"));
const reportsService = __importStar(require("./services/reports.service"));
const customersService = __importStar(require("./services/customers.service"));
const connection_1 = require("./database/connection");
const SYNC_PORT = process.env.MONITOR_SYNC_PORT
    ? parseInt(process.env.MONITOR_SYNC_PORT, 10)
    : 3001;
let httpServer = null;
// ============================================================================
// Helpers
// ============================================================================
function num(val, fallback) {
    const n = Number(val);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
function str(val) {
    return typeof val === "string" && val.trim() ? val.trim() : undefined;
}
function sendError(res, status, message) {
    res.status(status).json({ success: false, error: message });
}
// ============================================================================
// Route builders
// ============================================================================
function buildApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: "*",
        methods: ["GET", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }));
    app.use(express_1.default.json());
    // Simple request logger
    app.use((req, _res, next) => {
        console.log(`[sync] ${req.method} ${req.path}`);
        next();
    });
    // ------------------------------------------------------------------
    // GET /api/overview/summary
    // ------------------------------------------------------------------
    app.get("/api/overview/summary", (_req, res) => {
        try {
            const db = (0, connection_1.getDb)();
            const today = new Date().toISOString().slice(0, 10);
            const todaySalesRow = db
                .prepare(`SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as rev
           FROM sales
           WHERE status='completed' AND date(created_at)=date('now','localtime')`)
                .get();
            const todayReturnsRow = db
                .prepare(`SELECT COUNT(*) as cnt FROM returns
           WHERE status='approved' AND date(created_at)=date('now','localtime')`)
                .get();
            const totalProductsRow = db
                .prepare(`SELECT COUNT(*) as cnt FROM products WHERE is_active=1`)
                .get();
            const lowStockRow = db
                .prepare(`SELECT COUNT(*) as cnt FROM products WHERE is_active=1 AND stock<=min_stock`)
                .get();
            const totalCustomersRow = db
                .prepare(`SELECT COUNT(*) as cnt FROM customers`)
                .get();
            res.json({
                todaySales: todaySalesRow.cnt,
                todayRevenue: todaySalesRow.rev,
                todayReturns: todayReturnsRow.cnt,
                totalProducts: totalProductsRow.cnt,
                lowStockProducts: lowStockRow.cnt,
                totalCustomers: totalCustomersRow.cnt,
                _date: today,
            });
        }
        catch (err) {
            console.error("[sync] overview error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/sales
    // ------------------------------------------------------------------
    app.get("/api/sales", (req, res) => {
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
                    ? [].concat(req.query.statuses).filter(Boolean)
                    : undefined,
                includeItems: true,
            });
            res.json(result);
        }
        catch (err) {
            console.error("[sync] sales list error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/sales/:id
    // ------------------------------------------------------------------
    app.get("/api/sales/:id", (req, res) => {
        try {
            const sale = salesService.getSaleById(req.params.id);
            if (!sale)
                return sendError(res, 404, "Sale not found");
            res.json(sale);
        }
        catch (err) {
            console.error("[sync] sales detail error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/returns
    // ------------------------------------------------------------------
    app.get("/api/returns", (req, res) => {
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
                    ? [].concat(req.query.statuses).filter(Boolean)
                    : undefined,
            });
            res.json(result);
        }
        catch (err) {
            console.error("[sync] returns list error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/returns/:id
    // ------------------------------------------------------------------
    app.get("/api/returns/:id", (req, res) => {
        try {
            const ret = returnsService.getReturnById(req.params.id);
            if (!ret)
                return sendError(res, 404, "Return not found");
            res.json(ret);
        }
        catch (err) {
            console.error("[sync] returns detail error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/treasury/summary
    // ------------------------------------------------------------------
    app.get("/api/treasury/summary", (_req, res) => {
        try {
            const summary = treasuryService.getTreasurySummary();
            res.json(summary);
        }
        catch (err) {
            console.error("[sync] treasury summary error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/shifts  — all shifts across all users, newest first
    // ------------------------------------------------------------------
    app.get("/api/shifts", (req, res) => {
        try {
            const db = (0, connection_1.getDb)();
            const page = num(req.query.page, 1);
            const pageSize = num(req.query.pageSize, 20);
            const offset = (page - 1) * pageSize;
            const clauses = [];
            const params = [];
            const search = str(req.query.search);
            if (search) {
                clauses.push("(user_name LIKE ?)");
                params.push(`%${search}%`);
            }
            const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
            const totalRow = db
                .prepare(`SELECT COUNT(*) as cnt FROM user_shifts ${where}`)
                .get(...params);
            const total = totalRow.cnt;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            const rows = db
                .prepare(`SELECT * FROM user_shifts ${where}
           ORDER BY login_at DESC LIMIT ? OFFSET ?`)
                .all(...params, pageSize, offset);
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
                    netCash: r.total_sales -
                        r.total_returns -
                        r.total_expenses -
                        r.total_withdrawals,
                },
            }));
            res.json({ items, total, page, pageSize, totalPages });
        }
        catch (err) {
            console.error("[sync] shifts list error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/reports/summary
    // ------------------------------------------------------------------
    app.get("/api/reports/summary", (req, res) => {
        try {
            const summary = reportsService.getReportsSummary({
                fromDate: str(req.query.fromDate),
                toDate: str(req.query.toDate),
                topProductsLimit: req.query.topProductsLimit
                    ? num(req.query.topProductsLimit, 10)
                    : undefined,
            });
            res.json(summary);
        }
        catch (err) {
            console.error("[sync] reports summary error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/customers
    // ------------------------------------------------------------------
    app.get("/api/customers", (req, res) => {
        try {
            const page = num(req.query.page, 1);
            const pageSize = num(req.query.pageSize, 20);
            const result = customersService.listCustomersPaged({
                page,
                pageSize,
                search: str(req.query.search),
            });
            res.json(result);
        }
        catch (err) {
            console.error("[sync] customers list error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // GET /api/customers/:id
    // ------------------------------------------------------------------
    app.get("/api/customers/:id", (req, res) => {
        try {
            const customer = customersService.getCustomerById(req.params.id);
            if (!customer)
                return sendError(res, 404, "Customer not found");
            res.json(customer);
        }
        catch (err) {
            console.error("[sync] customers detail error:", err);
            sendError(res, 500, "Internal server error");
        }
    });
    // ------------------------------------------------------------------
    // Health check
    // ------------------------------------------------------------------
    app.get("/api/health", (_req, res) => {
        res.json({ ok: true, ts: new Date().toISOString() });
    });
    // ------------------------------------------------------------------
    // 404 fallback
    // ------------------------------------------------------------------
    app.use((_req, res) => {
        sendError(res, 404, "Not found");
    });
    return app;
}
// ============================================================================
// Public API
// ============================================================================
function startSyncServer() {
    return new Promise((resolve, reject) => {
        if (httpServer) {
            resolve();
            return;
        }
        const app = buildApp();
        httpServer = app
            .listen(SYNC_PORT, "127.0.0.1", () => {
            console.log(`[sync] Monitor sync server running → http://127.0.0.1:${SYNC_PORT}/api`);
            resolve();
        })
            .on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.warn(`[sync] Port ${SYNC_PORT} already in use — sync server not started.`);
                resolve();
            }
            else {
                reject(err);
            }
        });
    });
}
function stopSyncServer() {
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
