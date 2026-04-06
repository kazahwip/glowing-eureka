import { getDb } from "../db/client";
import type { AdminLog, ErrorLog } from "../types/entities";

export async function logAdminAction(adminUserId: number, action: string, details?: string) {
  const db = await getDb();
  await db.run(
    "INSERT INTO admin_logs (admin_user_id, action, details) VALUES (?, ?, ?)",
    adminUserId,
    action,
    details ?? null,
  );
}

export async function logError(botName: string, userTelegramId: number | undefined, error: unknown) {
  const db = await getDb();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;

  await db.run(
    "INSERT INTO error_logs (bot_name, user_telegram_id, message, stack) VALUES (?, ?, ?, ?)",
    botName,
    userTelegramId ?? null,
    message,
    stack,
  );

  process.stderr.write(`[${botName}] ${message}\n`);
}

export async function getRecentAdminLogs(limit = 10) {
  const db = await getDb();
  return db.all<AdminLog[]>("SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ?", limit);
}

export async function getRecentErrorLogs(limit = 10) {
  const db = await getDb();
  return db.all<ErrorLog[]>("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?", limit);
}
