"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProfitReport = createProfitReport;
exports.getProfitReportById = getProfitReportById;
exports.getProfitReportWithUser = getProfitReportWithUser;
exports.approveProfitReport = approveProfitReport;
exports.rejectProfitReport = rejectProfitReport;
const payment_requests_service_1 = require("./payment-requests.service");
const client_1 = require("../db/client");
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
async function createProfitReport(userId, amount) {
    const db = await (0, client_1.getDb)();
    const roundedAmount = roundMoney(amount);
    if (!roundedAmount || roundedAmount <= 0) {
        return { status: "invalid_amount", request: null };
    }
    const result = await db.run(`INSERT INTO profit_reports (user_id, amount, payout_details, status)
     VALUES (?, ?, ?, 'pending')`, userId, roundedAmount, "");
    return {
        status: "created",
        request: await getProfitReportWithUser(Number(result.lastID)),
    };
}
async function getProfitReportById(requestId) {
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM profit_reports WHERE id = ?", requestId);
}
async function getProfitReportWithUser(requestId) {
    const db = await (0, client_1.getDb)();
    return db.get(`SELECT
      profit_reports.*,
      users.telegram_id,
      users.username,
      users.first_name
     FROM profit_reports
     JOIN users ON users.id = profit_reports.user_id
     WHERE profit_reports.id = ?`, requestId);
}
async function approveProfitReport(requestId, adminUserId, source) {
    const db = await (0, client_1.getDb)();
    const request = await db.get("SELECT * FROM profit_reports WHERE id = ?", requestId);
    if (!request) {
        return { status: "missing", request: null, paymentRequest: null };
    }
    if (request.status !== "pending") {
        return { status: "processed", request: await getProfitReportWithUser(requestId), paymentRequest: null };
    }
    const profit = await (0, payment_requests_service_1.createManualProfit)(adminUserId, request.user_id, request.amount, request.payout_details, source);
    if (profit.status !== "created" || !profit.request) {
        return { status: "failed", request: await getProfitReportWithUser(requestId), paymentRequest: null };
    }
    await db.run(`UPDATE profit_reports
     SET status = 'approved',
         source = ?,
         payment_request_id = ?,
         admin_user_id = ?,
         reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`, source, profit.request.id, adminUserId, requestId);
    return {
        status: "approved",
        request: await getProfitReportWithUser(requestId),
        paymentRequest: profit.request,
    };
}
async function rejectProfitReport(requestId, adminUserId) {
    const db = await (0, client_1.getDb)();
    const request = await db.get("SELECT * FROM profit_reports WHERE id = ?", requestId);
    if (!request) {
        return { status: "missing", request: null };
    }
    if (request.status !== "pending") {
        return { status: "processed", request: await getProfitReportWithUser(requestId) };
    }
    await db.run(`UPDATE profit_reports
     SET status = 'rejected', admin_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`, adminUserId, requestId);
    return { status: "rejected", request: await getProfitReportWithUser(requestId) };
}
