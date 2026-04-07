import { Markup } from "telegraf";
import { BACK_BUTTON, TEAM_CHAT_URL, TEAMBOT_MAIN_MENU } from "../config/constants";
import type { Curator } from "../types/entities";

export const TEAM_WORK_BUTTONS = {
  createCard: "📝 Создать карточку",
  referral: "🔗 Моя рефка",
  withdraw: "💸 Заявка на вывод",
  settings: "⚙️ Настройки",
  back: "⬅️ Назад",
} as const;

export function teambotMainMenuKeyboard() {
  return Markup.keyboard([
    [TEAMBOT_MAIN_MENU[0], TEAMBOT_MAIN_MENU[2]],
    [TEAMBOT_MAIN_MENU[1], TEAMBOT_MAIN_MENU[3]],
    [TEAMBOT_MAIN_MENU[4]],
  ]).resize();
}

export function teambotMainMenuInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[0], "team:menu:work"),
      Markup.button.callback(TEAMBOT_MAIN_MENU[2], "team:menu:profile"),
    ],
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[1], "team:menu:transfer"),
      Markup.button.callback(TEAMBOT_MAIN_MENU[3], "team:menu:curators"),
    ],
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[4], "team:menu:project"),
      Markup.button.url("💬 Чат", TEAM_CHAT_URL),
    ],
  ]);
}

export function teamWorkKeyboard() {
  return Markup.keyboard([
    [TEAM_WORK_BUTTONS.createCard, TEAM_WORK_BUTTONS.referral],
    [TEAM_WORK_BUTTONS.withdraw, TEAM_WORK_BUTTONS.settings],
    [TEAM_WORK_BUTTONS.back],
  ]).resize();
}

export function teambotBackKeyboard() {
  return Markup.keyboard([[BACK_BUTTON]]).resize();
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
