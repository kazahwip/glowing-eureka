import { getDb } from "../db/client";
import type { User, WorkerSignalCategory } from "../types/entities";
import { notifyWorkerAboutClientAction } from "./referrals.service";

export async function createClientEvent(
  clientUser: User,
  category: WorkerSignalCategory,
  eventName: string,
  details?: string | null,
) {
  if (!clientUser.referred_by_user_id) {
    return null;
  }

  const db = await getDb();
  const result = await db.run(
    `INSERT INTO client_events (client_user_id, worker_user_id, source, category, event_name, details)
     VALUES (?, ?, 'webapp', ?, ?, ?)`,
    clientUser.id,
    clientUser.referred_by_user_id,
    category,
    eventName,
    details?.trim() || null,
  );

  await notifyWorkerAboutClientAction(clientUser.referred_by_user_id, {
    clientTelegramId: clientUser.telegram_id,
    clientUsername: clientUser.username,
    category,
    action: eventName,
    details: details?.trim() || undefined,
  });

  return Number(result.lastID);
}

export async function getWorkerFriendCodeStats(workerUserId: number) {
  const db = await getDb();
  const row = await db.get<{
    linkedClients: number;
    appOpens: number;
    cardOpens: number;
    topupStarts: number;
    receiptsSent: number;
    bookings: number;
  }>(
    `SELECT
      COUNT(DISTINCT client_user_id) AS linkedClients,
      SUM(CASE WHEN event_name = 'Mini App открыт' THEN 1 ELSE 0 END) AS appOpens,
      SUM(CASE WHEN event_name = 'Открыта карточка модели' THEN 1 ELSE 0 END) AS cardOpens,
      SUM(CASE WHEN event_name = 'Начато пополнение баланса' THEN 1 ELSE 0 END) AS topupStarts,
      SUM(CASE WHEN event_name = 'Чек пополнения отправлен' THEN 1 ELSE 0 END) AS receiptsSent,
      SUM(CASE WHEN event_name = 'Создано бронирование' THEN 1 ELSE 0 END) AS bookings
     FROM client_events
     WHERE worker_user_id = ?`,
    workerUserId,
  );

  return {
    linkedClients: row?.linkedClients ?? 0,
    appOpens: row?.appOpens ?? 0,
    cardOpens: row?.cardOpens ?? 0,
    topupStarts: row?.topupStarts ?? 0,
    receiptsSent: row?.receiptsSent ?? 0,
    bookings: row?.bookings ?? 0,
  };
}

export async function listFriendCodeStats() {
  const db = await getDb();
  return db.all<
    Array<{
      user_id: number;
      telegram_id: number;
      username: string | null;
      first_name: string | null;
      friend_code: string | null;
      linkedClients: number;
      appOpens: number;
      cardOpens: number;
      topupStarts: number;
      receiptsSent: number;
      bookings: number;
    }>
  >(
    `SELECT
      users.id AS user_id,
      users.telegram_id,
      users.username,
      users.first_name,
      users.friend_code,
      COUNT(DISTINCT client_events.client_user_id) AS linkedClients,
      SUM(CASE WHEN client_events.event_name = 'Mini App открыт' THEN 1 ELSE 0 END) AS appOpens,
      SUM(CASE WHEN client_events.event_name = 'Открыта карточка модели' THEN 1 ELSE 0 END) AS cardOpens,
      SUM(CASE WHEN client_events.event_name = 'Начато пополнение баланса' THEN 1 ELSE 0 END) AS topupStarts,
      SUM(CASE WHEN client_events.event_name = 'Чек пополнения отправлен' THEN 1 ELSE 0 END) AS receiptsSent,
      SUM(CASE WHEN client_events.event_name = 'Создано бронирование' THEN 1 ELSE 0 END) AS bookings
     FROM users
     LEFT JOIN client_events ON client_events.worker_user_id = users.id
     WHERE users.role IN ('worker', 'admin', 'curator')
     GROUP BY users.id
     ORDER BY appOpens DESC, bookings DESC, linkedClients DESC, users.created_at DESC`,
  );
}
