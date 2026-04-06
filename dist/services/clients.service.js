"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkClientToWorker = linkClientToWorker;
exports.listWorkerClients = listWorkerClients;
exports.searchWorkerClients = searchWorkerClients;
exports.getWorkerClientsStats = getWorkerClientsStats;
const client_1 = require("../db/client");
async function linkClientToWorker(workerUserId, telegramId, username) {
    const db = await (0, client_1.getDb)();
    await db.run("DELETE FROM clients WHERE telegram_id = ? AND worker_user_id != ?", telegramId, workerUserId);
    await db.run(`INSERT INTO clients (worker_user_id, telegram_id, username)
     VALUES (?, ?, ?)
     ON CONFLICT(worker_user_id, telegram_id) DO UPDATE SET username = excluded.username`, workerUserId, telegramId, username ?? null);
}
async function listWorkerClients(workerUserId) {
    const db = await (0, client_1.getDb)();
    return db.all("SELECT * FROM clients WHERE worker_user_id = ? ORDER BY created_at DESC LIMIT 50", workerUserId);
}
async function searchWorkerClients(workerUserId, query) {
    const db = await (0, client_1.getDb)();
    const normalized = query.trim();
    const numeric = Number(normalized);
    if (Number.isInteger(numeric) && numeric > 0) {
        return db.all("SELECT * FROM clients WHERE worker_user_id = ? AND telegram_id = ? ORDER BY created_at DESC", workerUserId, numeric);
    }
    return db.all("SELECT * FROM clients WHERE worker_user_id = ? AND username LIKE ? ORDER BY created_at DESC", workerUserId, `%${normalized}%`);
}
async function getWorkerClientsStats(workerUserId) {
    const db = await (0, client_1.getDb)();
    const row = await db.get("SELECT COUNT(*) AS total FROM clients WHERE worker_user_id = ?", workerUserId);
    return { total: row?.total ?? 0 };
}
