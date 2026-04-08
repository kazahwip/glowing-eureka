import { getTeambotTelegram } from "./bot-clients.service";
import { getWorkerChatId } from "./settings.service";
import { getUserById } from "./users.service";
import type { PaymentRequest, ProfitSource } from "../types/entities";
import { escapeHtml, formatMoney, formatUserLabel } from "../utils/text";

export interface ProfitNotificationPayload
  extends Pick<PaymentRequest, "amount" | "worker_user_id" | "worker_share_amount" | "curator_user_id" | "curator_share_amount" | "source"> {}

export function getProfitSourceLabel(source: ProfitSource) {
  return source === "direct_transfer" ? "Прямой перевод" : "HonneyBunny";
}

export async function notifyWorkerChatAboutProfit(payload: ProfitNotificationPayload) {
  const workerChatId = await getWorkerChatId();
  if (!workerChatId) {
    return;
  }

  const worker = payload.worker_user_id ? await getUserById(payload.worker_user_id) : null;
  const curator = payload.curator_user_id ? await getUserById(payload.curator_user_id) : null;
  const workerLabel = worker ? escapeHtml(formatUserLabel(worker)) : "не назначен";

  const lines = [
    "<b>🔥 Payments</b>",
    `🐺 Профит у ${workerLabel}`,
    `├ Сервис: ${escapeHtml(getProfitSourceLabel(payload.source))}`,
    `├ Сумма оплаты: ${formatMoney(payload.amount)}`,
    `├ Доля воркера: ${formatMoney(payload.worker_share_amount)}`,
    curator
      ? `└ Доля куратора (${escapeHtml(formatUserLabel(curator))}): ${formatMoney(payload.curator_share_amount)}`
      : "└ Доля куратора: 0 RUB",
  ];

  try {
    await getTeambotTelegram().sendMessage(workerChatId, lines.join("\n"), { parse_mode: "HTML" });
  } catch {
    // ignore delivery errors
  }
}
