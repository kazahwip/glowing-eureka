"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentRequest = createPaymentRequest;
exports.createWebappPaymentRequest = createWebappPaymentRequest;
exports.attachWebappPaymentReceipt = attachWebappPaymentReceipt;
exports.getPaymentRequestById = getPaymentRequestById;
exports.getPaymentRequestWithUser = getPaymentRequestWithUser;
exports.getPaymentRequestMediaInput = getPaymentRequestMediaInput;
exports.approvePaymentRequest = approvePaymentRequest;
exports.rejectPaymentRequest = rejectPaymentRequest;
exports.createManualProfit = createManualProfit;
const client_1 = require("../db/client");
const media_service_1 = require("./media.service");
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
async function resolveProfitShares(db, workerUserId, amount) {
    if (!workerUserId) {
        return {
            workerShareAmount: 0,
            curatorUserId: null,
            curatorShareAmount: 0,
        };
    }
    const worker = await db.get("SELECT role FROM users WHERE id = ?", workerUserId);
    if (worker?.role === "admin") {
        return {
            workerShareAmount: roundMoney(amount),
            curatorUserId: null,
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
async function refreshUserProfitStats(db, userId) {
    const row = await db.get(`SELECT
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
     )`, userId, userId);
    const manual = await db.get("SELECT manual_profit_count, manual_profit_amount FROM users WHERE id = ?", userId);
    const totalCount = (row?.totalCount ?? 0) + (manual?.manual_profit_count ?? 0);
    const totalProfit = roundMoney((row?.totalProfit ?? 0) + (manual?.manual_profit_amount ?? 0));
    const avgProfit = totalCount > 0 ? roundMoney(totalProfit / totalCount) : 0;
    const bestProfit = Math.max(row?.bestProfit ?? 0, avgProfit);
    await db.run(`UPDATE users
     SET withdrawable_balance = ?, total_profit = ?, avg_profit = ?, best_profit = ?
     WHERE id = ?`, totalProfit, totalProfit, avgProfit, bestProfit, userId);
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
       receipt_kind,
       receipt_path,
       receipt_file_id,
       comment,
       source,
       status
     )
     VALUES (?, ?, 0, NULL, 0, ?, 'telegram', NULL, ?, ?, 'honeybunny', 'pending')`, userId, workerUserId ?? null, amount, receiptFileId, comment?.trim() || null);
    return getPaymentRequestById(Number(result.lastID));
}
async function createWebappPaymentRequest(userId, amount, workerUserId) {
    const db = await (0, client_1.getDb)();
    const result = await db.run(`INSERT INTO payment_requests (
       user_id,
       worker_user_id,
       worker_share_amount,
       curator_user_id,
       curator_share_amount,
       amount,
       receipt_kind,
       receipt_path,
       receipt_file_id,
       comment,
       source,
       status
     )
     VALUES (?, ?, 0, NULL, 0, ?, 'pending', NULL, '', NULL, 'honeybunny', 'pending')`, userId, workerUserId ?? null, amount);
    return getPaymentRequestById(Number(result.lastID));
}
async function attachWebappPaymentReceipt(requestId, receiptPath, comment) {
    const db = await (0, client_1.getDb)();
    const request = await getPaymentRequestById(requestId);
    if (!request || request.status !== "pending") {
        return null;
    }
    await db.run(`UPDATE payment_requests
     SET receipt_kind = 'local',
         receipt_path = ?,
         receipt_file_id = '',
         comment = COALESCE(?, comment)
     WHERE id = ?`, receiptPath, comment?.trim() || null, requestId);
    return getPaymentRequestWithUser(requestId);
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
function getPaymentRequestMediaInput(request) {
    if (request.receipt_kind === "local" && request.receipt_path) {
        const localReference = (0, media_service_1.isLocalMediaReference)(request.receipt_path) ? request.receipt_path : `local:${request.receipt_path}`;
        return (0, media_service_1.mediaInputFromReference)(localReference);
    }
    if (request.receipt_file_id) {
        return (0, media_service_1.mediaInputFromReference)(request.receipt_file_id) ?? request.receipt_file_id;
    }
    return null;
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
        const { workerShareAmount, curatorUserId, curatorShareAmount } = await resolveProfitShares(db, request.worker_user_id, request.amount);
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
async function createManualProfit(adminUserId, workerUserId, amount, comment, source = "direct_transfer") {
    const db = await (0, client_1.getDb)();
    await db.exec("BEGIN");
    try {
        const worker = await db.get("SELECT id FROM users WHERE id = ?", workerUserId);
        if (!worker) {
            await db.exec("ROLLBACK");
            return { status: "worker_missing", request: null };
        }
        const { workerShareAmount, curatorUserId, curatorShareAmount } = await resolveProfitShares(db, workerUserId, amount);
        const result = await db.run(`INSERT INTO payment_requests (
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, CURRENT_TIMESTAMP)`, workerUserId, workerUserId, workerShareAmount, curatorUserId, curatorShareAmount, amount, '__manual_profit__', comment?.trim() || null, source, adminUserId);
        await refreshUserProfitStats(db, workerUserId);
        if (curatorUserId) {
            await refreshUserProfitStats(db, curatorUserId);
        }
        await db.exec("COMMIT");
        return {
            status: "created",
            request: await getPaymentRequestWithUser(Number(result.lastID)),
        };
    }
    catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
