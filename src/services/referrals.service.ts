import { getTeambotTelegram } from "./bot-clients.service";
import { linkClientToWorker } from "./clients.service";
import { getUserById, setUserReferrer } from "./users.service";
import type { User } from "../types/entities";
import { escapeHtml } from "../utils/text";

export interface WorkerActionPayload {
  clientTelegramId: number;
  clientUsername?: string | null;
  action: string;
  details?: string;
}

export function parseReferralPayload(payload?: string | null) {
  if (!payload) {
    return null;
  }

  const match = payload.trim().match(/^ref_(\d+)$/);
  if (!match) {
    return null;
  }

  const workerUserId = Number(match[1]);
  return Number.isInteger(workerUserId) && workerUserId > 0 ? workerUserId : null;
}

export function buildServicebotReferralLink(workerUserId: number, servicebotUsername: string | null) {
  if (!servicebotUsername) {
    return null;
  }

  return `https://t.me/${servicebotUsername}?start=ref_${workerUserId}`;
}

export async function assignReferralOwner(user: User, workerUserId: number) {
  if (user.id === workerUserId) {
    return user;
  }

  const worker = await getUserById(workerUserId);
  if (!worker) {
    return user;
  }

  if (user.referred_by_user_id && user.referred_by_user_id !== workerUserId) {
    await linkClientToWorker(user.referred_by_user_id, user.telegram_id, user.username ?? undefined);
    return user;
  }

  if (!user.referred_by_user_id) {
    const updated = await setUserReferrer(user.id, workerUserId);
    if (updated) {
      user = updated;
    }
  }

  await linkClientToWorker(workerUserId, user.telegram_id, user.username ?? undefined);
  return user;
}

export async function notifyWorkerAboutClientAction(workerUserId: number, payload: WorkerActionPayload) {
  const worker = await getUserById(workerUserId);
  if (!worker) {
    return;
  }

  const clientLabel = `<code>${payload.clientTelegramId}</code>${payload.clientUsername ? ` (@${escapeHtml(payload.clientUsername)})` : ""}`;
  const lines = ["<b>🐘 Сигнал по мамонту</b>", `Мамонт: ${clientLabel}`, `Действие: ${escapeHtml(payload.action)}`];

  if (payload.details) {
    lines.push(`Детали: ${escapeHtml(payload.details)}`);
  }

  try {
    await getTeambotTelegram().sendMessage(worker.telegram_id, lines.join("\n"), { parse_mode: "HTML" });
  } catch {
    // ignore delivery errors
  }
}
