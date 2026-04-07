"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseReferralPayload = parseReferralPayload;
exports.buildServicebotReferralLink = buildServicebotReferralLink;
exports.assignReferralOwner = assignReferralOwner;
exports.notifyWorkerAboutClientAction = notifyWorkerAboutClientAction;
const text_1 = require("../utils/text");
const bot_clients_service_1 = require("./bot-clients.service");
const clients_service_1 = require("./clients.service");
const users_service_1 = require("./users.service");
function parseReferralPayload(payload) {
    if (!payload) {
        return null;
    }
    const match = payload.trim().match(/^ref_(\d+)$/);
    if (!match) {
        return null;
    }
    const workerUserId = Number(match[1]);
    return Number.isInteger(workerUserId) && workerUserId > 0 ? workerUserId : null;
}
function buildServicebotReferralLink(workerUserId, servicebotUsername) {
    if (!servicebotUsername) {
        return null;
    }
    return `https://t.me/${servicebotUsername}?start=ref_${workerUserId}`;
}
async function assignReferralOwner(user, workerUserId) {
    if (user.id === workerUserId) {
        return user;
    }
    const worker = await (0, users_service_1.getUserById)(workerUserId);
    if (!worker) {
        return user;
    }
    if (user.referred_by_user_id && user.referred_by_user_id !== workerUserId) {
        await (0, clients_service_1.linkClientToWorker)(user.referred_by_user_id, user.telegram_id, user.username ?? undefined);
        return user;
    }
    if (!user.referred_by_user_id) {
        const updated = await (0, users_service_1.setUserReferrer)(user.id, workerUserId);
        if (updated) {
            user = updated;
        }
    }
    await (0, clients_service_1.linkClientToWorker)(workerUserId, user.telegram_id, user.username ?? undefined);
    return user;
}
async function notifyWorkerAboutClientAction(workerUserId, payload) {
    const worker = await (0, users_service_1.getUserById)(workerUserId);
    if (!worker || !(0, users_service_1.isWorkerSignalEnabled)(worker, payload.category)) {
        return;
    }
    const clientLabel = `<code>${payload.clientTelegramId}</code>${payload.clientUsername ? ` (@${(0, text_1.escapeHtml)(payload.clientUsername)})` : ""}`;
    const lines = ["<b>🐘 Сигнал по мамонту</b>", `Мамонт: ${clientLabel}`, `Действие: ${(0, text_1.escapeHtml)(payload.action)}`];
    if (payload.details) {
        lines.push(`Детали: ${(0, text_1.escapeHtml)(payload.details)}`);
    }
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(worker.telegram_id, lines.join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
