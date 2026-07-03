/**
 * Auth Middleware
 *
 * Authentication strategies:
 *   1. requireSyncAuth     — POS desktop clients (api_key)
 *   2. requireMonitorAuth  — Monitor dashboard clients (monitor_key)
 *   3. requireAdminAuth    — SaaS admin panel (JWT)
 *   4. requireTenantAuth   — Tenant dashboard users (JWT)
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { queryOne } from "../db/pool.js";
import { setTenantContext } from "../db/pool.js";
import { JWT_SECRET } from "../config.js";

// ---------------------------------------------------------------------------
// Type augmentation — attach tenant info to every authenticated request
// ---------------------------------------------------------------------------

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain: string;
  config: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      tenant: TenantInfo;
      adminUser?: { id: string; email: string; role: string };
      tenantUser?: { id: string; tenantId: string; email: string; role: string };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MISSING_AUTH = "Missing authorization token";
const INVALID_TOKEN = "Invalid or expired API key";
const TENANT_INACTIVE = "Tenant account is inactive";

/**
 * Resolve a bearer token to a tenant by looking up the given column.
 * Sets req.tenantId and req.tenant on success; sends error response on failure.
 */
async function resolveTenant(
  req: Request,
  res: Response,
  tokenColumn: "api_key" | "monitor_key"
): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: MISSING_AUTH });
    return false;
  }

  const token = auth.slice(7).trim();
  if (!token) {
    res.status(401).json({ success: false, error: MISSING_AUTH });
    return false;
  }

  const row = await queryOne<{
    id: string;
    name: string;
    slug: string;
    domain: string;
    is_active: boolean;
    config: Record<string, unknown>;
  }>(
    `SELECT id, name, slug, domain, is_active, config
     FROM tenants
     WHERE ${tokenColumn} = $1`,
    [token]
  );

  if (!row) {
    res.status(403).json({ success: false, error: INVALID_TOKEN });
    return false;
  }

  if (!row.is_active) {
    res.status(403).json({ success: false, error: TENANT_INACTIVE });
    return false;
  }

  req.tenantId = row.id;
  req.tenant = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    domain: row.domain,
    config: row.config ?? {},
  };

  // Set RLS context so PostgreSQL row-level security enforces isolation
  await setTenantContext(req.tenantId);

  return true;
}

// ---------------------------------------------------------------------------
// Middleware: POS sync auth
// ---------------------------------------------------------------------------

/**
 * Authenticate POS desktop sync clients using their tenant api_key.
 * The POS sends: Authorization: Bearer <api_key>
 *
 * This middleware MUST be applied before the sync routes.
 */
export async function requireSyncAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Already authenticated (e.g. by devBypassAuth)
  if (req.tenantId) {
    return next();
  }

  const SYNC_SECRET = process.env.SYNC_SECRET || "";

  // Allow legacy shared-secret auth for backward compatibility during migration
  if (SYNC_SECRET) {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ") && auth.slice(7) === SYNC_SECRET) {
      const row = await queryOne<{ id: string; name: string; slug: string; domain: string; config: Record<string, unknown> }>(
        `SELECT id, name, slug, domain, '{}'::jsonb AS config FROM tenants ORDER BY created_at ASC LIMIT 1`
      );
      if (row) {
        req.tenantId = row.id;
        req.tenant = { id: row.id, name: row.name, slug: row.slug, domain: row.domain, config: {} };
        await setTenantContext(req.tenantId);
        next();
        return;
      }
    }
  }

  const ok = await resolveTenant(req, res, "api_key");
  if (ok) next();
}

// ---------------------------------------------------------------------------
// Middleware: Monitor dashboard auth
// ---------------------------------------------------------------------------

/**
 * Authenticate monitor dashboard clients.
 * Accepts either:
 *   - monitor_key (Authorization: Bearer <monitor_key>)
 *   - tenant JWT   (Authorization: Bearer <jwt> from POST /api/auth/login)
 *
 * If tenantId is already set (e.g. by devBypassAuth), skip auth.
 */
export async function requireMonitorAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.tenantId) {
    return next();
  }

  // First try: monitor_key lookup (silent — no response sent on failure)
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) {
      const row = await queryOne<{ id: string; name: string; slug: string; domain: string; is_active: boolean; config: Record<string, unknown> }>(
        `SELECT id, name, slug, domain, is_active, config FROM tenants WHERE monitor_key = $1`,
        [token]
      );
      if (row && row.is_active) {
        req.tenantId = row.id;
        req.tenant = { id: row.id, name: row.name, slug: row.slug, domain: row.domain, config: row.config ?? {} };
        await setTenantContext(req.tenantId);
        return next();
      }
    }
  }

  // Second try: tenant JWT (issued by POST /api/auth/login)
  const payload = verifyJwt(req, res);
  if (!payload) return;
  if (payload.type !== "tenant") {
    res.status(403).json({ success: false, error: "Tenant access required" });
    return;
  }

  req.tenantUser = {
    id: payload.sub,
    tenantId: payload.tenantId!,
    email: payload.email,
    role: payload.role,
  };
  req.tenantId = payload.tenantId!;
  await setTenantContext(req.tenantId);
  next();
}

// ---------------------------------------------------------------------------
// JWT Helpers
// ---------------------------------------------------------------------------

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type: "admin" | "tenant";
  tenantId?: string;
}

/**
 * Verify and decode a JWT from the Authorization header.
 */
function verifyJwt(req: Request, res: Response): JwtPayload | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Missing authorization token" });
    return null;
  }

  const token = auth.slice(7).trim();
  if (!token) {
    res.status(401).json({ success: false, error: "Missing authorization token" });
    return null;
  }

  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    res.status(403).json({ success: false, error: "Invalid or expired token" });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware: Admin JWT auth
// ---------------------------------------------------------------------------

/**
 * Require a valid admin JWT. Sets req.adminUser on success.
 */
export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const payload = verifyJwt(req, res);
  if (!payload) return;

  if (payload.type !== "admin") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return;
  }

  req.adminUser = { id: payload.sub, email: payload.email, role: payload.role };
  next();
}

// ---------------------------------------------------------------------------
// Middleware: Tenant dashboard JWT auth
// ---------------------------------------------------------------------------

/**
 * Require a valid tenant dashboard JWT. Sets req.tenantUser and req.tenantId on success.
 */
export async function requireTenantAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const payload = verifyJwt(req, res);
  if (!payload) return;

  if (payload.type !== "tenant") {
    res.status(403).json({ success: false, error: "Tenant access required" });
    return;
  }

  req.tenantUser = {
    id: payload.sub,
    tenantId: payload.tenantId!,
    email: payload.email,
    role: payload.role,
  };
  req.tenantId = payload.tenantId!;

  await setTenantContext(req.tenantId);
  next();
}

// ---------------------------------------------------------------------------
// Middleware: Development bypass
// ---------------------------------------------------------------------------

/**
 * Skip authentication in development mode.
 * Sets tenantId to the first available tenant.
 * Use ONLY when NODE_ENV=development.
 */
export async function devBypassAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (process.env.NODE_ENV === "development" && !req.headers.authorization) {
    const row = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM tenants ORDER BY created_at ASC LIMIT 1`
    );
    if (row) {
      req.tenantId = row.id;
      req.tenant = { id: row.id, name: row.name, slug: "", domain: "", config: {} };
      await setTenantContext(req.tenantId);
    }
  }
  next();
}
