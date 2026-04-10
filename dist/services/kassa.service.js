"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKassaSummary = getKassaSummary;
exports.getTopWorkers = getTopWorkers;
exports.getWorkerProfitMetrics = getWorkerProfitMetrics;
const client_1 = require("../db/client");
function toSqliteDateTime(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}
function getPeriodStart(period) {
    if (period === "all") {
        return null;
    }
    const date = new Date();
    if (period === "day") {
        date.setHours(0, 0, 0, 0);
        return toSqliteDateTime(date);
    }
    if (period === "week") {
        const currentDay = date.getDay();
        const delta = currentDay === 0 ? 6 : currentDay - 1;
        date.setDate(date.getDate() - delta);
        date.setHours(0, 0, 0, 0);
        return toSqliteDateTime(date);
    }
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return toSqliteDateTime(date);
}
function buildApprovedWhereClause(period) {
    const start = getPeriodStart(period);
    if (!start) {
        return {
            clause: "WHERE payment_requests.status = 'approved'",
            params: [],
        };
    }
    return {
        clause: "WHERE payment_requests.status = 'approved' AND payment_requests.created_at >= ?",
        params: [start],
    };
}
async function getKassaSummary(period) {
    const db = await (0, client_1.getDb)();
    const { clause, params } = buildApprovedWhereClause(period);
    const row = await db.get(`SELECT
      COALESCE(SUM(amount), 0) AS totalAmount,
      COUNT(*) AS totalCount
     FROM payment_requests
     ${clause}`, ...params);
    return {
        period,
        totalAmount: row?.totalAmount ?? 0,
        totalCount: row?.totalCount ?? 0,
    };
}
async function getTopWorkers(period, limit = 5) {
    const db = await (0, client_1.getDb)();
    const { clause, params } = buildApprovedWhereClause(period);
    return db.all(`SELECT
      users.id,
      users.telegram_id,
      users.username,
      users.first_name,
      ROUND(COALESCE(SUM(payment_requests.worker_share_amount), 0), 2) AS totalAmount,
      COUNT(payment_requests.id) AS totalCount
     FROM payment_requests
     JOIN users ON users.id = payment_requests.worker_user_id
     ${clause} AND payment_requests.worker_user_id IS NOT NULL
     GROUP BY users.id, users.telegram_id, users.username, users.first_name
     ORDER BY totalAmount DESC, totalCount DESC, users.id ASC
     LIMIT ?`, ...params, limit);
}
async function getWorkerProfitMetrics(workerUserId) {
    const db = await (0, client_1.getDb)();
    const row = await db.get(`SELECT
      COUNT(*) AS totalCount,
      ROUND(COALESCE(SUM(share_amount), 0), 2) AS totalAmount,
      ROUND(COALESCE(AVG(share_amount), 0), 2) AS avgAmount,
      ROUND(COALESCE(MAX(share_amount), 0), 2) AS bestAmount
     FROM (
       SELECT worker_share_amount AS share_amount
       FROM payment_requests
       WHERE worker_user_id = ? AND status = 'approved' AND worker_share_amount > 0
       UNION ALL
       SELECT curator_share_amount AS share_amount
       FROM payment_requests
       WHERE curator_user_id = ? AND status = 'approved' AND curator_share_amount > 0
     )`, workerUserId, workerUserId);
    const manual = await db.get("SELECT manual_profit_count, manual_profit_amount FROM users WHERE id = ?", workerUserId);
    const totalCount = (row?.totalCount ?? 0) + (manual?.manual_profit_count ?? 0);
    const totalAmount = Math.round(((row?.totalAmount ?? 0) + (manual?.manual_profit_amount ?? 0)) * 100) / 100;
    const avgAmount = totalCount > 0 ? Math.round((totalAmount / totalCount) * 100) / 100 : 0;
    const bestAmount = Math.max(row?.bestAmount ?? 0, avgAmount);
    return {
        totalCount,
        totalAmount,
        avgAmount,
        bestAmount,
    };
}
