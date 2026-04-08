import { getDb } from "../db/client";
import type { WithdrawRequest } from "../types/entities";

export interface WithdrawRequestWithUser extends WithdrawRequest {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function createWithdrawRequest(userId: number, amount: number, payoutDetails: string, comment?: string) {
  const db = await getDb();
  await db.exec("BEGIN");

  try {
    const user = await db.get<{ withdrawable_balance: number }>("SELECT withdrawable_balance FROM users WHERE id = ?", userId);
    if (!user) {
      await db.exec("ROLLBACK");
      return { status: "user_missing" as const, request: null };
    }

    const roundedAmount = roundMoney(amount);
    if (roundedAmount <= 0 || roundedAmount > roundMoney(user.withdrawable_balance)) {
      await db.exec("ROLLBACK");
      return { status: "insufficient_balance" as const, request: null };
    }

    const result = await db.run(
      `INSERT INTO withdraw_requests (user_id, amount, payout_details, comment, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      userId,
      roundedAmount,
      payoutDetails.trim(),
      comment?.trim() || null,
    );

    await db.run(
      "UPDATE users SET withdrawable_balance = ROUND(withdrawable_balance - ?, 2) WHERE id = ?",
      roundedAmount,
      userId,
    );

    await db.exec("COMMIT");

    return {
      status: "created" as const,
      request: await getWithdrawRequestWithUser(Number(result.lastID)),
    };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function getWithdrawRequestById(requestId: number) {
  const db = await getDb();
  return db.get<WithdrawRequest>("SELECT * FROM withdraw_requests WHERE id = ?", requestId);
}

export async function getWithdrawRequestWithUser(requestId: number) {
  const db = await getDb();
  return db.get<WithdrawRequestWithUser>(
    `SELECT
      withdraw_requests.*,
      users.telegram_id,
      users.username,
      users.first_name
     FROM withdraw_requests
     JOIN users ON users.id = withdraw_requests.user_id
     WHERE withdraw_requests.id = ?`,
    requestId,
  );
}

export async function listRecentWithdrawRequestsByUser(userId: number, limit = 5) {
  const db = await getDb();
  return db.all<WithdrawRequest[]>(
    `SELECT *
     FROM withdraw_requests
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    userId,
    limit,
  );
}

export async function getWithdrawRequestSummary(userId: number) {
  const db = await getDb();
  const row = await db.get<{
    processingCount: number;
    processingAmount: number;
    paidAmount: number;
  }>(
    `SELECT
      SUM(CASE WHEN status IN ('pending', 'approved') THEN 1 ELSE 0 END) AS processingCount,
      ROUND(COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') THEN amount ELSE 0 END), 0), 2) AS processingAmount,
      ROUND(COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0), 2) AS paidAmount
     FROM withdraw_requests
     WHERE user_id = ?`,
    userId,
  );

  return {
    processingCount: row?.processingCount ?? 0,
    processingAmount: row?.processingAmount ?? 0,
    paidAmount: row?.paidAmount ?? 0,
  };
}

export async function markWithdrawRequestPaid(requestId: number, adminUserId: number) {
  const db = await getDb();
  const request = await db.get<WithdrawRequest>("SELECT * FROM withdraw_requests WHERE id = ?", requestId);
  if (!request) {
    return { status: "missing" as const, request: null };
  }

  if (request.status === "paid") {
    return { status: "processed" as const, request: await getWithdrawRequestWithUser(requestId) };
  }

  if (!["pending", "approved"].includes(request.status)) {
    return { status: "processed" as const, request: await getWithdrawRequestWithUser(requestId) };
  }

  await db.run(
    `UPDATE withdraw_requests
     SET status = 'paid', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    adminUserId,
    requestId,
  );

  return { status: "paid" as const, request: await getWithdrawRequestWithUser(requestId) };
}

export async function rejectWithdrawRequest(requestId: number, adminUserId: number) {
  const db = await getDb();
  await db.exec("BEGIN");

  try {
    const request = await db.get<WithdrawRequest>("SELECT * FROM withdraw_requests WHERE id = ?", requestId);
    if (!request) {
      await db.exec("ROLLBACK");
      return { status: "missing" as const, request: null };
    }

    if (request.status === "paid") {
      await db.exec("ROLLBACK");
      return { status: "processed" as const, request: await getWithdrawRequestWithUser(requestId) };
    }

    if (!["pending", "approved"].includes(request.status)) {
      await db.exec("ROLLBACK");
      return { status: "processed" as const, request: await getWithdrawRequestWithUser(requestId) };
    }

    await db.run(
      `UPDATE withdraw_requests
       SET status = 'rejected', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      adminUserId,
      requestId,
    );
    await db.run(
      "UPDATE users SET withdrawable_balance = ROUND(withdrawable_balance + ?, 2) WHERE id = ?",
      request.amount,
      request.user_id,
    );

    await db.exec("COMMIT");

    return { status: "rejected" as const, request: await getWithdrawRequestWithUser(requestId) };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
