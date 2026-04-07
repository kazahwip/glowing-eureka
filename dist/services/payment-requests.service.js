"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentRequest = createPaymentRequest;
exports.getPaymentRequestById = getPaymentRequestById;
exports.getPaymentRequestWithUser = getPaymentRequestWithUser;
exports.approvePaymentRequest = approvePaymentRequest;
exports.rejectPaymentRequest = rejectPaymentRequest;
const client_1 = require("../db/client");
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
async function resolveCuratorUserId(db, workerUserId) {
    if (!workerUserId) {
        return null;
    }
    const row = await db.get(`SELECT curators.linked_user_id AS curatorUserId
     FROM users
     LEFT JOIN curators ON curators.id = users.curator_id AND curators.is_active = 1
     WHERE users.id = ?`, workerUserId);
    return row?.curatorUserId ?? null;
}
async function refreshUserProfitStats(db, userId) {
    const row = await db.get(`SELECT
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
     )`, userId, userId);
    await db.run(`UPDATE users
     SET withdrawable_balance = ?, total_profit = ?, avg_profit = ?, best_profit = ?
     WHERE id = ?`, row?.totalProfit ?? 0, row?.totalProfit ?? 0, row?.avgProfit ?? 0, row?.bestProfit ?? 0, userId);
}
async function createPaymentRequest(userId, amount, receiptFileId, comment, workerUserId) {
    const db = await (0, client_1.getDb)();
    const result = await db.run(`INSERT INTO payment_requests (
       user_id,
       worker_user_id,
       worker_share_amount,
       curator_user_id,
       curator_share_amount,
       amount,
       receipt_file_id,
       comment,
       status
     )
     VALUES (?, ?, 0, NULL, 0, ?, ?, ?, 'pending')`, userId, workerUserId ?? null, amount, receiptFileId, comment?.trim() || null);
    return getPaymentRequestById(Number(result.lastID));
}
async function getPaymentRequestById(requestId) {
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM payment_requests WHERE id = ?", requestId);
}
async function getPaymentRequestWithUser(requestId) {
    const db = await (0, client_1.getDb)();
    return db.get(`SELECT
      payment_requests.*,
      users.telegram_id,
      users.username,
      users.first_name
     FROM payment_requests
     JOIN users ON users.id = payment_requests.user_id
     WHERE payment_requests.id = ?`, requestId);
}
async function approvePaymentRequest(requestId, adminUserId) {
    const db = await (0, client_1.getDb)();
    await db.exec("BEGIN");
    try {
        const request = await db.get("SELECT * FROM payment_requests WHERE id = ?", requestId);
        if (!request) {
            await db.exec("ROLLBACK");
            return { status: "missing", request: null };
        }
        if (request.status !== "pending") {
            await db.exec("ROLLBACK");
            return { status: "processed", request: await getPaymentRequestWithUser(requestId) };
        }
        const workerShareAmount = request.worker_user_id ? roundMoney(request.amount * 0.25) : 0;
        const curatorUserId = await resolveCuratorUserId(db, request.worker_user_id);
        const curatorShareAmount = curatorUserId ? roundMoney(request.amount * 0.1) : 0;
        await db.run(`UPDATE payment_requests
       SET status = 'approved',
           admin_user_id = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           worker_share_amount = ?,
           curator_user_id = ?,
           curator_share_amount = ?
       WHERE id = ?`, adminUserId, workerShareAmount, curatorUserId, curatorShareAmount, requestId);
        await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", request.amount, request.user_id);
        if (request.worker_user_id) {
            await refreshUserProfitStats(db, request.worker_user_id);
        }
        if (curatorUserId) {
            await refreshUserProfitStats(db, curatorUserId);
        }
        await db.exec("COMMIT");
        return { status: "approved", request: await getPaymentRequestWithUser(requestId) };
    }
    catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
async function rejectPaymentRequest(requestId, adminUserId) {
    const db = await (0, client_1.getDb)();
    const request = await db.get("SELECT * FROM payment_requests WHERE id = ?", requestId);
    if (!request) {
        return { status: "missing", request: null };
    }
    if (request.status !== "pending") {
        return { status: "processed", request: await getPaymentRequestWithUser(requestId) };
    }
    await db.run(`UPDATE payment_requests
     SET status = 'rejected', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`, adminUserId, requestId);
    return { status: "rejected", request: await getPaymentRequestWithUser(requestId) };
}
