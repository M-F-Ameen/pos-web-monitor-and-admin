"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startUserShift = startUserShift;
exports.endUserShift = endUserShift;
exports.listUserShifts = listUserShifts;
exports.getActiveUserShift = getActiveUserShift;
exports.getUserActivityReport = getUserActivityReport;
exports.listUserShiftOperations = listUserShiftOperations;
const database_1 = require("../database");
function roundMoney(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function nowLocalTimestamp() {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare("SELECT datetime('now','localtime') AS now")
        .get();
    return row.now;
}
function getShiftRowById(id) {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare(`
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
    `)
        .get(id);
    return row ?? null;
}
function getCashBalanceAt(upTo) {
    const db = (0, database_1.getDb)();
    const hasCutoff = !!upTo;
    const sales = db
        .prepare(`
      SELECT COALESCE(SUM(MAX(amount_received - change_given, 0)), 0) AS total
      FROM sales
      WHERE status IN ('completed', 'refunded')
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasCutoff ? [upTo] : []));
    const returns = db
        .prepare(`
      SELECT COALESCE(SUM(refund_amount), 0) AS total
      FROM returns
      WHERE status = 'approved'
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasCutoff ? [upTo] : []));
    const withdrawals = db
        .prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM treasury_ops
      WHERE type = 'withdraw'
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasCutoff ? [upTo] : []));
    const expenses = db
        .prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM treasury_ops
      WHERE type = 'expense'
      ${hasCutoff ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasCutoff ? [upTo] : []));
    return roundMoney(sales.total - returns.total - withdrawals.total - expenses.total);
}
function getMetricsForRange(userId, startAt, endAt) {
    const db = (0, database_1.getDb)();
    const hasEnd = !!endAt;
    const salesAgg = db
        .prepare(`
      SELECT
        COALESCE(SUM(MAX(amount_received - change_given, 0)), 0) AS total,
        COUNT(*) AS count
      FROM sales
      WHERE status IN ('completed', 'refunded')
        AND cashier_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt]));
    const returnsAgg = db
        .prepare(`
      SELECT
        COALESCE(SUM(refund_amount), 0) AS total,
        COUNT(*) AS count
      FROM returns
      WHERE status = 'approved'
        AND processed_by_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt]));
    const expensesAgg = db
        .prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
      FROM treasury_ops
      WHERE type = 'expense'
        AND user_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt]));
    const withdrawalsAgg = db
        .prepare(`
      SELECT
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
      FROM treasury_ops
      WHERE type = 'withdraw'
        AND user_id = ?
        AND created_at >= ?
        ${hasEnd ? "AND created_at <= ?" : ""}
    `)
        .get(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt]));
    const totalSales = roundMoney(salesAgg.total);
    const totalReturns = roundMoney(returnsAgg.total);
    const totalExpenses = roundMoney(expensesAgg.total);
    const totalWithdrawals = roundMoney(withdrawalsAgg.total);
    return {
        totalSales,
        totalReturns,
        totalExpenses,
        totalWithdrawals,
        operationCount: salesAgg.count + returnsAgg.count + expensesAgg.count + withdrawalsAgg.count,
        netCash: roundMoney(totalSales - totalReturns - totalExpenses - totalWithdrawals),
    };
}
function rowMetrics(row) {
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
        netCash: roundMoney(totalSales - totalReturns - totalExpenses - totalWithdrawals),
    };
}
function hydrateShift(row) {
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
function closeShiftByRow(row, logoutAt) {
    const db = (0, database_1.getDb)();
    const metrics = getMetricsForRange(row.user_id, row.login_at, logoutAt);
    const endCash = getCashBalanceAt(logoutAt);
    db.prepare(`
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
    `).run(logoutAt, endCash, metrics.totalSales, metrics.totalReturns, metrics.totalExpenses, metrics.totalWithdrawals, metrics.operationCount, logoutAt, row.id);
    const updated = getShiftRowById(row.id);
    if (!updated) {
        throw new Error("Failed to load updated shift session.");
    }
    return hydrateShift(updated);
}
function startUserShift(input) {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        const now = nowLocalTimestamp();
        const openRows = db
            .prepare(`
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
        `)
            .all(input.userId);
        for (const row of openRows) {
            closeShiftByRow(row, now);
        }
        const shiftId = crypto.randomUUID();
        const startCash = getCashBalanceAt(now);
        db.prepare(`
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
      `).run(shiftId, input.userId, input.userName, input.userRole, now, startCash, now, now);
        const created = getShiftRowById(shiftId);
        if (!created) {
            throw new Error("Failed to create shift session.");
        }
        return hydrateShift(created);
    });
    return txn();
}
function endUserShift(userId, shiftId) {
    const db = (0, database_1.getDb)();
    const txn = db.transaction(() => {
        const now = nowLocalTimestamp();
        const row = shiftId
            ? db
                .prepare(`
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
            `)
                .get(shiftId, userId)
            : db
                .prepare(`
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
            `)
                .get(userId);
        if (!row) {
            return null;
        }
        return closeShiftByRow(row, now);
    });
    return txn();
}
function listUserShifts(userId, limit = 50) {
    const db = (0, database_1.getDb)();
    const rows = db
        .prepare(`
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
      `)
        .all(userId, limit);
    return rows.map(hydrateShift);
}
function getActiveUserShift(userId) {
    const db = (0, database_1.getDb)();
    const row = db
        .prepare(`
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
      `)
        .get(userId);
    return row ? hydrateShift(row) : null;
}
function getUserActivityReport(user) {
    const shifts = listUserShifts(user.id, 100);
    const totals = shifts.reduce((acc, shift) => ({
        totalSales: roundMoney(acc.totalSales + shift.metrics.totalSales),
        totalReturns: roundMoney(acc.totalReturns + shift.metrics.totalReturns),
        totalExpenses: roundMoney(acc.totalExpenses + shift.metrics.totalExpenses),
        totalWithdrawals: roundMoney(acc.totalWithdrawals + shift.metrics.totalWithdrawals),
        operationCount: acc.operationCount + shift.metrics.operationCount,
        netCash: roundMoney(acc.netCash + shift.metrics.netCash),
    }), {
        totalSales: 0,
        totalReturns: 0,
        totalExpenses: 0,
        totalWithdrawals: 0,
        operationCount: 0,
        netCash: 0,
    });
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
function listUserShiftOperations(shiftId) {
    const db = (0, database_1.getDb)();
    const shift = getShiftRowById(shiftId);
    if (!shift) {
        return [];
    }
    const hasEnd = !!shift.logout_at;
    const startAt = shift.login_at;
    const endAt = shift.logout_at;
    const userId = shift.user_id;
    const salesRows = db
        .prepare(`
        SELECT id, receipt_number, MAX(amount_received - change_given, 0) AS amount, created_at
        FROM sales
        WHERE status IN ('completed', 'refunded')
          AND cashier_id = ?
          AND created_at >= ?
          ${hasEnd ? "AND created_at <= ?" : ""}
        ORDER BY created_at DESC
      `)
        .all(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt]));
    const returnRows = db
        .prepare(`
        SELECT id, return_number, refund_amount, created_at
        FROM returns
        WHERE status = 'approved'
          AND processed_by_id = ?
          AND created_at >= ?
          ${hasEnd ? "AND created_at <= ?" : ""}
        ORDER BY created_at DESC
      `)
        .all(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt]));
    const manualRows = db
        .prepare(`
        SELECT id, type, name, amount, created_at
        FROM treasury_ops
        WHERE user_id = ?
          AND type IN ('withdraw', 'expense')
          AND created_at >= ?
          ${hasEnd ? "AND created_at <= ?" : ""}
        ORDER BY created_at DESC
      `)
        .all(...(hasEnd ? [userId, startAt, endAt] : [userId, startAt]));
    const operations = [
        ...salesRows.map((row) => ({
            id: `sale:${row.id}`,
            shiftId: shift.id,
            type: "sale",
            reference: row.receipt_number,
            amount: roundMoney(row.amount),
            createdAt: row.created_at,
            userId: shift.user_id,
            userName: shift.user_name,
        })),
        ...returnRows.map((row) => ({
            id: `return:${row.id}`,
            shiftId: shift.id,
            type: "return",
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
