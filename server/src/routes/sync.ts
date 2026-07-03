/**
 * Sync Route — Receives batched data pushes from the Electron POS
 *
 * POST /api/sync/batch
 * Headers: Authorization: Bearer <tenant_api_key>
 *
 * The tenant is resolved by requireSyncAuth middleware (set on req.tenantId).
 * All data is tagged with tenant_id for multi-tenant isolation.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { processSyncBatch, type SyncBatch } from "../services/sync.service.js";
import { requireSyncAuth } from "../middleware/auth.js";
import { acquireTenantClient } from "../db/pool.js";
import type { Server as SocketServer } from "socket.io";

export function createSyncRouter(io: SocketServer) {
  const router = Router();

  const SyncTableSchema = z.object({
    table: z.string().min(1),
    action: z.enum(["upsert", "delete"]),
    rows: z.array(z.record(z.unknown())),
  });

  const SyncBatchSchema = z.object({
    timestamp: z.string(),
    posVersion: z.string().optional(),
    tables: z.array(SyncTableSchema).min(1),
  });

  // -----------------------------------------------------------------------
  // GET /api/sync/verify — lightweight auth check for POS connection tests
  // -----------------------------------------------------------------------
  router.get("/sync/verify", requireSyncAuth, (req: Request, res: Response) => {
    res.json({ success: true, tenantId: req.tenantId });
  });

  // -----------------------------------------------------------------------
  // POST /api/sync/batch
  // -----------------------------------------------------------------------
  router.post("/sync/batch", requireSyncAuth, async (req: Request, res: Response) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      res.status(401).json({ success: false, error: "Tenant not authenticated" });
      return;
    }

    const client = await acquireTenantClient(tenantId);
    try {
      const parsed = SyncBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "Invalid sync batch format",
          details: parsed.error.flatten(),
        });
        return;
      }

      const counts = await processSyncBatch(
        parsed.data as SyncBatch,
        io,
        tenantId,
        client
      );

      console.log(
        `[sync] Tenant ${tenantId}: batch processed — ${JSON.stringify(counts)}`
      );

      res.json({ success: true, counts });
    } catch (err) {
      console.error("[sync] Batch processing error:", err);
      res.status(500).json({ success: false, error: "Internal server error" });
    } finally {
      client.release();
    }
  });

  return router;
}
