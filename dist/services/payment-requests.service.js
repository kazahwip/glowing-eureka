"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentRequest = createPaymentRequest;
exports.getPaymentRequestById = getPaymentRequestById;
exports.getPaymentRequestWithUser = getPaymentRequestWithUser;
exports.approvePaymentRequest = approvePaymentRequest;
exports.rejectPaymentRequest = rejectPaymentRequest;
const client_1 = require("../db/client");
async function refreshWorkerProfitStats(db, workerUserId) {
    const row = await db.get(`SELECT
      COALESCE(SUM(amount), 0) AS totalProfit,
      COALESCE(AVG(amount), 0) AS avgProfit,
      COALESCE(MAX(amount), 0) AS bestProfit
     FROM payment_requests
     WHERE worker_user_id = ? AND status = 'approved'`, workerUserId);
    await db.run(`UPDATE users
     SET total_profit = ?, avg_profit = ?, best_profit = ?
     WHERE id = ?`, row?.totalProfit ?? 0, row?.avgProfit ?? 0, row?.bestProfit ?? 0, workerUserId);
}
async function createPaymentRequest(userId, amount, receiptFileId, comment, workerUserId) {
    const db = await (0, client_1.getDb)();
    const result = await db.run(`INSERT INTO payment_requests (user_id, worker_user_id, amount, receipt_file_id, comment, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`, userId, workerUserId ?? null, amount, receiptFileId, comment?.trim() || null);
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
        await db.run(`UPDATE payment_requests
       SET status = 'approved', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`, adminUserId, requestId);
        await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", request.amount, request.user_id);
        if (request.worker_user_id) {
            await refreshWorkerProfitStats(db, request.worker_user_id);
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
