import { getDb } from "../db/client";
import type { ClientLink } from "../types/entities";

export async function linkClientToWorker(workerUserId: number, telegramId: number, username?: string) {
  const db = await getDb();
  await db.run("DELETE FROM clients WHERE telegram_id = ? AND worker_user_id != ?", telegramId, workerUserId);
  await db.run(
    `INSERT INTO clients (worker_user_id, telegram_id, username)
     VALUES (?, ?, ?)
     ON CONFLICT(worker_user_id, telegram_id) DO UPDATE SET username = excluded.username`,
    workerUserId,
    telegramId,
    username ?? null,
  );
}

export async function listWorkerClients(workerUserId: number) {
  const db = await getDb();
  return db.all<ClientLink[]>(
    "SELECT * FROM clients WHERE worker_user_id = ? ORDER BY created_at DESC LIMIT 50",
    workerUserId,
  );
}

export async function searchWorkerClients(workerUserId: number, query: string) {
  const db = await getDb();
  const normalized = query.trim();
  const numeric = Number(normalized);

  if (Number.isInteger(numeric) && numeric > 0) {
    return db.all<ClientLink[]>(
      "SELECT * FROM clients WHERE worker_user_id = ? AND telegram_id = ? ORDER BY created_at DESC",
      workerUserId,
      numeric,
    );
  }

  return db.all<ClientLink[]>(
    "SELECT * FROM clients WHERE worker_user_id = ? AND username LIKE ? ORDER BY created_at DESC",
    workerUserId,
    `%${normalized}%`,
  );
}

export async function getWorkerClientsStats(workerUserId: number) {
  const db = await getDb();
  const row = await db.get<{ total: number }>("SELECT COUNT(*) AS total FROM clients WHERE worker_user_id = ?", workerUserId);
  return { total: row?.total ?? 0 };
}
