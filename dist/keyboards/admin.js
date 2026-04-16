"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminHomeKeyboard = adminHomeKeyboard;
exports.adminUsersKeyboard = adminUsersKeyboard;
exports.adminUserActionsKeyboard = adminUserActionsKeyboard;
exports.adminRoleKeyboard = adminRoleKeyboard;
exports.adminCardsKeyboard = adminCardsKeyboard;
exports.adminOwnerCardsKeyboard = adminOwnerCardsKeyboard;
exports.adminCardActionsKeyboard = adminCardActionsKeyboard;
exports.adminCardDeleteConfirmKeyboard = adminCardDeleteConfirmKeyboard;
exports.adminCuratorsKeyboard = adminCuratorsKeyboard;
exports.adminCuratorActionsKeyboard = adminCuratorActionsKeyboard;
exports.adminProjectStatsKeyboard = adminProjectStatsKeyboard;
exports.adminBroadcastAudienceKeyboard = adminBroadcastAudienceKeyboard;
exports.adminLogsKeyboard = adminLogsKeyboard;
exports.adminPaymentRequestKeyboard = adminPaymentRequestKeyboard;
exports.adminWithdrawRequestKeyboard = adminWithdrawRequestKeyboard;
exports.adminProfitReportKeyboard = adminProfitReportKeyboard;
exports.adminCardReviewKeyboard = adminCardReviewKeyboard;
const telegraf_1 = require("telegraf");
function adminHomeKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("📊 Общая статистика", "admin:stats")],
        [telegraf_1.Markup.button.callback("👥 Пользователи", "admin:users")],
        [telegraf_1.Markup.button.callback("📋 Анкеты", "admin:cards")],
        [telegraf_1.Markup.button.callback("🧪 Friend code", "admin:friend-codes")],
        [telegraf_1.Markup.button.callback("🧑‍💼 Кураторы", "admin:curators")],
        [telegraf_1.Markup.button.callback("💳 Реквизиты", "admin:transfer")],
        [telegraf_1.Markup.button.callback("📈 Статистика проекта", "admin:project-stats")],
        [telegraf_1.Markup.button.callback("💸 Добавить профит", "admin:add-profit")],
        [telegraf_1.Markup.button.callback("📣 Рассылка", "admin:broadcast")],
        [telegraf_1.Markup.button.callback("🗂 Логи", "admin:logs")],
        [telegraf_1.Markup.button.callback("✖️ Закрыть", "admin:close")],
    ]);
}
function adminUsersKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🕘 Последние пользователи", "admin:users:list")],
        [telegraf_1.Markup.button.callback("🔎 Поиск по ID / username", "admin:users:search")],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "admin:home")],
    ]);
}
function adminUserActionsKeyboard(userId, role, isBlocked, hasCurator) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🪪 Сменить роль", `admin:user:${userId}:role`)],
        [telegraf_1.Markup.button.callback("💼 Изменить баланс AWAKE BOT", `admin:user:${userId}:withdraw-balance`)],
        [telegraf_1.Markup.button.callback("📈 Изменить профиты", `admin:user:${userId}:profit-metrics`)],
        [telegraf_1.Markup.button.callback(isBlocked ? "✅ Разблокировать" : "⛔ Заблокировать", `admin:user:${userId}:block`)],
        [
            telegraf_1.Markup.button.callback(role === "curator" ? "💼 Сделать воркером" : "🧑‍💼 Сделать куратором", `admin:user:${userId}:${role === "curator" ? "make-worker" : "make-curator"}`),
        ],
        [
            telegraf_1.Markup.button.callback(hasCurator ? "➖ Снять куратора" : "➕ Назначить куратора", `admin:user:${userId}:${hasCurator ? "remove-curator" : "assign-curator"}`),
        ],
        [telegraf_1.Markup.button.callback("📋 Анкеты пользователя", `admin:cards:owner:${userId}`)],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "admin:users")],
    ]);
}
function adminRoleKeyboard(userId) {
    const roles = [
        { label: "🐘 Мамонт", value: "client" },
        { label: "💼 Воркер", value: "worker" },
        { label: "🧑‍💼 Куратор", value: "curator" },
        { label: "🛡 Админ", value: "admin" },
    ];
    return telegraf_1.Markup.inlineKeyboard([
        roles.map((role) => telegraf_1.Markup.button.callback(role.label, `admin:user:${userId}:set-role:${role.value}`)),
        [telegraf_1.Markup.button.callback("⬅️ Назад", `admin:user:${userId}:view`)],
    ]);
}
function adminCardsKeyboard(cards) {
    const rows = cards.map((card) => [
        telegraf_1.Markup.button.callback(`📋 #${card.id} ${card.name}, ${card.age} • ${card.city}`, `admin:card:${card.id}:view`),
    ]);
    rows.push([telegraf_1.Markup.button.callback("🔎 Найти анкету по ID", "admin:cards:search")]);
    rows.push([telegraf_1.Markup.button.callback("⬅️ Назад", "admin:home")]);
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function adminOwnerCardsKeyboard(cards, ownerUserId) {
    const rows = cards.map((card) => [
        telegraf_1.Markup.button.callback(`📋 #${card.id} ${card.name}, ${card.age} • ${card.city}`, `admin:card:${card.id}:view`),
    ]);
    rows.push([telegraf_1.Markup.button.callback("⬅️ К профилю", `admin:user:${ownerUserId}:view`)]);
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function adminCardActionsKeyboard(cardId, ownerUserId) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🗑 Удалить анкету", `admin:card:${cardId}:delete:confirm`)],
        [telegraf_1.Markup.button.callback("👤 Владелец", `admin:user:${ownerUserId}:view`)],
        [telegraf_1.Markup.button.callback("⬅️ К списку анкет", "admin:cards")],
    ]);
}
function adminCardDeleteConfirmKeyboard(cardId, ownerUserId) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("⚠️ Да, удалить", `admin:card:${cardId}:delete:apply`)],
        [telegraf_1.Markup.button.callback("⬅️ Назад к анкете", `admin:card:${cardId}:view`)],
        [telegraf_1.Markup.button.callback("👤 К владельцу", `admin:user:${ownerUserId}:view`)],
    ]);
}
function adminCuratorsKeyboard(curators) {
    const rows = curators.map((curator) => [
        telegraf_1.Markup.button.callback(`🧑‍💼 ${curator.id}. ${curator.name}${curator.telegram_username ? ` (@${curator.telegram_username})` : ""}`, `admin:curator:view:${curator.id}`),
    ]);
    rows.push([telegraf_1.Markup.button.callback("➕ Добавить куратора", "admin:curator:add")], [telegraf_1.Markup.button.callback("🔗 Назначить пользователю", "admin:curator:assign")], [telegraf_1.Markup.button.callback("➖ Снять назначение", "admin:curator:unassign")], [telegraf_1.Markup.button.callback("⬅️ Назад", "admin:home")]);
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function adminCuratorActionsKeyboard(curatorId, telegramUsername) {
    const rows = [];
    if (telegramUsername) {
        rows.push([telegraf_1.Markup.button.url("👤 Открыть профиль", `https://t.me/${telegramUsername}`)]);
    }
    rows.push([telegraf_1.Markup.button.callback("🗑 Удалить куратора", `admin:curator:delete:${curatorId}`)]);
    rows.push([telegraf_1.Markup.button.callback("⬅️ Назад", "admin:curators")]);
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function adminProjectStatsKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("✏️ Редактировать вручную", "admin:project-stats:edit")],
        [telegraf_1.Markup.button.callback("💸 Добавить профит", "admin:add-profit")],
        [telegraf_1.Markup.button.callback("🔄 Пересчитать из БД", "admin:project-stats:recalc")],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "admin:home")],
    ]);
}
function adminBroadcastAudienceKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🌍 Всем", "admin:broadcast:audience:all")],
        [telegraf_1.Markup.button.callback("💼 Только воркерам", "admin:broadcast:audience:workers")],
        [telegraf_1.Markup.button.callback("🐘 Только мамонтам", "admin:broadcast:audience:clients")],
        [telegraf_1.Markup.button.callback("❌ Отмена", "admin:home")],
    ]);
}
function adminLogsKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("📝 Журнал действий", "admin:logs:actions")],
        [telegraf_1.Markup.button.callback("🚨 Журнал ошибок", "admin:logs:errors")],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "admin:home")],
    ]);
}
function adminPaymentRequestKeyboard(requestId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("✅ Принять", `admin:payment-request:${requestId}:approve`),
            telegraf_1.Markup.button.callback("❌ Отклонить", `admin:payment-request:${requestId}:reject`),
        ],
    ]);
}
function adminWithdrawRequestKeyboard(requestId) {
    return telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback("💸 Выплачено", `admin:withdraw-request:${requestId}:paid`)]]);
}
function adminProfitReportKeyboard(requestId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("💳 Прямой перевод", `admin:profit-report:${requestId}:approve:direct_transfer`),
            telegraf_1.Markup.button.callback("🤖 HonneyBunny", `admin:profit-report:${requestId}:approve:honeybunny`),
        ],
        [telegraf_1.Markup.button.callback("❌ Отклонить", `admin:profit-report:${requestId}:reject`)],
    ]);
}
function adminCardReviewKeyboard(cardId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("✅ Одобрить", `admin:card-review:${cardId}:approve`),
            telegraf_1.Markup.button.callback("❌ Отклонить", `admin:card-review:${cardId}:reject`),
        ],
    ]);
}
