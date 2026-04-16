"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClientEvent = createClientEvent;
exports.getWorkerFriendCodeStats = getWorkerFriendCodeStats;
exports.listFriendCodeStats = listFriendCodeStats;
const client_1 = require("../db/client");
const referrals_service_1 = require("./referrals.service");
async function createClientEvent(clientUser, category, eventName, details) {
    if (!clientUser.referred_by_user_id) {
        return null;
    }
    const db = await (0, client_1.getDb)();
    const result = await db.run(`INSERT INTO client_events (client_user_id, worker_user_id, source, category, event_name, details)
     VALUES (?, ?, 'webapp', ?, ?, ?)`, clientUser.id, clientUser.referred_by_user_id, category, eventName, details?.trim() || null);
    await (0, referrals_service_1.notifyWorkerAboutClientAction)(clientUser.referred_by_user_id, {
        clientTelegramId: clientUser.telegram_id,
        clientUsername: clientUser.username,
        category,
        action: eventName,
        details: details?.trim() || undefined,
    });
    return Number(result.lastID);
}
async function getWorkerFriendCodeStats(workerUserId) {
    const db = await (0, client_1.getDb)();
    const row = await db.get(`SELECT
      COUNT(DISTINCT client_user_id) AS linkedClients,
      SUM(CASE WHEN event_name = 'Mini App открыт' THEN 1 ELSE 0 END) AS appOpens,
      SUM(CASE WHEN event_name = 'Открыта карточка модели' THEN 1 ELSE 0 END) AS cardOpens,
      SUM(CASE WHEN event_name = 'Начато пополнение баланса' THEN 1 ELSE 0 END) AS topupStarts,
      SUM(CASE WHEN event_name = 'Чек пополнения отправлен' THEN 1 ELSE 0 END) AS receiptsSent,
      SUM(CASE WHEN event_name = 'Создано бронирование' THEN 1 ELSE 0 END) AS bookings
     FROM client_events
     WHERE worker_user_id = ?`, workerUserId);
    return {
        linkedClients: row?.linkedClients ?? 0,
        appOpens: row?.appOpens ?? 0,
        cardOpens: row?.cardOpens ?? 0,
        topupStarts: row?.topupStarts ?? 0,
        receiptsSent: row?.receiptsSent ?? 0,
        bookings: row?.bookings ?? 0,
    };
}
async function listFriendCodeStats() {
    const db = await (0, client_1.getDb)();
    return db.all(`SELECT
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
     ORDER BY appOpens DESC, bookings DESC, linkedClients DESC, users.created_at DESC`);
}
