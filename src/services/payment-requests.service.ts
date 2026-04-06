import type sqlite3 from "sqlite3";
import type { Database } from "sqlite";
import { getDb } from "../db/client";
import type { PaymentRequest } from "../types/entities";

export interface PaymentRequestWithUser extends PaymentRequest {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
}

async function refreshWorkerProfitStats(db: Database<sqlite3.Database, sqlite3.Statement>, workerUserId: number) {
  const row = await db.get<{ totalProfit: number; avgProfit: number; bestProfit: number }>(
    `SELECT
      COALESCE(SUM(amount), 0) AS totalProfit,
      COALESCE(AVG(amount), 0) AS avgProfit,
      COALESCE(MAX(amount), 0) AS bestProfit
     FROM payment_requests
     WHERE worker_user_id = ? AND status = 'approved'`,
    workerUserId,
  );

  await db.run(
    `UPDATE users
     SET total_profit = ?, avg_profit = ?, best_profit = ?
     WHERE id = ?`,
    row?.totalProfit ?? 0,
    row?.avgProfit ?? 0,
    row?.bestProfit ?? 0,
    workerUserId,
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
    `INSERT INTO payment_requests (user_id, worker_user_id, amount, receipt_file_id, comment, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
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

    await db.run(
      `UPDATE payment_requests
       SET status = 'approved', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      adminUserId,
      requestId,
    );
    await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", request.amount, request.user_id);
    if (request.worker_user_id) {
      await refreshWorkerProfitStats(db, request.worker_user_id);
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
