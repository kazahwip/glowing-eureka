"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByTelegramId = getUserByTelegramId;
exports.getUserById = getUserById;
exports.registerTeambotUser = registerTeambotUser;
exports.registerServicebotUser = registerServicebotUser;
exports.grantWorkerAccess = grantWorkerAccess;
exports.setUserReferrer = setUserReferrer;
exports.incrementUserBalance = incrementUserBalance;
exports.searchUsers = searchUsers;
exports.listRecentUsers = listRecentUsers;
exports.setUserRole = setUserRole;
exports.setUserBlocked = setUserBlocked;
exports.setUserCurator = setUserCurator;
exports.getUserStatsSummary = getUserStatsSummary;
exports.getUsersByRole = getUsersByRole;
const env_1 = require("../config/env");
const client_1 = require("../db/client");
function getBaseRole(telegramId) {
    return env_1.config.adminTelegramIds.includes(telegramId) ? "admin" : "worker";
}
async function getUserByTelegramId(telegramId) {
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM users WHERE telegram_id = ?", telegramId);
}
async function getUserById(userId) {
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM users WHERE id = ?", userId);
}
async function registerTeambotUser(payload) {
    const db = await (0, client_1.getDb)();
    const existing = await getUserByTelegramId(payload.telegramId);
    if (!existing) {
        await db.run(`INSERT INTO users (telegram_id, username, first_name, role, status, has_worker_access)
       VALUES (?, ?, ?, ?, 'active', 1)`, payload.telegramId, payload.username ?? null, payload.firstName ?? null, getBaseRole(payload.telegramId));
    }
    else {
        const nextRole = existing.role === "client" ? getBaseRole(payload.telegramId) : existing.role;
        await db.run(`UPDATE users
       SET username = ?, first_name = ?, role = ?, has_worker_access = 1
       WHERE telegram_id = ?`, payload.username ?? null, payload.firstName ?? null, nextRole, payload.telegramId);
    }
    return getUserByTelegramId(payload.telegramId);
}
async function registerServicebotUser(payload) {
    const db = await (0, client_1.getDb)();
    const existing = await getUserByTelegramId(payload.telegramId);
    if (!existing) {
        await db.run(`INSERT INTO users (telegram_id, username, first_name, role, status, has_worker_access)
       VALUES (?, ?, ?, 'client', 'active', 0)`, payload.telegramId, payload.username ?? null, payload.firstName ?? null);
    }
    else {
        const forcedAdminRole = env_1.config.adminTelegramIds.includes(payload.telegramId) ? "admin" : existing.role;
        await db.run(`UPDATE users
       SET username = ?, first_name = ?, role = ?
       WHERE telegram_id = ?`, payload.username ?? null, payload.firstName ?? null, forcedAdminRole, payload.telegramId);
    }
    return getUserByTelegramId(payload.telegramId);
}
async function grantWorkerAccess(telegramId) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE users SET has_worker_access = 1 WHERE telegram_id = ?", telegramId);
    return getUserByTelegramId(telegramId);
}
async function setUserReferrer(userId, workerUserId) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE users SET referred_by_user_id = ? WHERE id = ?", workerUserId, userId);
    return getUserById(userId);
}
async function incrementUserBalance(userId, amount) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", amount, userId);
    return getUserById(userId);
}
async function searchUsers(query) {
    const db = await (0, client_1.getDb)();
    const normalized = query.trim();
    const numeric = Number(normalized);
    if (Number.isInteger(numeric) && numeric > 0) {
        return db.all("SELECT * FROM users WHERE telegram_id = ? OR id = ? ORDER BY created_at DESC LIMIT 20", numeric, numeric);
    }
    return db.all("SELECT * FROM users WHERE username LIKE ? OR first_name LIKE ? ORDER BY created_at DESC LIMIT 20", `%${normalized}%`, `%${normalized}%`);
}
async function listRecentUsers(limit = 10) {
    const db = await (0, client_1.getDb)();
    return db.all("SELECT * FROM users ORDER BY created_at DESC LIMIT ?", limit);
}
async function setUserRole(userId, role) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE users SET role = ?, has_worker_access = CASE WHEN ? IN ('worker', 'admin', 'curator') THEN 1 ELSE has_worker_access END WHERE id = ?", role, role, userId);
    return getUserById(userId);
}
async function setUserBlocked(userId, isBlocked) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE users SET is_blocked = ? WHERE id = ?", isBlocked ? 1 : 0, userId);
    return getUserById(userId);
}
async function setUserCurator(userId, curatorId) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE users SET curator_id = ? WHERE id = ?", curatorId, userId);
    return getUserById(userId);
}
async function getUserStatsSummary() {
    const db = await (0, client_1.getDb)();
    const row = await db.get(`SELECT
      COUNT(*) AS totalUsers,
      SUM(CASE WHEN role IN ('worker', 'admin', 'curator') AND is_blocked = 0 THEN 1 ELSE 0 END) AS activeWorkers,
      COALESCE(SUM(total_profit), 0) AS totalProfit,
      COALESCE(AVG(total_profit), 0) AS avgProfit
    FROM users`);
    return {
        totalUsers: row?.totalUsers ?? 0,
        activeWorkers: row?.activeWorkers ?? 0,
        totalProfit: row?.totalProfit ?? 0,
        avgProfit: row?.avgProfit ?? 0,
    };
}
async function getUsersByRole(role) {
    const db = await (0, client_1.getDb)();
    if (role === "all") {
        return db.all("SELECT * FROM users WHERE is_blocked = 0");
    }
    if (role === "workers") {
        return db.all("SELECT * FROM users WHERE role IN ('worker', 'admin', 'curator') AND is_blocked = 0");
    }
    return db.all("SELECT * FROM users WHERE role = 'client' AND is_blocked = 0");
}
