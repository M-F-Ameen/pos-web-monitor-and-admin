import { getDb } from "../database";
import type {
  User,
  UserRole,
  UserShift,
  UserShiftMetrics,
  UserActivityReport,
  UserShiftOperation,
} from "../shared/types";

interface ShiftRow {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  login_at: string;
  logout_at: string | null;
  start_cash: number;
  end_cash: number | null;
  total_sales: number;
  total_returns: number;
  total_expenses: number;
  total_withdrawals: number;
  operations_count: number;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nowLocalTimestamp(): string {
  const db = getDb();
  const row = db
    .prepare("SELECT datetime('now','localtime') AS now")
    .get() as { now: string };
  return row.now;
}

function getShiftRowById(id: string): ShiftRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT
        id,
        user_id,
        user_name,
        user_role,
        login_at,
        logout_at,
        start_cash,
        end_cash,
        total_sales,
        total_returns,
        total_expenses,
        total_withdrawals,
        operations_count
      FROM user_shifts
      WHERE id = ?
    `,
    )
    .get(id) as ShiftRow | undefined;

  return row ?? null;
}

function getCashBalanceAt(upTo?: string): number {
  const db = getDb();
  const hasCutoff = !!upTo;

  const sales = db
    .prepare(
      `
      SELECT COALESCE(SUM(MAX(amount_received - change_given, 0)), 0) AS total
      FROM sales
      WHERE status IN ('completed', 'refunded')
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasCutoff ? [upTo] : [])) as { total: number };

  const returns = db
    .prepare(
      `
      SELECT COALESCE(SUM(refund_amount), 0) AS total
      FROM returns
      WHERE status = 'approved'
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasCutoff ? [upTo] : [])) as { total: number };

  const withdrawals = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM treasury_ops
      WHERE type = 'withdraw'
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasCutoff ? [upTo] : [])) as { total: number };

  const expenses = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM treasury_ops
      WHERE type = 'expense'
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasCutoff ? [upTo] : [])) as { total: number };

  return roundMoney(
    sales.total - returns.total - withdrawals.total - expenses.total,
  );
}

function getMetricsForRange(
  userId: string,
  startAt: string,
  endAt: string | null,
): UserShiftMetrics {
  const db = getDb();
  const hasEnd = !!endAt;

  const salesAgg = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(MAX(amount_received - change_given, 0)), 0) AS total,
        COUNT(*) AS count
      FROM sales
      WHERE status IN ('completed', 'refunded')
        AND cashier_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt])) as {
    total: number;
    count: number;
  };

  const returnsAgg = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(refund_amount), 0) AS total,
        COUNT(*) AS count
      FROM returns
      WHERE status = 'approved'
        AND processed_by_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt])) as {
    total: number;
    count: number;
  };

  const expensesAgg = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
      FROM treasury_ops
      WHERE type = 'expense'
        AND user_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt])) as {
    total: number;
    count: number;
  };

  const withdrawalsAgg = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
      FROM treasury_ops
      WHERE type = 'withdraw'
        AND user_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `,
    )
    .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt])) as {
    total: number;
    count: number;
  };

  const totalSales = roundMoney(salesAgg.total);
  const totalReturns = roundMoney(returnsAgg.total);
  const totalExpenses = roundMoney(expensesAgg.total);
  const totalWithdrawals = roundMoney(withdrawalsAgg.total);

  return {
    totalSales,
    totalReturns,
    totalExpenses,
    totalWithdrawals,
    operationCount:
      salesAgg.count + returnsAgg.count + expensesAgg.count + withdrawalsAgg.count,
    netCash: roundMoney(
      totalSales - totalReturns - totalExpenses - totalWithdrawals,
    ),
  };
}

function rowMetrics(row: ShiftRow): UserShiftMetrics {
  const totalSales = roundMoney(row.total_sales);
  const totalReturns = roundMoney(row.total_returns);
  const totalExpenses = roundMoney(row.total_expenses);
  const totalWithdrawals = roundMoney(row.total_withdrawals);

  return {
    totalSales,
    totalReturns,
    totalExpenses,
    totalWithdrawals,
    operationCount: row.operations_count,
    netCash: roundMoney(
      totalSales - totalReturns - totalExpenses - totalWithdrawals,
    ),
  };
}

function hydrateShift(row: ShiftRow): UserShift {
  if (!row.logout_at) {
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      loginAt: row.login_at,
      logoutAt: null,
      startCash: roundMoney(row.start_cash),
      endCash: getCashBalanceAt(),
      status: "open",
      metrics: getMetricsForRange(row.user_id, row.login_at, null),
    };
  }

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userRole: row.user_role,
    loginAt: row.login_at,
    logoutAt: row.logout_at,
    startCash: roundMoney(row.start_cash),
    endCash: row.end_cash === null ? null : roundMoney(row.end_cash),
    status: "closed",
    metrics: rowMetrics(row),
  };
}

function closeShiftByRow(row: ShiftRow, logoutAt: string): UserShift {
  const db = getDb();
  const metrics = getMetricsForRange(row.user_id, row.login_at, logoutAt);
  const endCash = getCashBalanceAt(logoutAt);

  db.prepare(
    `
      UPDATE user_shifts
      SET
        logout_at = ?,
        end_cash = ?,
        total_sales = ?,
        total_returns = ?,
        total_expenses = ?,
        total_withdrawals = ?,
        operations_count = ?,
        updated_at = ?
      WHERE id = ?
    `,
  ).run(
    logoutAt,
    endCash,
    metrics.totalSales,
    metrics.totalReturns,
    metrics.totalExpenses,
    metrics.totalWithdrawals,
    metrics.operationCount,
    logoutAt,
    row.id,
  );

  const updated = getShiftRowById(row.id);
  if (!updated) {
    throw new Error("Failed to load updated shift session.");
  }
  return hydrateShift(updated);
}

export function startUserShift(input: {
  userId: string;
  userName: string;
  userRole: UserRole;
}): UserShift {
  const db = getDb();

  const txn = db.transaction(() => {
    const now = nowLocalTimestamp();

    const openRows = db
      .prepare(
        `
          SELECT
            id,
            user_id,
            user_name,
            user_role,
            login_at,
            logout_at,
            start_cash,
            end_cash,
            total_sales,
            total_returns,
            total_expenses,
            total_withdrawals,
            operations_count
          FROM user_shifts
          WHERE user_id = ? AND logout_at IS NULL
          ORDER BY login_at DESC
        `,
      )
      .all(input.userId) as ShiftRow[];

    for (const row of openRows) {
      closeShiftByRow(row, now);
    }

    const shiftId = crypto.randomUUID();
    const startCash = getCashBalanceAt(now);

    db.prepare(
      `
        INSERT INTO user_shifts (
          id,
          user_id,
          user_name,
          user_role,
          login_at,
          start_cash,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      shiftId,
      input.userId,
      input.userName,
      input.userRole,
      now,
      startCash,
      now,
      now,
    );

    const created = getShiftRowById(shiftId);
    if (!created) {
      throw new Error("Failed to create shift session.");
    }

    return hydrateShift(created);
  });

  return txn();
}

export function endUserShift(userId: string, shiftId?: string): UserShift | null {
  const db = getDb();

  const txn = db.transaction(() => {
    const now = nowLocalTimestamp();

    const row = shiftId
      ? (db
          .prepare(
            `
              SELECT
                id,
                user_id,
                user_name,
                user_role,
                login_at,
                logout_at,
                start_cash,
                end_cash,
                total_sales,
                total_returns,
                total_expenses,
                total_withdrawals,
                operations_count
              FROM user_shifts
              WHERE id = ? AND user_id = ? AND logout_at IS NULL
              LIMIT 1
            `,
          )
          .get(shiftId, userId) as ShiftRow | undefined)
      : (db
          .prepare(
            `
              SELECT
                id,
                user_id,
                user_name,
                user_role,
                login_at,
                logout_at,
                start_cash,
                end_cash,
                total_sales,
                total_returns,
                total_expenses,
                total_withdrawals,
                operations_count
              FROM user_shifts
              WHERE user_id = ? AND logout_at IS NULL
              ORDER BY login_at DESC
              LIMIT 1
            `,
          )
          .get(userId) as ShiftRow | undefined);

    if (!row) {
      return null;
    }

    return closeShiftByRow(row, now);
  });

  return txn();
}

export function listUserShifts(userId: string, limit = 50): UserShift[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          id,
          user_id,
          user_name,
          user_role,
          login_at,
          logout_at,
          start_cash,
          end_cash,
          total_sales,
          total_returns,
          total_expenses,
          total_withdrawals,
          operations_count
        FROM user_shifts
        WHERE user_id = ?
        ORDER BY login_at DESC
        LIMIT ?
      `,
    )
    .all(userId, limit) as ShiftRow[];

  return rows.map(hydrateShift);
}

export function getActiveUserShift(userId: string): UserShift | null {
  const db = getDb();
  const row = db
    .prepare(
      `
        SELECT
          id,
          user_id,
          user_name,
          user_role,
          login_at,
          logout_at,
          start_cash,
          end_cash,
          total_sales,
          total_returns,
          total_expenses,
          total_withdrawals,
          operations_count
        FROM user_shifts
        WHERE user_id = ? AND logout_at IS NULL
        ORDER BY login_at DESC
        LIMIT 1
      `,
    )
    .get(userId) as ShiftRow | undefined;

  return row ? hydrateShift(row) : null;
}

export function getUserActivityReport(user: User): UserActivityReport {
  const shifts = listUserShifts(user.id, 100);

  const totals = shifts.reduce<UserShiftMetrics>(
    (acc, shift) => ({
      totalSales: roundMoney(acc.totalSales + shift.metrics.totalSales),
      totalReturns: roundMoney(acc.totalReturns + shift.metrics.totalReturns),
      totalExpenses: roundMoney(acc.totalExpenses + shift.metrics.totalExpenses),
      totalWithdrawals: roundMoney(
        acc.totalWithdrawals + shift.metrics.totalWithdrawals,
      ),
      operationCount: acc.operationCount + shift.metrics.operationCount,
      netCash: roundMoney(acc.netCash + shift.metrics.netCash),
    }),
    {
      totalSales: 0,
      totalReturns: 0,
      totalExpenses: 0,
      totalWithdrawals: 0,
      operationCount: 0,
      netCash: 0,
    },
  );

  const activeShift = shifts.find((shift) => shift.status === "open") ?? null;

  return {
    user,
    activeShift,
    shifts,
    totals,
    shiftCount: shifts.length,
    currentCashNow: getCashBalanceAt(),
  };
}

export function listUserShiftOperations(shiftId: string): UserShiftOperation[] {
  const db = getDb();
  const shift = getShiftRowById(shiftId);
  if (!shift) {
    return [];
  }

  const hasEnd = !!shift.logout_at;
  const startAt = shift.login_at;
  const endAt = shift.logout_at;
  const userId = shift.user_id;

  const salesRows = db
    .prepare(
      `
        SELECT id, receipt_number, MAX(amount_received - change_given, 0) AS amount, created_at
        FROM sales
        WHERE status IN ('completed', 'refunded')
          AND cashier_id = ?
          AND created_at >= ?
          ${hasEnd ? "AND created_at <= ?" : ""}
        ORDER BY created_at DESC
      `,
    )
    .all(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt])) as {
    id: string;
    receipt_number: string;
    amount: number;
    created_at: string;
  }[];

  const returnRows = db
    .prepare(
      `
        SELECT id, return_number, refund_amount, created_at
        FROM returns
        WHERE status = 'approved'
          AND processed_by_id = ?
          AND created_at >= ?
          ${hasEnd ? "AND created_at <= ?" : ""}
        ORDER BY created_at DESC
      `,
    )
    .all(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt])) as {
    id: string;
    return_number: string;
    refund_amount: number;
    created_at: string;
  }[];

  const manualRows = db
    .prepare(
      `
        SELECT id, type, name, amount, created_at
        FROM treasury_ops
        WHERE user_id = ?
          AND type IN ('withdraw', 'expense')
          AND created_at >= ?
          ${hasEnd ? "AND created_at <= ?" : ""}
        ORDER BY created_at DESC
      `,
    )
    .all(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt])) as {
    id: string;
    type: "withdraw" | "expense";
    name: string;
    amount: number;
    created_at: string;
  }[];

  const operations: UserShiftOperation[] = [
    ...salesRows.map((row) => ({
      id: `sale:${row.id}`,
      shiftId: shift.id,
      type: "sale" as const,
      reference: row.receipt_number,
      amount: roundMoney(row.amount),
      createdAt: row.created_at,
      userId: shift.user_id,
      userName: shift.user_name,
    })),
    ...returnRows.map((row) => ({
      id: `return:${row.id}`,
      shiftId: shift.id,
      type: "return" as const,
      reference: row.return_number,
      amount: roundMoney(row.refund_amount),
      createdAt: row.created_at,
      userId: shift.user_id,
      userName: shift.user_name,
    })),
    ...manualRows.map((row) => ({
      id: `${row.type}:${row.id}`,
      shiftId: shift.id,
      type: row.type,
      reference: row.name,
      amount: roundMoney(row.amount),
      createdAt: row.created_at,
      userId: shift.user_id,
      userName: shift.user_name,
    })),
  ];

  operations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return operations;
}
