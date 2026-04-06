"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.getTransferDetails = getTransferDetails;
exports.setTransferDetails = setTransferDetails;
exports.getServicebotUsername = getServicebotUsername;
exports.setServicebotUsername = setServicebotUsername;
exports.getWorkerChatId = getWorkerChatId;
exports.setWorkerChatId = setWorkerChatId;
exports.getProjectStats = getProjectStats;
exports.setProjectStats = setProjectStats;
exports.recalculateProjectStats = recalculateProjectStats;
const env_1 = require("../config/env");
const client_1 = require("../db/client");
async function getSetting(key) {
    const db = await (0, client_1.getDb)();
    const row = await db.get("SELECT value FROM settings WHERE key = ?", key);
    return row?.value ?? null;
}
async function setSetting(key, value) {
    const db = await (0, client_1.getDb)();
    await db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value);
}
async function getTransferDetails() {
    return (await getSetting("transfer_details")) ?? env_1.config.defaultTransferDetails;
}
async function setTransferDetails(value) {
    await setSetting("transfer_details", value);
}
async function getServicebotUsername() {
    return (await getSetting("servicebot_username")) ?? null;
}
async function setServicebotUsername(value) {
    await setSetting("servicebot_username", value);
}
async function getWorkerChatId() {
    const value = await getSetting("worker_chat_id");
    if (!value) {
        return null;
    }
    const chatId = Number(value);
    return Number.isFinite(chatId) ? chatId : null;
}
async function setWorkerChatId(chatId) {
    await setSetting("worker_chat_id", String(chatId));
}
async function getProjectStats() {
    const totalProfits = Number((await getSetting("project_total_profits")) ?? "0");
    const totalProfitAmount = Number((await getSetting("project_total_profit_amount")) ?? "0");
    const payoutPercent = Number((await getSetting("project_payout_percent")) ?? String(env_1.config.defaultPayoutPercent));
    return {
        totalProfits,
        totalProfitAmount,
        payoutPercent,
    };
}
async function setProjectStats(payload) {
    await setSetting("project_total_profits", String(payload.totalProfits));
    await setSetting("project_total_profit_amount", String(payload.totalProfitAmount));
    await setSetting("project_payout_percent", String(payload.payoutPercent));
}
async function recalculateProjectStats() {
    const db = await (0, client_1.getDb)();
    const row = await db.get(`SELECT
      COALESCE(SUM(amount), 0) AS totalProfitAmount,
      COUNT(*) AS totalProfits
     FROM payment_requests
     WHERE status = 'approved'`);
    const current = await getProjectStats();
    const nextStats = {
        totalProfits: row?.totalProfits ?? 0,
        totalProfitAmount: row?.totalProfitAmount ?? 0,
        payoutPercent: current.payoutPercent,
    };
    await setProjectStats(nextStats);
    return nextStats;
}
