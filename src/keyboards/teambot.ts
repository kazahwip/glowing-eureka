import { Markup } from "telegraf";
import { BACK_BUTTON, TEAM_CHAT_URL, TEAMBOT_MAIN_MENU } from "../config/constants";
import type { Curator, User, WorkerSignalCategory } from "../types/entities";

export const TEAM_WORK_BUTTONS = {
  createCard: "📝 Создать карточку",
  referral: "🔗 Моя рефка",
  withdraw: "💸 Заявка на вывод",
  settings: "⚙️ Настройки",
  back: "⬅️ Назад",
} as const;

function signalButtonLabel(enabled: number, title: string) {
  return `${enabled ? "✅" : "❌"} ${title}`;
}

export function teambotMainMenuKeyboard() {
  return Markup.keyboard([
    [TEAMBOT_MAIN_MENU[0], TEAMBOT_MAIN_MENU[1]],
    [TEAMBOT_MAIN_MENU[2], TEAMBOT_MAIN_MENU[3]],
    [TEAMBOT_MAIN_MENU[4], TEAMBOT_MAIN_MENU[5]],
  ]).resize();
}

export function teambotMainMenuInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[0], "team:menu:work"),
      Markup.button.callback(TEAMBOT_MAIN_MENU[1], "team:menu:withdraw"),
    ],
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[2], "team:menu:transfer"),
      Markup.button.callback(TEAMBOT_MAIN_MENU[3], "team:menu:profile"),
    ],
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[4], "team:menu:curators"),
      Markup.button.callback(TEAMBOT_MAIN_MENU[5], "team:menu:project"),
    ],
    [Markup.button.url("💬 Чат", TEAM_CHAT_URL)],
  ]);
}

export function teamWorkKeyboard() {
  return Markup.keyboard([
    [TEAM_WORK_BUTTONS.createCard, TEAM_WORK_BUTTONS.referral],
    [TEAM_WORK_BUTTONS.settings],
    [TEAM_WORK_BUTTONS.back],
  ]).resize();
}

export function withdrawRequestKeyboard(canCreate: boolean) {
  const rows = [];

  if (canCreate) {
    rows.push([Markup.button.callback("📝 Создать заявку", "team:withdraw:create")]);
  }

  rows.push([Markup.button.callback("💳 Реквизиты для выплаты", "team:withdraw:payout-details")]);
  rows.push([Markup.button.callback("💸 Сообщить о профите", "team:profit-report:create")]);

  rows.push(
    [Markup.button.callback("🔄 Обновить", "team:withdraw:refresh")],
    [Markup.button.callback("⬅️ Назад", "team:withdraw:back")],
  );

  return Markup.inlineKeyboard(rows);
}

export function teambotBackKeyboard() {
  return Markup.keyboard([[BACK_BUTTON]]).resize();
}

export function workerSignalSettingsKeyboard(user: Pick<User, "signal_new_referrals" | "signal_navigation" | "signal_search" | "signal_payments" | "signal_bookings">) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(signalButtonLabel(user.signal_new_referrals, "Новые мамонты"), "team:signals:toggle:referrals")],
    [Markup.button.callback(signalButtonLabel(user.signal_navigation, "Навигация по боту"), "team:signals:toggle:navigation")],
    [Markup.button.callback(signalButtonLabel(user.signal_search, "Города и анкеты"), "team:signals:toggle:search")],
    [Markup.button.callback(signalButtonLabel(user.signal_payments, "Пополнения и оплата"), "team:signals:toggle:payments")],
    [Markup.button.callback(signalButtonLabel(user.signal_bookings, "Предзаказы"), "team:signals:toggle:bookings")],
    [Markup.button.callback("⬅️ Назад", "team:settings:back")],
  ]);
}

export function curatorDirectoryKeyboard(curators: Curator[], assignedCuratorId?: number | null, includeBack = false) {
  const rows = curators.flatMap((curator) => {
    const row = [];

    if (curator.telegram_username) {
      row.push(Markup.button.url(`👤 ${curator.name}`, `https://t.me/${curator.telegram_username}`));
    } else {
      row.push(Markup.button.callback(`👤 ${curator.name}`, "team:curator:noop"));
    }

    if (assignedCuratorId === curator.id) {
      row.push(Markup.button.callback("✅ Назначен", "team:curator:assigned"));
    } else {
      row.push(Markup.button.callback("📨 Запрос", `team:curator:request:${curator.id}`));
    }

    return [row];
  });

  if (includeBack) {
    rows.push([Markup.button.callback("⬅️ Назад", "team:curators:back")]);
  }

  return Markup.inlineKeyboard(rows);
}

export function curatorRequestDecisionKeyboard(requestId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Принять", `team:curator-request:${requestId}:accept`),
      Markup.button.callback("❌ Отклонить", `team:curator-request:${requestId}:reject`),
    ],
  ]);
}
