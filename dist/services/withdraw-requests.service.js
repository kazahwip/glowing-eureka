"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWithdrawRequest = createWithdrawRequest;
exports.getWithdrawRequestById = getWithdrawRequestById;
exports.getWithdrawRequestWithUser = getWithdrawRequestWithUser;
exports.listRecentWithdrawRequestsByUser = listRecentWithdrawRequestsByUser;
exports.getWithdrawRequestSummary = getWithdrawRequestSummary;
exports.markWithdrawRequestPaid = markWithdrawRequestPaid;
exports.rejectWithdrawRequest = rejectWithdrawRequest;
const client_1 = require("../db/client");
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
async function createWithdrawRequest(userId, amount, payoutDetails, comment) {
    const db = await (0, client_1.getDb)();
    await db.exec("BEGIN");
    try {
        const user = await db.get("SELECT withdrawable_balance FROM users WHERE id = ?", userId);
        if (!user) {
            await db.exec("ROLLBACK");
            return { status: "user_missing", request: null };
        }
        const roundedAmount = roundMoney(amount);
        if (roundedAmount <= 0 || roundedAmount > roundMoney(user.withdrawable_balance)) {
            await db.exec("ROLLBACK");
            return { status: "insufficient_balance", request: null };
        }
        const result = await db.run(`INSERT INTO withdraw_requests (user_id, amount, payout_details, comment, status)
       VALUES (?, ?, ?, ?, 'pending')`, userId, roundedAmount, payoutDetails.trim(), comment?.trim() || null);
        await db.run("UPDATE users SET withdrawable_balance = ROUND(withdrawable_balance - ?, 2) WHERE id = ?", roundedAmount, userId);
        await db.exec("COMMIT");
        return {
            status: "created",
            request: await getWithdrawRequestWithUser(Number(result.lastID)),
        };
    }
    catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
async function getWithdrawRequestById(requestId) {
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM withdraw_requests WHERE id = ?", requestId);
}
async function getWithdrawRequestWithUser(requestId) {
    const db = await (0, client_1.getDb)();
    return db.get(`SELECT
      withdraw_requests.*,
      users.telegram_id,
      users.username,
      users.first_name
     FROM withdraw_requests
     JOIN users ON users.id = withdraw_requests.user_id
     WHERE withdraw_requests.id = ?`, requestId);
}
async function listRecentWithdrawRequestsByUser(userId, limit = 5) {
    const db = await (0, client_1.getDb)();
    return db.all(`SELECT *
     FROM withdraw_requests
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`, userId, limit);
}
async function getWithdrawRequestSummary(userId) {
    const db = await (0, client_1.getDb)();
    const row = await db.get(`SELECT
      SUM(CASE WHEN status IN ('pending', 'approved') THEN 1 ELSE 0 END) AS processingCount,
      ROUND(COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') THEN amount ELSE 0 END), 0), 2) AS processingAmount,
      ROUND(COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0), 2) AS paidAmount
     FROM withdraw_requests
     WHERE user_id = ?`, userId);
    return {
        processingCount: row?.processingCount ?? 0,
        processingAmount: row?.processingAmount ?? 0,
        paidAmount: row?.paidAmount ?? 0,
    };
}
async function markWithdrawRequestPaid(requestId, adminUserId) {
    const db = await (0, client_1.getDb)();
    const request = await db.get("SELECT * FROM withdraw_requests WHERE id = ?", requestId);
    if (!request) {
        return { status: "missing", request: null };
    }
    if (request.status === "paid") {
        return { status: "processed", request: await getWithdrawRequestWithUser(requestId) };
    }
    if (!["pending", "approved"].includes(request.status)) {
        return { status: "processed", request: await getWithdrawRequestWithUser(requestId) };
    }
    await db.run(`UPDATE withdraw_requests
     SET status = 'paid', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`, adminUserId, requestId);
    return { status: "paid", request: await getWithdrawRequestWithUser(requestId) };
}
async function rejectWithdrawRequest(requestId, adminUserId) {
    const db = await (0, client_1.getDb)();
    await db.exec("BEGIN");
    try {
        const request = await db.get("SELECT * FROM withdraw_requests WHERE id = ?", requestId);
        if (!request) {
            await db.exec("ROLLBACK");
            return { status: "missing", request: null };
        }
        if (request.status === "paid") {
            await db.exec("ROLLBACK");
            return { status: "processed", request: await getWithdrawRequestWithUser(requestId) };
        }
        if (!["pending", "approved"].includes(request.status)) {
            await db.exec("ROLLBACK");
            return { status: "processed", request: await getWithdrawRequestWithUser(requestId) };
        }
        await db.run(`UPDATE withdraw_requests
       SET status = 'rejected', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`, adminUserId, requestId);
        await db.run("UPDATE users SET withdrawable_balance = ROUND(withdrawable_balance + ?, 2) WHERE id = ?", request.amount, request.user_id);
        await db.exec("COMMIT");
        return { status: "rejected", request: await getWithdrawRequestWithUser(requestId) };
    }
    catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
