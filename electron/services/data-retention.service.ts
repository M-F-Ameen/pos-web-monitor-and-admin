import { getDb } from "../database";

const RETENTION_DAYS = 30;
const RETENTION_OFFSET = `-${RETENTION_DAYS} days`;
const RETENTION_BATCH_SIZE = 500;
const RETENTION_MAX_BATCHES_PER_RUN = 8;

export interface RetentionCleanupSummary {
  cutoffAt: string;
  deletedSales: number;
  deletedReturns: number;
  deletedTreasuryOperations: number;
  deletedUserShifts: number;
  deletedSupplierOperations: number;
  refreshedCustomers: number;
  refreshedSuppliers: number;
}

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

interface BatchedDeleteResult {
  deleted: number;
  affectedIds: string[];
}

function tableExists(tableName: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT 1
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `,
    )
    .get(tableName);
  return Boolean(row);
}

function getCutoffDateTime(): string {
  const db = getDb();
  const row = db
    .prepare("SELECT datetime('now','localtime', ?) AS cutoff")
    .get(RETENTION_OFFSET) as { cutoff: string };
  return row.cutoff;
}

function deleteOldRowsInBatches(
  tableName: string,
  dateColumn: string,
  cutoffAt: string,
  extraWhereSql?: string,
  affectedIdColumn?: string,
): BatchedDeleteResult {
  const db = getDb();
  if (!tableExists(tableName)) {
    return { deleted: 0, affectedIds: [] };
  }

  const safeTable = quoteIdentifier(tableName);
  const safeDateColumn = quoteIdentifier(dateColumn);
  const whereClauses = [`${safeDateColumn} < ?`];
  if (extraWhereSql?.trim()) {
    whereClauses.push(extraWhereSql.trim());
  }
  const whereSql = whereClauses.join(" AND ");

  let totalDeleted = 0;
  const affectedIds = new Set<string>();

  for (let batch = 0; batch < RETENTION_MAX_BATCHES_PER_RUN; batch += 1) {
    const selectColumns = affectedIdColumn
      ? `rowid, ${quoteIdentifier(affectedIdColumn)} AS affected_id`
      : "rowid";
    const rows = db
      .prepare(
        `
          SELECT ${selectColumns}
          FROM ${safeTable}
          WHERE ${whereSql}
          ORDER BY ${safeDateColumn} ASC
          LIMIT ?
        `,
      )
      .all(cutoffAt, RETENTION_BATCH_SIZE) as Array<{
      rowid: number;
      affected_id?: string | null;
    }>;

    if (rows.length === 0) {
      break;
    }

    if (affectedIdColumn) {
      rows.forEach((row) => {
        if (typeof row.affected_id === "string" && row.affected_id.trim()) {
          affectedIds.add(row.affected_id);
        }
      });
    }

    const rowIds = rows.map((row) => row.rowid);
    const placeholders = rowIds.map(() => "?").join(", ");
    const deleted = db
      .prepare(`DELETE FROM ${safeTable} WHERE rowid IN (${placeholders})`)
      .run(...rowIds).changes;
    totalDeleted += deleted;

    if (rows.length < RETENTION_BATCH_SIZE) {
      break;
    }
  }
  return { deleted: totalDeleted, affectedIds: Array.from(affectedIds) };
}

function refreshCustomerFinancials(): number {
  const db = getDb();
  if (!tableExists("customers")) {
    return 0;
  }

  return db
    .prepare(
      `
      UPDATE customers
      SET
        total_purchases = COALESCE((
          SELECT COUNT(*)
          FROM sales s
          WHERE s.customer_id = customers.id
            AND s.status = 'completed'
        ), 0),
        total_spent = COALESCE((
          SELECT ROUND(SUM(s.total), 2)
          FROM sales s
          WHERE s.customer_id = customers.id
            AND s.status = 'completed'
        ), 0),
        debt = COALESCE((
          SELECT ROUND(
            SUM(
              CASE
                WHEN (s.total - (s.amount_received - s.change_given)) > 0
                  THEN (s.total - (s.amount_received - s.change_given))
                ELSE 0
              END
            ),
            2
          )
          FROM sales s
          WHERE s.customer_id = customers.id
            AND s.status = 'completed'
        ), 0),
        updated_at = datetime('now','localtime')
    `,
    )
    .run().changes;
}

function refreshCustomerFinancialsByIds(customerIds: string[]): number {
  const db = getDb();
  if (!tableExists("customers") || customerIds.length === 0) {
    return 0;
  }

  const updateStmt = db.prepare(
    `
      UPDATE customers
      SET
        total_purchases = COALESCE((
          SELECT COUNT(*)
          FROM sales s
          WHERE s.customer_id = customers.id
            AND s.status = 'completed'
        ), 0),
        total_spent = COALESCE((
          SELECT ROUND(SUM(s.total), 2)
          FROM sales s
          WHERE s.customer_id = customers.id
            AND s.status = 'completed'
        ), 0),
        debt = COALESCE((
          SELECT ROUND(
            SUM(
              CASE
                WHEN (s.total - (s.amount_received - s.change_given)) > 0
                  THEN (s.total - (s.amount_received - s.change_given))
                ELSE 0
              END
            ),
            2
          )
          FROM sales s
          WHERE s.customer_id = customers.id
            AND s.status = 'completed'
        ), 0),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `,
  );

  let refreshed = 0;
  for (const id of customerIds) {
    refreshed += updateStmt.run(id).changes;
  }
  return refreshed;
}

function refreshSupplierFinancials(): number {
  const db = getDb();
  if (!tableExists("suppliers") || !tableExists("supplier_operations")) {
    return 0;
  }

  return db
    .prepare(
      `
      UPDATE suppliers
      SET
        total_purchases = COALESCE((
          SELECT ROUND(SUM(so.purchase_amount), 2)
          FROM supplier_operations so
          WHERE so.supplier_id = suppliers.id
        ), 0),
        total_paid = COALESCE((
          SELECT ROUND(SUM(so.paid_amount), 2)
          FROM supplier_operations so
          WHERE so.supplier_id = suppliers.id
        ), 0),
        debt = MAX(
          COALESCE((
            SELECT ROUND(SUM(so.purchase_amount), 2)
            FROM supplier_operations so
            WHERE so.supplier_id = suppliers.id
          ), 0) - COALESCE((
            SELECT ROUND(SUM(so.paid_amount), 2)
            FROM supplier_operations so
            WHERE so.supplier_id = suppliers.id
          ), 0),
          0
        ),
        updated_at = datetime('now','localtime')
    `,
    )
    .run().changes;
}

function refreshSupplierFinancialsByIds(supplierIds: string[]): number {
  const db = getDb();
  if (
    !tableExists("suppliers") ||
    !tableExists("supplier_operations") ||
    supplierIds.length === 0
  ) {
    return 0;
  }

  const updateStmt = db.prepare(
    `
      UPDATE suppliers
      SET
        total_purchases = COALESCE((
          SELECT ROUND(SUM(so.purchase_amount), 2)
          FROM supplier_operations so
          WHERE so.supplier_id = suppliers.id
        ), 0),
        total_paid = COALESCE((
          SELECT ROUND(SUM(so.paid_amount), 2)
          FROM supplier_operations so
          WHERE so.supplier_id = suppliers.id
        ), 0),
        debt = MAX(
          COALESCE((
            SELECT ROUND(SUM(so.purchase_amount), 2)
            FROM supplier_operations so
            WHERE so.supplier_id = suppliers.id
          ), 0) - COALESCE((
            SELECT ROUND(SUM(so.paid_amount), 2)
            FROM supplier_operations so
            WHERE so.supplier_id = suppliers.id
          ), 0),
          0
        ),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `,
  );

  let refreshed = 0;
  for (const id of supplierIds) {
    refreshed += updateStmt.run(id).changes;
  }
  return refreshed;
}

/**
 * Keep only the latest 30 days of operational history to control DB growth.
 * This is intentionally destructive for old operation rows by product request.
 */
export function runOperationalDataRetentionCleanup(): RetentionCleanupSummary {
  const txn = getDb().transaction((): RetentionCleanupSummary => {
    const cutoffAt = getCutoffDateTime();
    const deletedReturnsResult = deleteOldRowsInBatches(
      "returns",
      "created_at",
      cutoffAt,
    );

    const deletedSalesResult = deleteOldRowsInBatches(
      "sales",
      "created_at",
      cutoffAt,
      undefined,
      "customer_id",
    );

    const deletedTreasuryOperationsResult = deleteOldRowsInBatches(
      "treasury_ops",
      "created_at",
      cutoffAt,
    );

    const deletedUserShiftsResult = deleteOldRowsInBatches(
      "user_shifts",
      "logout_at",
      cutoffAt,
      "logout_at IS NOT NULL",
    );

    const deletedSupplierOperationsResult = deleteOldRowsInBatches(
      "supplier_operations",
      "created_at",
      cutoffAt,
      undefined,
      "supplier_id",
    );

    const affectedCustomerIds = deletedSalesResult.affectedIds;
    const affectedSupplierIds = deletedSupplierOperationsResult.affectedIds;

    const refreshedCustomers =
      affectedCustomerIds.length > 0
        ? refreshCustomerFinancialsByIds(affectedCustomerIds)
        : 0;
    const refreshedSuppliers =
      affectedSupplierIds.length > 0
        ? refreshSupplierFinancialsByIds(affectedSupplierIds)
        : 0;

    return {
      cutoffAt,
      deletedSales: deletedSalesResult.deleted,
      deletedReturns: deletedReturnsResult.deleted,
      deletedTreasuryOperations: deletedTreasuryOperationsResult.deleted,
      deletedUserShifts: deletedUserShiftsResult.deleted,
      deletedSupplierOperations: deletedSupplierOperationsResult.deleted,
      refreshedCustomers,
      refreshedSuppliers,
    };
  });

  return txn();
}
