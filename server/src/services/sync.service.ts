/**
 * Sync Service
 *
 * Handles batched data upserts from Electron POS desktop clients.
 * Each sync batch is tagged with the tenant's ID for multi-tenant isolation.
 * Emits Socket.io events scoped to the tenant's room for real-time updates.
 *
 * Strategy:
 *   - POS is the source of truth; cloud mirrors it via upsert.
 *   - Composite PK (tenant_id, id) ensures UUIDs don't collide across tenants.
 *   - RLS provides defense-in-depth at the database level.
 */

import { raw } from "../db/pool.js";
import type { Server as SocketServer } from "socket.io";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncBatch {
  timestamp: string;
  posVersion?: string;
  tables: SyncTablePayload[];
}

export interface SyncTablePayload {
  table: string;
  action: "upsert" | "delete";
  rows: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Upsert definitions — column lists for each table
// ---------------------------------------------------------------------------

interface UpsertDef {
  table: string;
  pk: string;
  columns: string[];
  updateSet: string;
}

const UPSERTS: Record<string, UpsertDef> = {
  categories: {
    table: "categories",
    pk: "id",
    columns: ["tenant_id", "id", "name", "created_at"],
    updateSet: "name = EXCLUDED.name",
  },
  suppliers: {
    table: "suppliers",
    pk: "id",
    columns: ["tenant_id", "id", "name", "phone", "created_at"],
    updateSet: "name = EXCLUDED.name, phone = EXCLUDED.phone",
  },
  products: {
    table: "products",
    pk: "id",
    columns: [
      "tenant_id", "id", "name", "barcode", "category_id", "supplier_id",
      "cost", "price", "stock", "min_stock", "unit",
      "is_active", "product_code", "created_at", "updated_at",
    ],
    updateSet:
      "name=EXCLUDED.name, barcode=EXCLUDED.barcode, category_id=EXCLUDED.category_id, " +
      "supplier_id=EXCLUDED.supplier_id, cost=EXCLUDED.cost, price=EXCLUDED.price, " +
      "stock=EXCLUDED.stock, min_stock=EXCLUDED.min_stock, unit=EXCLUDED.unit, " +
      "is_active=EXCLUDED.is_active, product_code=EXCLUDED.product_code, " +
      "updated_at=EXCLUDED.updated_at",
  },
  customers: {
    table: "customers",
    pk: "id",
    columns: [
      "tenant_id", "id", "customer_id", "name", "phone", "email", "address",
      "notes", "debt", "total_purchases", "total_spent",
      "created_at", "updated_at",
    ],
    updateSet:
      "customer_id=EXCLUDED.customer_id, name=EXCLUDED.name, phone=EXCLUDED.phone, " +
      "email=EXCLUDED.email, address=EXCLUDED.address, notes=EXCLUDED.notes, " +
      "debt=EXCLUDED.debt, total_purchases=EXCLUDED.total_purchases, " +
      "total_spent=EXCLUDED.total_spent, updated_at=EXCLUDED.updated_at",
  },
  users: {
    table: "users",
    pk: "id",
    columns: ["tenant_id", "id", "username", "role", "name"],
    updateSet: "username=EXCLUDED.username, role=EXCLUDED.role, name=EXCLUDED.name",
  },
  sales: {
    table: "sales",
    pk: "id",
    columns: [
      "tenant_id", "id", "receipt_number", "customer_id", "customer_name",
      "subtotal", "increase_amount", "discount_amount", "discount_type",
      "discount_value", "tax_rate", "tax_amount", "total",
      "payment_method", "amount_received", "change_given", "reference",
      "cashier_id", "cashier_name", "note", "status", "created_at",
    ],
    updateSet:
      "receipt_number=EXCLUDED.receipt_number, customer_name=EXCLUDED.customer_name, " +
      "total=EXCLUDED.total, status=EXCLUDED.status, payment_method=EXCLUDED.payment_method, " +
      "cashier_name=EXCLUDED.cashier_name, created_at=EXCLUDED.created_at",
  },
  sale_items: {
    table: "sale_items",
    pk: "id",
    columns: [
      "tenant_id", "id", "sale_id", "product_id", "product_name",
      "price", "quantity", "discount", "discount_type", "subtotal",
    ],
    updateSet:
      "product_name=EXCLUDED.product_name, price=EXCLUDED.price, " +
      "quantity=EXCLUDED.quantity, subtotal=EXCLUDED.subtotal",
  },
  returns: {
    table: "returns",
    pk: "id",
    columns: [
      "tenant_id", "id", "return_number", "sale_id", "product_id", "product_name",
      "quantity", "refund_amount", "reason", "status",
      "processed_by_id", "processed_by", "created_at",
    ],
    updateSet:
      "product_name=EXCLUDED.product_name, quantity=EXCLUDED.quantity, " +
      "refund_amount=EXCLUDED.refund_amount, status=EXCLUDED.status, " +
      "created_at=EXCLUDED.created_at",
  },
  treasury_operations: {
    table: "treasury_operations",
    pk: "id",
    columns: [
      "tenant_id", "id", "type", "name", "amount", "user_id", "user_name",
      "date", "source", "created_at",
    ],
    updateSet:
      "name=EXCLUDED.name, amount=EXCLUDED.amount, user_name=EXCLUDED.user_name, " +
      "date=EXCLUDED.date",
  },
  user_shifts: {
    table: "user_shifts",
    pk: "id",
    columns: [
      "tenant_id", "id", "user_id", "user_name", "user_role", "login_at", "logout_at",
      "start_cash", "end_cash", "total_sales", "total_returns",
      "total_expenses", "total_withdrawals", "operations_count",
    ],
    updateSet:
      "user_name=EXCLUDED.user_name, logout_at=EXCLUDED.logout_at, " +
      "end_cash=EXCLUDED.end_cash, total_sales=EXCLUDED.total_sales, " +
      "total_returns=EXCLUDED.total_returns, total_expenses=EXCLUDED.total_expenses, " +
      "total_withdrawals=EXCLUDED.total_withdrawals, operations_count=EXCLUDED.operations_count",
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a sync batch from a POS desktop client.
 *
 * @param batch   - The sync payload from the POS
 * @param io      - Socket.io server instance for real-time events
 * @param tenantId - The tenant this data belongs to
 * @returns Record of table → row count processed
 */
export async function processSyncBatch(
  batch: SyncBatch,
  io: SocketServer,
  tenantId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const payload of batch.tables) {
    const def = UPSERTS[payload.table];
    if (!def) {
      console.warn(`[sync] Unknown table: ${payload.table} — skipping`);
      continue;
    }

    if (payload.action === "delete" && payload.rows.length > 0) {
      const ids = payload.rows.map((r) => r[def.pk]);
      await raw(
        `DELETE FROM ${def.table} WHERE tenant_id = $1 AND ${def.pk} = ANY($2::text[])`,
        [tenantId, ids]
      );
      counts[payload.table] = ids.length;
      continue;
    }

    if (payload.rows.length === 0) continue;

    // Build parameterized upsert with tenant_id prepended to each row
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIdx = 1;

    for (const row of payload.rows) {
      const rowPlaceholders: string[] = [];
      for (const col of def.columns) {
        if (col === "tenant_id") {
          values.push(tenantId);
        } else {
          values.push(row[col] ?? null);
        }
        rowPlaceholders.push(`$${paramIdx++}`);
      }
      placeholders.push(`(${rowPlaceholders.join(", ")})`);
    }

    const colList = def.columns.join(", ");
    const conflictTarget = `(tenant_id, ${def.pk})`;
    const sql = `
      INSERT INTO ${def.table} (${colList})
      VALUES ${placeholders.join(",\n")}
      ON CONFLICT ${conflictTarget} DO UPDATE SET ${def.updateSet}
    `;

    await raw(sql, values);
    counts[payload.table] = payload.rows.length;
  }

  // Update sync meta for this tenant
  await raw(
    `INSERT INTO sync_meta (tenant_id, id, last_sync_at, pos_version, updated_at)
     VALUES ($1, 'default', now(), $2, now())
     ON CONFLICT (tenant_id, id)
     DO UPDATE SET last_sync_at = now(), pos_version = $2, updated_at = now()`,
    [tenantId, batch.posVersion ?? ""]
  );

  // Emit real-time events scoped to the tenant's room
  const affectedTables = Object.keys(counts);
  const room = `tenant:${tenantId}`;

  io.to(room).emit("sync:update", {
    timestamp: batch.timestamp,
    tables: affectedTables,
    counts,
  });

  for (const table of affectedTables) {
    io.to(room).emit(`${table}:changed`, {
      count: counts[table],
      timestamp: batch.timestamp,
    });
  }

  return counts;
}
