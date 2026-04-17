import { config } from "../config/env";
import { getServicebotTelegram } from "./bot-clients.service";
import { formatDateTime } from "../utils/date";
import { escapeHtml } from "../utils/text";

type AuditPayload = {
  telegramId: number;
  username?: string | null;
  action: string;
  details?: string;
};

export async function sendServicebotAuditEvent(payload: AuditPayload) {
  if (!config.adminAuditChatId) {
    return;
  }

  const lines = [
    "<b>📍 Honey Bunny Audit</b>",
    `User: <code>${payload.telegramId}</code>${payload.username ? ` (@${escapeHtml(payload.username)})` : ""}`,
    `Action: ${escapeHtml(payload.action)}`,
    payload.details ? `Details: ${escapeHtml(payload.details)}` : undefined,
    `Time: ${escapeHtml(formatDateTime(new Date()))}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await getServicebotTelegram().sendMessage(config.adminAuditChatId, lines, {
      parse_mode: "HTML",
    });
  } catch {
    // ignore audit delivery errors
  }
}
