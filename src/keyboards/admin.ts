import { Markup } from "telegraf";
import type { Curator, UserRole } from "../types/entities";

export function adminHomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📊 Общая статистика", "admin:stats")],
    [Markup.button.callback("👥 Пользователи", "admin:users")],
    [Markup.button.callback("🧑‍💼 Кураторы", "admin:curators")],
    [Markup.button.callback("💳 Реквизиты", "admin:transfer")],
    [Markup.button.callback("📈 Статистика проекта", "admin:project-stats")],
    [Markup.button.callback("📣 Рассылка", "admin:broadcast")],
    [Markup.button.callback("🗂 Логи", "admin:logs")],
    [Markup.button.callback("✖️ Закрыть", "admin:close")],
  ]);
}

export function adminUsersKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🕘 Последние пользователи", "admin:users:list")],
    [Markup.button.callback("🔎 Поиск по ID / username", "admin:users:search")],
    [Markup.button.callback("⬅️ Назад", "admin:home")],
  ]);
}

export function adminUserActionsKeyboard(userId: number, isBlocked: boolean, hasCurator: boolean) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🪪 Сменить роль", `admin:user:${userId}:role`)],
    [Markup.button.callback(isBlocked ? "✅ Разблокировать" : "⛔ Заблокировать", `admin:user:${userId}:block`)],
    [
      Markup.button.callback(
        hasCurator ? "➖ Снять куратора" : "➕ Назначить куратора",
        `admin:user:${userId}:${hasCurator ? "remove-curator" : "assign-curator"}`,
      ),
    ],
    [Markup.button.callback("⬅️ Назад", "admin:users")],
  ]);
}

export function adminRoleKeyboard(userId: number) {
  const roles: Array<{ label: string; value: UserRole }> = [
    { label: "🐘 Мамонт", value: "client" },
    { label: "💼 Воркер", value: "worker" },
    { label: "🧑‍💼 Куратор", value: "curator" },
    { label: "🛡 Админ", value: "admin" },
  ];

  return Markup.inlineKeyboard([
    roles.map((role) => Markup.button.callback(role.label, `admin:user:${userId}:set-role:${role.value}`)),
    [Markup.button.callback("⬅️ Назад", `admin:user:${userId}:view`)],
  ]);
}

export function adminCuratorsKeyboard(curators: Curator[]) {
  const rows = curators.map((curator) => [
    Markup.button.callback(`🧑‍💼 ${curator.id}. ${curator.name}`, `admin:curator:view:${curator.id}`),
  ]);

  rows.push(
    [Markup.button.callback("➕ Добавить куратора", "admin:curator:add")],
    [Markup.button.callback("🔗 Назначить пользователю", "admin:curator:assign")],
    [Markup.button.callback("➖ Снять назначение", "admin:curator:unassign")],
    [Markup.button.callback("⬅️ Назад", "admin:home")],
  );

  return Markup.inlineKeyboard(rows);
}

export function adminCuratorActionsKeyboard(curatorId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🗑 Удалить куратора", `admin:curator:delete:${curatorId}`)],
    [Markup.button.callback("⬅️ Назад", "admin:curators")],
  ]);
}

export function adminProjectStatsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✏️ Редактировать вручную", "admin:project-stats:edit")],
    [Markup.button.callback("🔄 Пересчитать из БД", "admin:project-stats:recalc")],
    [Markup.button.callback("⬅️ Назад", "admin:home")],
  ]);
}

export function adminBroadcastAudienceKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🌍 Всем", "admin:broadcast:audience:all")],
    [Markup.button.callback("💼 Только воркерам", "admin:broadcast:audience:workers")],
    [Markup.button.callback("🐘 Только мамонтам", "admin:broadcast:audience:clients")],
    [Markup.button.callback("❌ Отмена", "admin:home")],
  ]);
}

export function adminLogsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📝 Журнал действий", "admin:logs:actions")],
    [Markup.button.callback("🚨 Журнал ошибок", "admin:logs:errors")],
    [Markup.button.callback("⬅️ Назад", "admin:home")],
  ]);
}

export function adminPaymentRequestKeyboard(requestId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Принять", `admin:payment-request:${requestId}:approve`),
      Markup.button.callback("❌ Отклонить", `admin:payment-request:${requestId}:reject`),
    ],
  ]);
}

export function adminCardReviewKeyboard(cardId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Одобрить", `admin:card-review:${cardId}:approve`),
      Markup.button.callback("❌ Отклонить", `admin:card-review:${cardId}:reject`),
    ],
  ]);
}

