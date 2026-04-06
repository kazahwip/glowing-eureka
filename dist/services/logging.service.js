"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminAction = logAdminAction;
exports.logError = logError;
exports.getRecentAdminLogs = getRecentAdminLogs;
exports.getRecentErrorLogs = getRecentErrorLogs;
const client_1 = require("../db/client");
async function logAdminAction(adminUserId, action, details) {
    const db = await (0, client_1.getDb)();
    await db.run("INSERT INTO admin_logs (admin_user_id, action, details) VALUES (?, ?, ?)", adminUserId, action, details ?? null);
}
async function logError(botName, userTelegramId, error) {
    const db = await (0, client_1.getDb)();
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? null : null;
    await db.run("INSERT INTO error_logs (bot_name, user_telegram_id, message, stack) VALUES (?, ?, ?, ?)", botName, userTelegramId ?? null, message, stack);
    process.stderr.write(`[${botName}] ${message}\n`);
}
async function getRecentAdminLogs(limit = 10) {
    const db = await (0, client_1.getDb)();
    return db.all("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ?", limit);
}
async function getRecentErrorLogs(limit = 10) {
    const db = await (0, client_1.getDb)();
    return db.all("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?", limit);
}
