import { createManualProfit } from "./payment-requests.service";
import { getDb } from "../db/client";
import type { ProfitReport, ProfitSource } from "../types/entities";

export interface ProfitReportWithUser extends ProfitReport {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export async function createProfitReport(userId: number, amount: number) {
  const db = await getDb();
  const roundedAmount = roundMoney(amount);

  if (!roundedAmount || roundedAmount <= 0) {
    return { status: "invalid_amount" as const, request: null };
  }

  const result = await db.run(
    `INSERT INTO profit_reports (user_id, amount, payout_details, status)
     VALUES (?, ?, ?, 'pending')`,
    userId,
    roundedAmount,
    "",
  );

  return {
    status: "created" as const,
    request: await getProfitReportWithUser(Number(result.lastID)),
  };
}

export async function getProfitReportById(requestId: number) {
  const db = await getDb();
  return db.get<ProfitReport>("SELECT * FROM profit_reports WHERE id = ?", requestId);
}

export async function getProfitReportWithUser(requestId: number) {
  const db = await getDb();
  return db.get<ProfitReportWithUser>(
    `SELECT
      profit_reports.*,
      users.telegram_id,
      users.username,
      users.first_name
     FROM profit_reports
     JOIN users ON users.id = profit_reports.user_id
     WHERE profit_reports.id = ?`,
    requestId,
  );
}

export async function approveProfitReport(requestId: number, adminUserId: number, source: ProfitSource) {
  const db = await getDb();
  const request = await db.get<ProfitReport>("SELECT * FROM profit_reports WHERE id = ?", requestId);
  if (!request) {
    return { status: "missing" as const, request: null, paymentRequest: null };
  }

  if (request.status !== "pending") {
    return { status: "processed" as const, request: await getProfitReportWithUser(requestId), paymentRequest: null };
  }

  const profit = await createManualProfit(adminUserId, request.user_id, request.amount, request.payout_details, source);
  if (profit.status !== "created" || !profit.request) {
    return { status: "failed" as const, request: await getProfitReportWithUser(requestId), paymentRequest: null };
  }

  await db.run(
    `UPDATE profit_reports
     SET status = 'approved',
         source = ?,
         payment_request_id = ?,
         admin_user_id = ?,
         reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    source,
    profit.request.id,
    adminUserId,
    requestId,
  );

  return {
    status: "approved" as const,
    request: await getProfitReportWithUser(requestId),
    paymentRequest: profit.request,
  };
}

export async function rejectProfitReport(requestId: number, adminUserId: number) {
  const db = await getDb();
  const request = await db.get<ProfitReport>("SELECT * FROM profit_reports WHERE id = ?", requestId);
  if (!request) {
    return { status: "missing" as const, request: null };
  }

  if (request.status !== "pending") {
    return { status: "processed" as const, request: await getProfitReportWithUser(requestId) };
  }

  await db.run(
    `UPDATE profit_reports
     SET status = 'rejected', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    adminUserId,
    requestId,
  );

  return { status: "rejected" as const, request: await getProfitReportWithUser(requestId) };
}
