import { config } from "../config/env";
import { getDb } from "../db/client";
import type { User, UserRole } from "../types/entities";

interface TelegramUserPayload {
  telegramId: number;
  username?: string;
  firstName?: string;
}

function getBaseRole(telegramId: number) {
  return config.adminTelegramIds.includes(telegramId) ? "admin" : "worker";
}

export async function getUserByTelegramId(telegramId: number) {
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE telegram_id = ?", telegramId);
}

export async function getUserById(userId: number) {
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE id = ?", userId);
}

export async function registerTeambotUser(payload: TelegramUserPayload) {
  const db = await getDb();
  const existing = await getUserByTelegramId(payload.telegramId);

  if (!existing) {
    await db.run(
      `INSERT INTO users (telegram_id, username, first_name, role, status, has_worker_access)
       VALUES (?, ?, ?, ?, 'active', 1)`,
      payload.telegramId,
      payload.username ?? null,
      payload.firstName ?? null,
      getBaseRole(payload.telegramId),
    );
  } else {
    const nextRole = existing.role === "client" ? getBaseRole(payload.telegramId) : existing.role;
    await db.run(
      `UPDATE users
       SET username = ?, first_name = ?, role = ?, has_worker_access = 1
       WHERE telegram_id = ?`,
      payload.username ?? null,
      payload.firstName ?? null,
      nextRole,
      payload.telegramId,
    );
  }

  return getUserByTelegramId(payload.telegramId);
}

export async function registerServicebotUser(payload: TelegramUserPayload) {
  const db = await getDb();
  const existing = await getUserByTelegramId(payload.telegramId);

  if (!existing) {
    await db.run(
      `INSERT INTO users (telegram_id, username, first_name, role, status, has_worker_access)
       VALUES (?, ?, ?, 'client', 'active', 0)`,
      payload.telegramId,
      payload.username ?? null,
      payload.firstName ?? null,
    );
  } else {
    const forcedAdminRole = config.adminTelegramIds.includes(payload.telegramId) ? "admin" : existing.role;
    await db.run(
      `UPDATE users
       SET username = ?, first_name = ?, role = ?
       WHERE telegram_id = ?`,
      payload.username ?? null,
      payload.firstName ?? null,
      forcedAdminRole,
      payload.telegramId,
    );
  }

  return getUserByTelegramId(payload.telegramId);
}

export async function grantWorkerAccess(telegramId: number) {
  const db = await getDb();
  await db.run("UPDATE users SET has_worker_access = 1 WHERE telegram_id = ?", telegramId);
  return getUserByTelegramId(telegramId);
}

export async function setUserReferrer(userId: number, workerUserId: number) {
  const db = await getDb();
  await db.run("UPDATE users SET referred_by_user_id = ? WHERE id = ?", workerUserId, userId);
  return getUserById(userId);
}

export async function incrementUserBalance(userId: number, amount: number) {
  const db = await getDb();
  await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", amount, userId);
  return getUserById(userId);
}

export async function searchUsers(query: string) {
  const db = await getDb();
  const normalized = query.trim();
  const numeric = Number(normalized);

  if (Number.isInteger(numeric) && numeric > 0) {
    return db.all<User[]>(
      "SELECT * FROM users WHERE telegram_id = ? OR id = ? ORDER BY created_at DESC LIMIT 20",
      numeric,
      numeric,
    );
  }

  return db.all<User[]>(
    "SELECT * FROM users WHERE username LIKE ? OR first_name LIKE ? ORDER BY created_at DESC LIMIT 20",
    `%${normalized}%`,
    `%${normalized}%`,
  );
}

export async function listRecentUsers(limit = 10) {
  const db = await getDb();
  return db.all<User[]>("SELECT * FROM users ORDER BY created_at DESC LIMIT ?", limit);
}

export async function setUserRole(userId: number, role: UserRole) {
  const db = await getDb();
  await db.run(
    "UPDATE users SET role = ?, has_worker_access = CASE WHEN ? IN ('worker', 'admin', 'curator') THEN 1 ELSE has_worker_access END WHERE id = ?",
    role,
    role,
    userId,
  );
  return getUserById(userId);
}

export async function setUserBlocked(userId: number, isBlocked: boolean) {
  const db = await getDb();
  await db.run("UPDATE users SET is_blocked = ? WHERE id = ?", isBlocked ? 1 : 0, userId);
  return getUserById(userId);
}

export async function setUserCurator(userId: number, curatorId: number | null) {
  const db = await getDb();
  await db.run("UPDATE users SET curator_id = ? WHERE id = ?", curatorId, userId);
  return getUserById(userId);
}

export async function getUserStatsSummary() {
  const db = await getDb();
  const row = await db.get<{
    totalUsers: number;
    activeWorkers: number;
    totalProfit: number;
    avgProfit: number;
  }>(`SELECT
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

export async function getUsersByRole(role: "all" | "workers" | "clients") {
  const db = await getDb();
  if (role === "all") {
    return db.all<User[]>("SELECT * FROM users WHERE is_blocked = 0");
  }

  if (role === "workers") {
    return db.all<User[]>("SELECT * FROM users WHERE role IN ('worker', 'admin', 'curator') AND is_blocked = 0");
  }

  return db.all<User[]>("SELECT * FROM users WHERE role = 'client' AND is_blocked = 0");
}
