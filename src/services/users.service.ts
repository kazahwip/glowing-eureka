import { config } from "../config/env";
import { getDb } from "../db/client";
import type { User, UserRole, WorkerSignalCategory } from "../types/entities";

interface TelegramUserPayload {
  telegramId: number;
  username?: string;
  firstName?: string;
}

const WORKER_SIGNAL_COLUMN_MAP = {
  referrals: "signal_new_referrals",
  navigation: "signal_navigation",
  search: "signal_search",
  payments: "signal_payments",
  bookings: "signal_bookings",
} as const satisfies Record<WorkerSignalCategory, keyof User>;

type WorkerSignalColumn = (typeof WORKER_SIGNAL_COLUMN_MAP)[WorkerSignalCategory];

function getBaseRole(telegramId: number) {
  return config.adminTelegramIds.includes(telegramId) ? "admin" : "worker";
}

function getNextTeambotRole(currentRole: UserRole, telegramId: number) {
  const baseRole = getBaseRole(telegramId);
  if (baseRole === "admin") {
    return "admin";
  }

  return currentRole === "client" ? baseRole : currentRole;
}

function getNextServicebotRole(currentRole: UserRole, telegramId: number) {
  if (config.adminTelegramIds.includes(telegramId)) {
    return "admin";
  }

  return currentRole;
}

export function getWorkerSignalColumnName(category: WorkerSignalCategory) {
  return WORKER_SIGNAL_COLUMN_MAP[category];
}

export function isWorkerSignalEnabled(user: Pick<User, WorkerSignalColumn>, category: WorkerSignalCategory) {
  return user[WORKER_SIGNAL_COLUMN_MAP[category]] === 1;
}

export async function getUserByTelegramId(telegramId: number) {
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE telegram_id = ?", telegramId);
}

export async function getUserByUsername(username: string) {
  const normalized = username.trim().replace(/^@+/, "");
  if (!normalized) {
    return null;
  }

  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE username IS NOT NULL AND LOWER(username) = LOWER(?)", normalized);
}

function generateFriendCodeValue() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let index = 0; index < 8; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE id = ?", userId);
}

export async function getUserByFriendCode(friendCode: string) {
  const normalized = friendCode.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const db = await getDb();
  return db.get<User>("SELECT * FROM users WHERE friend_code = ?", normalized);
}

export async function ensureUserFriendCode(userId: number) {
  const db = await getDb();
  const existing = await getUserById(userId);
  if (!existing) {
    return null;
  }

  if (existing.friend_code) {
    return existing.friend_code;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const nextCode = generateFriendCodeValue();
    try {
      await db.run("UPDATE users SET friend_code = ? WHERE id = ? AND friend_code IS NULL", nextCode, userId);
      const updated = await getUserById(userId);
      if (updated?.friend_code) {
        return updated.friend_code;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Не удалось сгенерировать уникальный friend code.");
}

export async function registerTeambotUser(payload: TelegramUserPayload) {
  const db = await getDb();
  const existing = await getUserByTelegramId(payload.telegramId);
  const nextRole = getNextTeambotRole(existing?.role ?? "client", payload.telegramId);

  await db.run(
    `INSERT INTO users (telegram_id, username, first_name, role, status, has_worker_access)
     VALUES (?, ?, ?, ?, 'active', 1)
     ON CONFLICT(telegram_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       role = ?,
       has_worker_access = 1`,
    payload.telegramId,
    payload.username ?? null,
    payload.firstName ?? null,
    nextRole,
    nextRole,
  );

  return getUserByTelegramId(payload.telegramId);
}

export async function registerServicebotUser(payload: TelegramUserPayload) {
  const db = await getDb();
  const existing = await getUserByTelegramId(payload.telegramId);
  const nextRole = getNextServicebotRole(existing?.role ?? "client", payload.telegramId);
  const nextWorkerAccess = existing?.has_worker_access ?? 0;

  await db.run(
    `INSERT INTO users (telegram_id, username, first_name, role, status, has_worker_access)
     VALUES (?, ?, ?, ?, 'active', ?)
     ON CONFLICT(telegram_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       role = ?,
       has_worker_access = ?`,
    payload.telegramId,
    payload.username ?? null,
    payload.firstName ?? null,
    nextRole,
    nextWorkerAccess,
    nextRole,
    nextWorkerAccess,
  );

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

export async function activateUserFriendCode(userId: number, friendCode: string) {
  const user = await getUserById(userId);
  if (!user) {
    return { status: "missing_user" as const, user: null, worker: null };
  }

  if (user.referred_by_user_id) {
    return { status: "already_assigned" as const, user, worker: null };
  }

  const worker = await getUserByFriendCode(friendCode);
  if (!worker || !["worker", "admin", "curator"].includes(worker.role)) {
    return { status: "invalid_code" as const, user, worker: null };
  }

  if (worker.id === user.id) {
    return { status: "self_assign" as const, user, worker };
  }

  const updated = await setUserReferrer(user.id, worker.id);
  return { status: "activated" as const, user: updated, worker };
}

export async function incrementUserBalance(userId: number, amount: number) {
  const db = await getDb();
  await db.run("UPDATE users SET balance = balance + ? WHERE id = ?", amount, userId);
  return getUserById(userId);
}

export async function updateUserPayoutDetails(userId: number, payoutDetails: string) {
  const db = await getDb();
  await db.run("UPDATE users SET payout_details = ? WHERE id = ?", payoutDetails.trim() || null, userId);
  return getUserById(userId);
}

export async function updateUserWithdrawableBalance(userId: number, amount: number) {
  const db = await getDb();
  const nextAmount = Math.max(0, Math.round(amount * 100) / 100);
  await db.run("UPDATE users SET withdrawable_balance = ? WHERE id = ?", nextAmount, userId);
  return getUserById(userId);
}

export async function updateUserManualProfitMetrics(userId: number, totalCount: number, totalAmount: number) {
  const db = await getDb();
  const base = await db.get<{ totalCount: number; totalAmount: number; bestAmount: number }>(
    `SELECT
       COUNT(*) AS totalCount,
       ROUND(COALESCE(SUM(share_amount), 0), 2) AS totalAmount,
       ROUND(COALESCE(MAX(share_amount), 0), 2) AS bestAmount
     FROM (
       SELECT worker_share_amount AS share_amount
       FROM payment_requests
       WHERE worker_user_id = ? AND status = 'approved' AND worker_share_amount > 0
       UNION ALL
       SELECT curator_share_amount AS share_amount
       FROM payment_requests
       WHERE curator_user_id = ? AND status = 'approved' AND curator_share_amount > 0
     )`,
    userId,
    userId,
  );

  const safeCount = Math.max(0, Math.floor(totalCount));
  const safeAmount = Math.max(0, Math.round(totalAmount * 100) / 100);
  const manualCount = Math.max(0, safeCount - (base?.totalCount ?? 0));
  const manualAmount = Math.max(0, Math.round((safeAmount - (base?.totalAmount ?? 0)) * 100) / 100);
  const avgProfit = safeCount > 0 ? Math.round((safeAmount / safeCount) * 100) / 100 : 0;
  const bestProfit = Math.max(base?.bestAmount ?? 0, avgProfit);

  await db.run(
    `UPDATE users
     SET manual_profit_count = ?,
         manual_profit_amount = ?,
         withdrawable_balance = ?,
         total_profit = ?,
         avg_profit = ?,
         best_profit = ?
     WHERE id = ?`,
    manualCount,
    manualAmount,
    safeAmount,
    safeAmount,
    avgProfit,
    bestProfit,
    userId,
  );

  return getUserById(userId);
}

export async function updateWorkerSignalSetting(userId: number, category: WorkerSignalCategory, enabled: boolean) {
  const db = await getDb();
  const column = getWorkerSignalColumnName(category);
  await db.run(`UPDATE users SET ${column} = ? WHERE id = ?`, enabled ? 1 : 0, userId);
  return getUserById(userId);
}

export async function searchUsers(query: string) {
  const db = await getDb();
  const normalized = query.trim();
  const usernameQuery = normalized.replace(/^@+/, "");
  const numeric = Number(normalized);

  if (Number.isInteger(numeric) && numeric > 0) {
    return db.all<User[]>(
      `SELECT *
       FROM users
       WHERE telegram_id = ? OR id = ? OR CAST(telegram_id AS TEXT) LIKE ? OR CAST(id AS TEXT) LIKE ?
       ORDER BY created_at DESC
       LIMIT 20`,
      numeric,
      numeric,
      `%${normalized}%`,
      `%${normalized}%`,
    );
  }

  return db.all<User[]>(
    `SELECT *
     FROM users
     WHERE (username IS NOT NULL AND LOWER(username) LIKE LOWER(?))
        OR (first_name IS NOT NULL AND LOWER(first_name) LIKE LOWER(?))
        OR CAST(telegram_id AS TEXT) LIKE ?
        OR CAST(id AS TEXT) LIKE ?
     ORDER BY created_at DESC
     LIMIT 20`,
    `%${usernameQuery}%`,
    `%${normalized}%`,
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
