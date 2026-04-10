import { getDb } from "../db/client";
import type { User } from "../types/entities";

export type KassaPeriod = "day" | "week" | "month" | "all";

export interface KassaSummary {
  period: KassaPeriod;
  totalAmount: number;
  totalCount: number;
}

export interface KassaTopWorker extends Pick<User, "id" | "telegram_id" | "username" | "first_name"> {
  totalAmount: number;
  totalCount: number;
}

export interface WorkerProfitMetrics {
  totalCount: number;
  totalAmount: number;
  avgAmount: number;
  bestAmount: number;
}

function toSqliteDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getPeriodStart(period: KassaPeriod) {
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

function buildApprovedWhereClause(period: KassaPeriod) {
  const start = getPeriodStart(period);
  if (!start) {
    return {
      clause: "WHERE payment_requests.status = 'approved'",
      params: [] as Array<string | number>,
    };
  }

  return {
    clause: "WHERE payment_requests.status = 'approved' AND payment_requests.created_at >= ?",
    params: [start] as Array<string | number>,
  };
}

export async function getKassaSummary(period: KassaPeriod): Promise<KassaSummary> {
  const db = await getDb();
  const { clause, params } = buildApprovedWhereClause(period);
  const row = await db.get<{ totalAmount: number; totalCount: number }>(
    `SELECT
      COALESCE(SUM(amount), 0) AS totalAmount,
      COUNT(*) AS totalCount
     FROM payment_requests
     ${clause}`,
    ...params,
  );

  return {
    period,
    totalAmount: row?.totalAmount ?? 0,
    totalCount: row?.totalCount ?? 0,
  };
}

export async function getTopWorkers(period: KassaPeriod, limit = 5): Promise<KassaTopWorker[]> {
  const db = await getDb();
  const { clause, params } = buildApprovedWhereClause(period);

  return db.all<KassaTopWorker[]>(
    `SELECT
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
     LIMIT ?`,
    ...params,
    limit,
  );
}

export async function getWorkerProfitMetrics(workerUserId: number): Promise<WorkerProfitMetrics> {
  const db = await getDb();
  const row = await db.get<WorkerProfitMetrics>(
    `SELECT
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
     )`,
    workerUserId,
    workerUserId,
  );

  const manual = await db.get<{ manual_profit_count: number; manual_profit_amount: number }>(
    "SELECT manual_profit_count, manual_profit_amount FROM users WHERE id = ?",
    workerUserId,
  );
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
