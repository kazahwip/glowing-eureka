import { Markup } from "telegraf";
import type { Card, Curator, UserRole } from "../types/entities";

export function adminHomeKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📊 Общая статистика", "admin:stats")],
    [Markup.button.callback("👥 Пользователи", "admin:users")],
    [Markup.button.callback("📋 Анкеты", "admin:cards")],
    [Markup.button.callback("🧪 Friend code", "admin:friend-codes")],
    [Markup.button.callback("🧑‍💼 Кураторы", "admin:curators")],
    [Markup.button.callback("💳 Реквизиты", "admin:transfer")],
    [Markup.button.callback("📈 Статистика проекта", "admin:project-stats")],
    [Markup.button.callback("💸 Добавить профит", "admin:add-profit")],
    [Markup.button.callback("🗄 Выгрузить БД", "admin:db:export")],
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

export function adminUserActionsKeyboard(userId: number, role: UserRole, isBlocked: boolean, hasCurator: boolean) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🪪 Сменить роль", `admin:user:${userId}:role`)],
    [Markup.button.callback("💼 Изменить баланс AWAKE BOT", `admin:user:${userId}:withdraw-balance`)],
    [Markup.button.callback("📈 Изменить профиты", `admin:user:${userId}:profit-metrics`)],
    [Markup.button.callback(isBlocked ? "✅ Разблокировать" : "⛔ Заблокировать", `admin:user:${userId}:block`)],
    [
      Markup.button.callback(
        role === "curator" ? "💼 Сделать воркером" : "🧑‍💼 Сделать куратором",
        `admin:user:${userId}:${role === "curator" ? "make-worker" : "make-curator"}`,
      ),
    ],
    [
      Markup.button.callback(
        hasCurator ? "➖ Снять куратора" : "➕ Назначить куратора",
        `admin:user:${userId}:${hasCurator ? "remove-curator" : "assign-curator"}`,
      ),
    ],
    [Markup.button.callback("📋 Анкеты пользователя", `admin:cards:owner:${userId}`)],
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

export function adminCardsKeyboard(cards: Card[]) {
  const rows = cards.map((card) => [
    Markup.button.callback(`📋 #${card.id} ${card.name}, ${card.age} • ${card.city}`, `admin:card:${card.id}:view`),
  ]);

  rows.push([Markup.button.callback("🔎 Найти анкету по ID", "admin:cards:search")]);
  rows.push([Markup.button.callback("⬅️ Назад", "admin:home")]);

  return Markup.inlineKeyboard(rows);
}

export function adminOwnerCardsKeyboard(cards: Card[], ownerUserId: number) {
  const rows = cards.map((card) => [
    Markup.button.callback(`📋 #${card.id} ${card.name}, ${card.age} • ${card.city}`, `admin:card:${card.id}:view`),
  ]);

  rows.push([Markup.button.callback("⬅️ К профилю", `admin:user:${ownerUserId}:view`)]);
  return Markup.inlineKeyboard(rows);
}

export function adminCardActionsKeyboard(cardId: number, ownerUserId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🗑 Удалить анкету", `admin:card:${cardId}:delete:confirm`)],
    [Markup.button.callback("👤 Владелец", `admin:user:${ownerUserId}:view`)],
    [Markup.button.callback("⬅️ К списку анкет", "admin:cards")],
  ]);
}

export function adminCardDeleteConfirmKeyboard(cardId: number, ownerUserId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⚠️ Да, удалить", `admin:card:${cardId}:delete:apply`)],
    [Markup.button.callback("⬅️ Назад к анкете", `admin:card:${cardId}:view`)],
    [Markup.button.callback("👤 К владельцу", `admin:user:${ownerUserId}:view`)],
  ]);
}

export function adminCuratorsKeyboard(curators: Curator[]) {
  const rows = curators.map((curator) => [
    Markup.button.callback(
      `🧑‍💼 ${curator.id}. ${curator.name}${curator.telegram_username ? ` (@${curator.telegram_username})` : ""}`,
      `admin:curator:view:${curator.id}`,
    ),
  ]);

  rows.push(
    [Markup.button.callback("➕ Добавить куратора", "admin:curator:add")],
    [Markup.button.callback("🔗 Назначить пользователю", "admin:curator:assign")],
    [Markup.button.callback("➖ Снять назначение", "admin:curator:unassign")],
    [Markup.button.callback("⬅️ Назад", "admin:home")],
  );

  return Markup.inlineKeyboard(rows);
}

export function adminCuratorActionsKeyboard(curatorId: number, telegramUsername?: string | null) {
  const rows = [];

  if (telegramUsername) {
    rows.push([Markup.button.url("👤 Открыть профиль", `https://t.me/${telegramUsername}`)]);
  }

  rows.push([Markup.button.callback("🗑 Удалить куратора", `admin:curator:delete:${curatorId}`)]);
  rows.push([Markup.button.callback("⬅️ Назад", "admin:curators")]);

  return Markup.inlineKeyboard(rows);
}

export function adminProjectStatsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✏️ Редактировать вручную", "admin:project-stats:edit")],
    [Markup.button.callback("💸 Добавить профит", "admin:add-profit")],
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

export function adminWithdrawRequestKeyboard(requestId: number) {
  return Markup.inlineKeyboard([[Markup.button.callback("💸 Выплачено", `admin:withdraw-request:${requestId}:paid`)]]);
}

export function adminProfitReportKeyboard(requestId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("💳 Прямой перевод", `admin:profit-report:${requestId}:approve:direct_transfer`),
      Markup.button.callback("🤖 HonneyBunny", `admin:profit-report:${requestId}:approve:honeybunny`),
    ],
    [Markup.button.callback("❌ Отклонить", `admin:profit-report:${requestId}:reject`)],
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
