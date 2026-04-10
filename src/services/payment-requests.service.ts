import type sqlite3 from "sqlite3";
import type { Database } from "sqlite";
import { getDb } from "../db/client";
import type { PaymentRequest } from "../types/entities";

export interface PaymentRequestWithUser extends PaymentRequest {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function resolveCuratorUserId(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  workerUserId: number | null,
) {
  if (!workerUserId) {
    return null;
  }

  const row = await db.get<{ curatorUserId: number | null }>(
    `SELECT curators.linked_user_id AS curatorUserId
     FROM users
     LEFT JOIN curators ON curators.id = users.curator_id AND curators.is_active = 1
     WHERE users.id = ?`,
    workerUserId,
  );

  return row?.curatorUserId ?? null;
}

async function resolveProfitShares(
  db: Database<sqlite3.Database, sqlite3.Statement>,
  workerUserId: number | null,
  amount: number,
) {
  if (!workerUserId) {
    return {
      workerShareAmount: 0,
      curatorUserId: null as number | null,
      curatorShareAmount: 0,
    };
  }

  const worker = await db.get<{ role: string | null }>("SELECT role FROM users WHERE id = ?", workerUserId);
  if (worker?.role === "admin") {
    return {
      workerShareAmount: roundMoney(amount),
      curatorUserId: null as number | null,
      curatorShareAmount: 0,
    };
  }

  const curatorUserId = await resolveCuratorUserId(db, workerUserId);
  return {
    workerShareAmount: roundMoney(amount * (curatorUserId ? 0.65 : 0.75)),
    curatorUserId,
    curatorShareAmount: curatorUserId ? roundMoney(amount * 0.1) : 0,
  };
}

async function refreshUserProfitStats(db: Database<sqlite3.Database, sqlite3.Statement>, userId: number) {
  const row = await db.get<{
    totalCount: number;
    totalProfit: number;
    avgProfit: number;
    bestProfit: number;
  }>(
    `SELECT
      COUNT(*) AS totalCount,
      ROUND(COALESCE(SUM(share_amount), 0), 2) AS totalProfit,
      ROUND(COALESCE(AVG(share_amount), 0), 2) AS avgProfit,
      ROUND(COALESCE(MAX(share_amount), 0), 2) AS bestProfit
     FROM (
       SELECT worker_share_amount AS share_amount
       FROM payment_requests
       WHERE status = 'approved' AND worker_user_id = ? AND worker_share_amount > 0
       UNION ALL
       SELECT curator_share_amount AS share_amount
       FROM payment_requests
       WHERE status = 'approved' AND curator_user_id = ? AND curator_share_amount > 0
     )`,
    userId,
    userId,
  );

  const manual = await db.get<{ manual_profit_count: number; manual_profit_amount: number }>(
    "SELECT manual_profit_count, manual_profit_amount FROM users WHERE id = ?",
    userId,
  );
  const totalCount = (row?.totalCount ?? 0) + (manual?.manual_profit_count ?? 0);
  const totalProfit = roundMoney((row?.totalProfit ?? 0) + (manual?.manual_profit_amount ?? 0));
  const avgProfit = totalCount > 0 ? roundMoney(totalProfit / totalCount) : 0;
  const bestProfit = Math.max(row?.bestProfit ?? 0, avgProfit);

  await db.run(
    `UPDATE users
     SET withdrawable_balance = ?, total_profit = ?, avg_profit = ?, best_profit = ?
     WHERE id = ?`,
    totalProfit,
    totalProfit,
    avgProfit,
    bestProfit,
    userId,
  );
}

export async function createPaymentRequest(
  userId: number,
  amount: number,
  receiptFileId: string,
  comment?: string,
  workerUserId?: number | null,
) {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO payment_requests (
       user_id,
       worker_user_id,
       worker_share_amount,
       curator_user_id,
       curator_share_amount,
       amount,
       receipt_file_id,
       comment,
       source,
       status
     )
     VALUES (?, ?, 0, NULL, 0, ?, ?, ?, 'honeybunny', 'pending')`,
    userId,
    workerUserId ?? null,
    amount,
    receiptFileId,
    comment?.trim() || null,
  );

  return getPaymentRequestById(Number(result.lastID));
}

export async function getPaymentRequestById(requestId: number) {
  const db = await getDb();
  return db.get<PaymentRequest>("SELECT * FROM payment_requests WHERE id = ?", requestId);
}

export async function getPaymentRequestWithUser(requestId: number) {
  const db = await getDb();
  return db.get<PaymentRequestWithUser>(
    `SELECT
      payment_requests.*,
      users.telegram_id,
      users.username,
      users.first_name
     FROM payment_requests
     JOIN users ON users.id = payment_requests.user_id
     WHERE payment_requests.id = ?`,
    requestId,
  );
}

export async function approvePaymentRequest(requestId: number, adminUserId: number) {
  const db = await getDb();
  await db.exec("BEGIN");

  try {
    const request = await db.get<PaymentRequest>("SELECT * FROM payment_requests WHERE id = ?", requestId);
    if (!request) {
      await db.exec("ROLLBACK");
      return { status: "missing" as const, request: null };
    }

    if (request.status !== "pending") {
      await db.exec("ROLLBACK");
      return { status: "processed" as const, request: await getPaymentRequestWithUser(requestId) };
    }

    const { workerShareAmount, curatorUserId, curatorShareAmount } = await resolveProfitShares(
      db,
      request.worker_user_id,
      request.amount,
    );

    await db.run(
      `UPDATE payment_requests
       SET status = 'approved',
           admin_user_id = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           worker_share_amount = ?,
           curator_user_id = ?,
           curator_share_amount = ?
       WHERE id = ?`,
      adminUserId,
      workerShareAmount,
      curatorUserId,
      curatorShareAmount,
      requestId,
    );
    await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", request.amount, request.user_id);

    if (request.worker_user_id) {
      await refreshUserProfitStats(db, request.worker_user_id);
    }

    if (curatorUserId) {
      await refreshUserProfitStats(db, curatorUserId);
    }

    await db.exec("COMMIT");

    return { status: "approved" as const, request: await getPaymentRequestWithUser(requestId) };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function rejectPaymentRequest(requestId: number, adminUserId: number) {
  const db = await getDb();
  const request = await db.get<PaymentRequest>("SELECT * FROM payment_requests WHERE id = ?", requestId);
  if (!request) {
    return { status: "missing" as const, request: null };
  }

  if (request.status !== "pending") {
    return { status: "processed" as const, request: await getPaymentRequestWithUser(requestId) };
  }

  await db.run(
    `UPDATE payment_requests
     SET status = 'rejected', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    adminUserId,
    requestId,
  );

  return { status: "rejected" as const, request: await getPaymentRequestWithUser(requestId) };
}

export async function createManualProfit(
  adminUserId: number,
  workerUserId: number,
  amount: number,
  comment?: string,
  source: "direct_transfer" | "honeybunny" = "direct_transfer",
) {
  const db = await getDb();
  await db.exec("BEGIN");

  try {
    const worker = await db.get<{ id: number }>("SELECT id FROM users WHERE id = ?", workerUserId);
    if (!worker) {
      await db.exec("ROLLBACK");
      return { status: "worker_missing" as const, request: null };
    }

    const { workerShareAmount, curatorUserId, curatorShareAmount } = await resolveProfitShares(
      db,
      workerUserId,
      amount,
    );

    const result = await db.run(
      `INSERT INTO payment_requests (
         user_id,
         worker_user_id,
         worker_share_amount,
         curator_user_id,
         curator_share_amount,
         amount,
         receipt_file_id,
         comment,
         source,
         status,
         admin_user_id,
         reviewed_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`,
      workerUserId,
      workerUserId,
      workerShareAmount,
      curatorUserId,
      curatorShareAmount,
      amount,
      '__manual_profit__',
      comment?.trim() || null,
      source,
      adminUserId,
    );

    await refreshUserProfitStats(db, workerUserId);
    if (curatorUserId) {
      await refreshUserProfitStats(db, curatorUserId);
    }

    await db.exec("COMMIT");

    return {
      status: "created" as const,
      request: await getPaymentRequestWithUser(Number(result.lastID)),
    };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
