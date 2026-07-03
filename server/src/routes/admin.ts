/**
 * Admin Routes — SaaS owner tenant management
 *
 * All routes require a valid admin JWT (requireAdminAuth middleware).
 *
 * POST   /api/admin/tenants          — Create a new tenant
 * GET    /api/admin/tenants          — List all tenants
 * GET    /api/admin/tenants/:id      — Get tenant details (shows api_key)
 * PATCH  /api/admin/tenants/:id      — Update tenant
 * DELETE /api/admin/tenants/:id      — Delete tenant (GDPR)
 * POST   /api/admin/tenants/:id/toggle — Suspend/activate tenant
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { query, queryOne, raw, setTenantContext } from "../db/pool.js";

export const adminRouter = Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
  adminName: z.string().min(1).max(200),
  maxStores: z.number().int().min(1).max(100).default(1),
  maxUsers: z.number().int().min(1).max(100).default(5),
});

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  domain: z.string().max(200).optional(),
  maxStores: z.number().int().min(1).max(100).optional(),
  maxUsers: z.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendError(res: Response, status: number, error: string) {
  res.status(status).json({ success: false, error });
}

// ---------------------------------------------------------------------------
// POST /api/admin/tenants
// ---------------------------------------------------------------------------
adminRouter.post("/tenants", async (req: Request, res: Response) => {
  try {
    const parsed = CreateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { name, slug, adminEmail, adminPassword, adminName, maxStores, maxUsers } = parsed.data;

    // Check slug uniqueness
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM tenants WHERE slug = $1", [slug]
    );
    if (existing) {
      sendError(res, 409, "A tenant with this slug already exists");
      return;
    }

    const tenantId = `tenant_${uuidv4()}`;
    const apiKey = uuidv4();
    const monitorKey = uuidv4();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const client = await raw("BEGIN");

    try {
      // Create tenant
      await raw(
        `INSERT INTO tenants (id, name, slug, api_key, monitor_key, max_stores, max_users)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, name, slug, apiKey, monitorKey, maxStores, maxUsers]
      );

      // Create admin user for this tenant
      const userId = uuidv4();
      await raw(
        `INSERT INTO tenant_users (id, tenant_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, $5, 'owner')`,
        [userId, tenantId, adminEmail, passwordHash, adminName]
      );

      await raw("COMMIT");

      console.log(`[admin] Created tenant: ${name} (${tenantId})`);

      res.status(201).json({
        success: true,
        tenant: {
          id: tenantId,
          name,
          slug,
          apiKey,
          monitorKey,
          domain: "",
          isActive: true,
          maxStores,
          maxUsers,
          adminUser: { id: userId, email: adminEmail, name: adminName },
        },
      });
    } catch (err) {
      await raw("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error("[admin] Create tenant error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/tenants
// ---------------------------------------------------------------------------
adminRouter.get("/tenants", async (_req: Request, res: Response) => {
  try {
    const rows = await query<{
      id: string; name: string; slug: string; domain: string;
      is_active: boolean; max_stores: number; max_users: number;
      created_at: string; updated_at: string;
    }>(
      `SELECT id, name, slug, domain, is_active,
              max_stores, max_users, created_at, updated_at
       FROM tenants ORDER BY created_at DESC`
    );

    // Get user count per tenant
    const userCounts = await query<{ tenant_id: string; count: number }>(
      `SELECT tenant_id, COUNT(*)::int as count
       FROM tenant_users GROUP BY tenant_id`
    );
    const countMap: Record<string, number> = {};
    for (const uc of userCounts) countMap[uc.tenant_id] = uc.count;

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      domain: r.domain,
      isActive: r.is_active,
      maxStores: r.max_stores,
      maxUsers: r.max_users,
      userCount: countMap[r.id] ?? 0,
      createdAt: r.created_at,
    }));

    res.json({ success: true, items });
  } catch (err) {
    console.error("[admin] List tenants error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/tenants/:id
// ---------------------------------------------------------------------------
adminRouter.get("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const tenant = await queryOne<{
      id: string; name: string; slug: string; domain: string;
      api_key: string; monitor_key: string;
      is_active: boolean; max_stores: number; max_users: number;
      created_at: string; updated_at: string;
    }>(
      `SELECT * FROM tenants WHERE id = $1`, [req.params.id]
    );

    if (!tenant) {
      sendError(res, 404, "Tenant not found");
      return;
    }

    const users = await query<{
      id: string; email: string; name: string; role: string;
      is_active: boolean; created_at: string;
    }>(
      `SELECT id, email, name, role, is_active, created_at
       FROM tenant_users WHERE tenant_id = $1 ORDER BY created_at`,
      [req.params.id]
    );

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        hasApiKey: !!tenant.api_key,
        hasMonitorKey: !!tenant.monitor_key,
        isActive: tenant.is_active,
        maxStores: tenant.max_stores,
        maxUsers: tenant.max_users,
        createdAt: tenant.created_at,
      },
      users,
    });
  } catch (err) {
    console.error("[admin] Get tenant error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/tenants/:id
// ---------------------------------------------------------------------------
adminRouter.patch("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const parsed = UpdateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        const col = key === "maxStores" ? "max_stores" : key === "maxUsers" ? "max_users" : key;
        sets.push(`${col} = $${idx++}`);
        params.push(value);
      }
    }

    if (sets.length === 0) {
      sendError(res, 400, "No fields to update");
      return;
    }

    sets.push(`updated_at = now()`);
    params.push(req.params.id);

    await raw(
      `UPDATE tenants SET ${sets.join(", ")} WHERE id = $${idx}`,
      params
    );

    res.json({ success: true });
  } catch (err) {
    console.error("[admin] Update tenant error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/tenants/:id/toggle
// ---------------------------------------------------------------------------
adminRouter.post("/tenants/:id/toggle", async (req: Request, res: Response) => {
  try {
    const tenant = await queryOne<{ id: string; is_active: boolean }>(
      `SELECT id, is_active FROM tenants WHERE id = $1`, [req.params.id]
    );
    if (!tenant) {
      sendError(res, 404, "Tenant not found");
      return;
    }

    const newState = !tenant.is_active;
    await raw(
      `UPDATE tenants SET is_active = $1, updated_at = now() WHERE id = $2`,
      [newState, req.params.id]
    );

    res.json({
      success: true,
      isActive: newState,
      message: newState ? "Tenant activated" : "Tenant suspended",
    });
  } catch (err) {
    console.error("[admin] Toggle tenant error:", err);
    sendError(res, 500, "Internal server error");
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/tenants/:id
// ---------------------------------------------------------------------------
adminRouter.delete("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const tenant = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM tenants WHERE id = $1`, [req.params.id]
    );
    if (!tenant) {
      sendError(res, 404, "Tenant not found");
      return;
    }

    await raw("DELETE FROM tenants WHERE id = $1", [req.params.id]);
    console.log(`[admin] Deleted tenant: ${tenant.name} (${tenant.id})`);

    res.json({ success: true, message: "Tenant permanently deleted" });
  } catch (err) {
    console.error("[admin] Delete tenant error:", err);
    sendError(res, 500, "Internal server error");
  }
});
