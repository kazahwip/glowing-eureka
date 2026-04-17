"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendServicebotAuditEvent = sendServicebotAuditEvent;
const env_1 = require("../config/env");
const bot_clients_service_1 = require("./bot-clients.service");
const date_1 = require("../utils/date");
const text_1 = require("../utils/text");
async function sendServicebotAuditEvent(payload) {
    if (!env_1.config.adminAuditChatId) {
        return;
    }
    const lines = [
        "<b>📍 Honey Bunny Audit</b>",
        `User: <code>${payload.telegramId}</code>${payload.username ? ` (@${(0, text_1.escapeHtml)(payload.username)})` : ""}`,
        `Action: ${(0, text_1.escapeHtml)(payload.action)}`,
        payload.details ? `Details: ${(0, text_1.escapeHtml)(payload.details)}` : undefined,
        `Time: ${(0, text_1.escapeHtml)((0, date_1.formatDateTime)(new Date()))}`,
    ]
        .filter(Boolean)
        .join("\n");
    try {
        await (0, bot_clients_service_1.getServicebotTelegram)().sendMessage(env_1.config.adminAuditChatId, lines, {
            parse_mode: "HTML",
        });
    }
    catch {
        // ignore audit delivery errors
    }
}
