/**
 * Auth Routes
 *
 * POST /api/auth/admin/login  — SaaS owner login
 * POST /api/auth/login         — Tenant dashboard user login
 *
 * Both return a JWT with role and tenant context.
 */

import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { queryOne, setTenantContext } from "../db/pool.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../config.js";

export const authRouter = Router();

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/auth/admin/login
// ---------------------------------------------------------------------------
authRouter.post("/auth/admin/login", async (req: Request, res: Response) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid email or password format" });
      return;
    }

    const { email, password } = parsed.data;

    const user = await queryOne<{
      id: string; email: string; password_hash: string;
      name: string; role: string; is_active: boolean;
    }>(
      `SELECT id, email, password_hash, name, role, is_active
       FROM admin_users WHERE email = $1`,
      [email]
    );

    if (!user) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ success: false, error: "Account is disabled" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, type: "admin" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("[auth] Admin login error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
authRouter.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Invalid email or password format" });
      return;
    }

    const { email, password } = parsed.data;

    const user = await queryOne<{
      id: string; tenant_id: string; email: string;
      password_hash: string; name: string; role: string; is_active: boolean;
    }>(
      `SELECT tu.id, tu.tenant_id, tu.email, tu.password_hash,
              tu.name, tu.role, tu.is_active, t.is_active AS tenant_active
       FROM tenant_users tu
       JOIN tenants t ON t.id = tu.tenant_id
       WHERE tu.email = $1`,
      [email]
    );

    if (!user) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    if (!(user as any).tenant_active) {
      res.status(403).json({ success: false, error: "Tenant account is suspended" });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ success: false, error: "Account is disabled" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      {
        sub: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        role: user.role,
        type: "tenant",
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[auth] Tenant login error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});
