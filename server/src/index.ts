/**
 * POS Cloud Server — Main Entry
 *
 * Express + Socket.io server for multi-tenant POS monitoring.
 *
 * Route hierarchy:
 *   GET  /api/health        → public, no auth
 *   GET  /api/*             → monitor auth (via apiRouter)
 *   POST /api/sync/batch    → sync auth (via syncRouter)
 *
 * Socket.io:
 *   Clients authenticate with ?token=<monitor_key>
 *   Each client joins room tenant:<tenantId> for scoped real-time events
 *
 * Database:
 *   RLS policies enforce tenant isolation at the PostgreSQL level
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

import { apiRouter } from "./routes/api.js";
import { createSyncRouter } from "./routes/sync.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { requireSyncAuth, requireAdminAuth } from "./middleware/auth.js";
import { queryOne } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "4000", 10);

function getAllowedOrigins(): string[] {
  const origins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : ["http://localhost:3000", "http://localhost:3001"];

  // Automatically allow the Railway-assigned frontend URL if present
  const railwayOrigin = process.env.RAILWAY_FRONTEND_URL;
  if (railwayOrigin && !origins.includes(railwayOrigin)) {
    origins.push(railwayOrigin);
  }

  return origins;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

const allowedOrigins = getAllowedOrigins();
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: "10mb" }));

app.use((req, _res, next) => {
  console.log(`[http] ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// HTTP + Socket.io server
// ---------------------------------------------------------------------------

const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
  serveClient: false,
});

/**
 * Socket.io authentication — resolves tenant from monitor_key query param.
 * On success, the socket joins the tenant's room for scoped events.
 */
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query.token as string | undefined;
    if (!token) {
      return next(new Error("Missing authentication token"));
    }

    const tenant = await queryOne<{ id: string; name: string; is_active: boolean }>(
      `SELECT id, name, is_active FROM tenants WHERE monitor_key = $1`,
      [token]
    );

    if (!tenant) {
      return next(new Error("Invalid authentication token"));
    }

    if (!tenant.is_active) {
      return next(new Error("Tenant account is inactive"));
    }

    (socket as any).tenantId = tenant.id;
    (socket as any).tenantName = tenant.name;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const tenantId = (socket as any).tenantId;
  const tenantName = (socket as any).tenantName;
  const room = `tenant:${tenantId}`;

  socket.join(room);
  console.log(
    `[socket] ${tenantName} (${tenantId}) connected: ${socket.id} → joined ${room}`
  );

  socket.on("disconnect", (reason) => {
    console.log(`[socket] ${tenantName} disconnected: ${socket.id} (${reason})`);
  });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Auth routes (public — used for login)
app.use("/api", authRouter);

// Admin routes (requires admin JWT)
app.use("/api/admin", requireAdminAuth, adminRouter);

// Sync endpoint (write) — requires POS sync auth (api_key)
// Auth is applied at the route level (only for POST /sync/batch)
const syncRouter = createSyncRouter(io);
app.use("/api", syncRouter);

// Read-only API for monitor dashboard — auth is handled inside apiRouter
// (apiRouter applies requireMonitorAuth to all routes except /health)
app.use("/api", apiRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not found" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  // Run database migrations before accepting connections
  await runMigrations();

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] POS Cloud Server running on port ${PORT}`);
    console.log(`[server]    API:  http://localhost:${PORT}/api/health`);
    console.log(`[server]    Sync: POST http://localhost:${PORT}/api/sync/batch`);
    console.log(`[server]    CORS: ${allowedOrigins.join(", ")}`);
    console.log(`[server]    Mode: ${process.env.NODE_ENV || "production"}`);
  });
}

start().catch((err) => {
  console.error("[server] Failed to start:", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("[server] SIGTERM received — shutting down...");
  httpServer.close(() => {
    io.close();
    process.exit(0);
  });
});
