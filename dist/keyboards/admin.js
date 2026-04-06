"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminHomeKeyboard = adminHomeKeyboard;
exports.adminUsersKeyboard = adminUsersKeyboard;
exports.adminUserActionsKeyboard = adminUserActionsKeyboard;
exports.adminRoleKeyboard = adminRoleKeyboard;
exports.adminCuratorsKeyboard = adminCuratorsKeyboard;
exports.adminCuratorActionsKeyboard = adminCuratorActionsKeyboard;
exports.adminProjectStatsKeyboard = adminProjectStatsKeyboard;
exports.adminBroadcastAudienceKeyboard = adminBroadcastAudienceKeyboard;
exports.adminLogsKeyboard = adminLogsKeyboard;
exports.adminPaymentRequestKeyboard = adminPaymentRequestKeyboard;
exports.adminCardReviewKeyboard = adminCardReviewKeyboard;
const telegraf_1 = require("telegraf");
function adminHomeKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("📊 Общая статистика", "admin:stats")],
        [telegraf_1.Markup.button.callback("👥 Пользователи", "admin:users")],
        [telegraf_1.Markup.button.callback("🧑‍💼 Кураторы", "admin:curators")],
        [telegraf_1.Markup.button.callback("💳 Реквизиты", "admin:transfer")],
        [telegraf_1.Markup.button.callback("📈 Статистика проекта", "admin:project-stats")],
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
function adminUserActionsKeyboard(userId, isBlocked, hasCurator) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🪪 Сменить роль", `admin:user:${userId}:role`)],
        [telegraf_1.Markup.button.callback(isBlocked ? "✅ Разблокировать" : "⛔ Заблокировать", `admin:user:${userId}:block`)],
        [
            telegraf_1.Markup.button.callback(hasCurator ? "➖ Снять куратора" : "➕ Назначить куратора", `admin:user:${userId}:${hasCurator ? "remove-curator" : "assign-curator"}`),
        ],
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
function adminCuratorsKeyboard(curators) {
    const rows = curators.map((curator) => [
        telegraf_1.Markup.button.callback(`🧑‍💼 ${curator.id}. ${curator.name}`, `admin:curator:view:${curator.id}`),
    ]);
    rows.push([telegraf_1.Markup.button.callback("➕ Добавить куратора", "admin:curator:add")], [telegraf_1.Markup.button.callback("🔗 Назначить пользователю", "admin:curator:assign")], [telegraf_1.Markup.button.callback("➖ Снять назначение", "admin:curator:unassign")], [telegraf_1.Markup.button.callback("⬅️ Назад", "admin:home")]);
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function adminCuratorActionsKeyboard(curatorId) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🗑 Удалить куратора", `admin:curator:delete:${curatorId}`)],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "admin:curators")],
    ]);
}
function adminProjectStatsKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("✏️ Редактировать вручную", "admin:project-stats:edit")],
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
function adminCardReviewKeyboard(cardId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("✅ Одобрить", `admin:card-review:${cardId}:approve`),
            telegraf_1.Markup.button.callback("❌ Отклонить", `admin:card-review:${cardId}:reject`),
        ],
    ]);
}
