import { config } from "../config/env";
import { getDb } from "../db/client";
import type { ProjectStats } from "../types/entities";

export async function getSetting(key: string) {
  const db = await getDb();
  const row = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

export async function getTransferDetails() {
  return (await getSetting("transfer_details")) ?? config.defaultTransferDetails;
}

export async function setTransferDetails(value: string) {
  await setSetting("transfer_details", value);
}

export async function getServicebotUsername() {
  return (await getSetting("servicebot_username")) ?? null;
}

export async function setServicebotUsername(value: string) {
  await setSetting("servicebot_username", value);
}

export async function getWorkerChatId() {
  const value = await getSetting("worker_chat_id");
  if (!value) {
    return null;
  }

  const chatId = Number(value);
  return Number.isFinite(chatId) ? chatId : null;
}

export async function setWorkerChatId(chatId: number) {
  await setSetting("worker_chat_id", String(chatId));
}

export async function getProjectStats(): Promise<ProjectStats> {
  const totalProfits = Number((await getSetting("project_total_profits")) ?? "0");
  const totalProfitAmount = Number((await getSetting("project_total_profit_amount")) ?? "0");
  const payoutPercent = Number((await getSetting("project_payout_percent")) ?? String(config.defaultPayoutPercent));

  return {
    totalProfits,
    totalProfitAmount,
    payoutPercent,
  };
}

export async function setProjectStats(payload: ProjectStats) {
  await setSetting("project_total_profits", String(payload.totalProfits));
  await setSetting("project_total_profit_amount", String(payload.totalProfitAmount));
  await setSetting("project_payout_percent", String(payload.payoutPercent));
}

export async function recalculateProjectStats() {
  const db = await getDb();
  const row = await db.get<{ totalProfitAmount: number; totalProfits: number }>(
    `SELECT
      COALESCE(SUM(amount), 0) AS totalProfitAmount,
      COUNT(*) AS totalProfits
     FROM payment_requests
     WHERE status = 'approved'`,
  );

  const current = await getProjectStats();
  const nextStats: ProjectStats = {
    totalProfits: row?.totalProfits ?? 0,
    totalProfitAmount: row?.totalProfitAmount ?? 0,
    payoutPercent: current.payoutPercent,
  };

  await setProjectStats(nextStats);
  return nextStats;
}
