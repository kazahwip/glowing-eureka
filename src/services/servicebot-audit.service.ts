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

const ACTION_LABELS: Record<string, string> = {
  "/start": "Открыл Honey Bunny",
  inline_query: "Искал анкету через inline-режим",
  opened_home: "Открыл главное меню",
  opened_catalog: "Открыл каталог",
  opened_club: "Открыл VIP-клуб",
  opened_profile: "Открыл профиль",
  opened_search: "Открыл поиск",
  selected_category: "Выбрал категорию анкет",
  selected_city: "Выбрал город",
  opened_card: "Открыл анкету",
  toggled_favorite: "Изменил избранное",
  opened_prebooking: "Открыл бронирование",
  opened_payment: "Открыл выбор оплаты",
  selected_payment_method: "Выбрал способ оплаты",
  started_topup: "Начал пополнение баланса",
  started_deposit_topup: "Начал пополнение депозита",
  uploaded_topup_receipt: "Отправил чек пополнения",
  opened_review_form: "Открыл форму отзыва",
  opened_support_form: "Открыл форму обращения",
  opened_support: "Открыл поддержку",
  opened_info: "Открыл информацию",
  created_support_ticket: "Создал обращение в поддержку",
  webapp_bootstrap: "Открыл Mini App",
  activated_friend_code: "Активировал код друга",
  opened_profile_webapp: "Открыл профиль в Mini App",
  opened_card_list_webapp: "Открыл список анкет в Mini App",
  opened_card_webapp: "Открыл анкету в Mini App",
  favorited_card_webapp: "Добавил анкету в избранное в Mini App",
  unfavorited_card_webapp: "Убрал анкету из избранного в Mini App",
  created_booking_webapp: "Создал бронирование в Mini App",
  started_topup_webapp: "Начал пополнение в Mini App",
  uploaded_topup_receipt_webapp: "Отправил чек в Mini App",
  submitted_review_webapp: "Отправил отзыв в Mini App",
  created_support_ticket_webapp: "Создал обращение в Mini App",
  opened_info_section_webapp: "Открыл инфо-раздел в Mini App",
};

function getActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatDetails(details?: string) {
  if (!details) {
    return null;
  }

  return details
    .replace(/\bcard_id=/g, "ID анкеты: ")
    .replace(/\brequest_id=/g, "ID заявки: ")
    .replace(/\bticket_id=/g, "ID обращения: ")
    .replace(/\bamount=/g, "Сумма: ")
    .replace(/\bpayment=/g, "Оплата: ")
    .replace(/\bbot_balance\b/g, "баланс бота")
    .replace(/\bcash\b/g, "наличные")
    .replace(/\bgirls\b/g, "девушки")
    .replace(/\bpepper\b/g, "девушки с перчиком")
    .replace(/;/g, "\n");
}

export async function sendServicebotAuditEvent(payload: AuditPayload) {
  if (!config.adminAuditChatId) {
    return;
  }

  const details = formatDetails(payload.details);
  const lines = [
    "<b>🍯 Honey Bunny | лог пользователя</b>",
    `👤 Пользователь: <code>${payload.telegramId}</code>${payload.username ? ` (@${escapeHtml(payload.username)})` : ""}`,
    `📌 Действие: ${escapeHtml(getActionLabel(payload.action))}`,
    details ? `🧾 Детали:\n${escapeHtml(details)}` : undefined,
    `🕒 Время: ${escapeHtml(formatDateTime(new Date()))}`,
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
