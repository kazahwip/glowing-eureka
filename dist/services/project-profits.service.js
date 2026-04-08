"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfitSourceLabel = getProfitSourceLabel;
exports.notifyWorkerChatAboutProfit = notifyWorkerChatAboutProfit;
const bot_clients_service_1 = require("./bot-clients.service");
const settings_service_1 = require("./settings.service");
const users_service_1 = require("./users.service");
const text_1 = require("../utils/text");
function getProfitSourceLabel(source) {
    return source === "direct_transfer" ? "Прямой перевод" : "HonneyBunny";
}
async function notifyWorkerChatAboutProfit(payload) {
    const workerChatId = await (0, settings_service_1.getWorkerChatId)();
    if (!workerChatId) {
        return;
    }
    const worker = payload.worker_user_id ? await (0, users_service_1.getUserById)(payload.worker_user_id) : null;
    const curator = payload.curator_user_id ? await (0, users_service_1.getUserById)(payload.curator_user_id) : null;
    const workerLabel = worker ? (0, text_1.escapeHtml)((0, text_1.formatUserLabel)(worker)) : "не назначен";
    const lines = [
        "<b>🔥 Payments</b>",
        `🐺 Профит у ${workerLabel}`,
        `├ Сервис: ${(0, text_1.escapeHtml)(getProfitSourceLabel(payload.source))}`,
        `├ Сумма оплаты: ${(0, text_1.formatMoney)(payload.amount)}`,
        `├ Доля воркера: ${(0, text_1.formatMoney)(payload.worker_share_amount)}`,
        curator
            ? `└ Доля куратора (${(0, text_1.escapeHtml)((0, text_1.formatUserLabel)(curator))}): ${(0, text_1.formatMoney)(payload.curator_share_amount)}`
            : "└ Доля куратора: 0 RUB",
    ];
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(workerChatId, lines.join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
