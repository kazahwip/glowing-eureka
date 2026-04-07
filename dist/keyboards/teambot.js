"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEAM_WORK_BUTTONS = void 0;
exports.teambotMainMenuKeyboard = teambotMainMenuKeyboard;
exports.teambotMainMenuInlineKeyboard = teambotMainMenuInlineKeyboard;
exports.teamWorkKeyboard = teamWorkKeyboard;
exports.teambotBackKeyboard = teambotBackKeyboard;
exports.workerSignalSettingsKeyboard = workerSignalSettingsKeyboard;
exports.curatorDirectoryKeyboard = curatorDirectoryKeyboard;
exports.curatorRequestDecisionKeyboard = curatorRequestDecisionKeyboard;
const telegraf_1 = require("telegraf");
const constants_1 = require("../config/constants");
exports.TEAM_WORK_BUTTONS = {
    createCard: "📝 Создать карточку",
    referral: "🔗 Моя рефка",
    withdraw: "💸 Заявка на вывод",
    settings: "⚙️ Настройки",
    back: "⬅️ Назад",
};
function signalButtonLabel(enabled, title) {
    return `${enabled ? "✅" : "❌"} ${title}`;
}
function teambotMainMenuKeyboard() {
    return telegraf_1.Markup.keyboard([
        [constants_1.TEAMBOT_MAIN_MENU[0], constants_1.TEAMBOT_MAIN_MENU[2]],
        [constants_1.TEAMBOT_MAIN_MENU[1], constants_1.TEAMBOT_MAIN_MENU[3]],
        [constants_1.TEAMBOT_MAIN_MENU[4]],
    ]).resize();
}
function teambotMainMenuInlineKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[0], "team:menu:work"),
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[2], "team:menu:profile"),
        ],
        [
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[1], "team:menu:transfer"),
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[3], "team:menu:curators"),
        ],
        [
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[4], "team:menu:project"),
            telegraf_1.Markup.button.url("💬 Чат", constants_1.TEAM_CHAT_URL),
        ],
    ]);
}
function teamWorkKeyboard() {
    return telegraf_1.Markup.keyboard([
        [exports.TEAM_WORK_BUTTONS.createCard, exports.TEAM_WORK_BUTTONS.referral],
        [exports.TEAM_WORK_BUTTONS.withdraw, exports.TEAM_WORK_BUTTONS.settings],
        [exports.TEAM_WORK_BUTTONS.back],
    ]).resize();
}
function teambotBackKeyboard() {
    return telegraf_1.Markup.keyboard([[constants_1.BACK_BUTTON]]).resize();
}
function workerSignalSettingsKeyboard(user) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback(signalButtonLabel(user.signal_new_referrals, "Новые мамонты"), "team:signals:toggle:referrals")],
        [telegraf_1.Markup.button.callback(signalButtonLabel(user.signal_navigation, "Навигация по боту"), "team:signals:toggle:navigation")],
        [telegraf_1.Markup.button.callback(signalButtonLabel(user.signal_search, "Города и анкеты"), "team:signals:toggle:search")],
        [telegraf_1.Markup.button.callback(signalButtonLabel(user.signal_payments, "Пополнения и оплата"), "team:signals:toggle:payments")],
        [telegraf_1.Markup.button.callback(signalButtonLabel(user.signal_bookings, "Предзаказы"), "team:signals:toggle:bookings")],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "team:settings:back")],
    ]);
}
function curatorDirectoryKeyboard(curators, assignedCuratorId, includeBack = false) {
    const rows = curators.flatMap((curator) => {
        const row = [];
        if (curator.telegram_username) {
            row.push(telegraf_1.Markup.button.url(`👤 ${curator.name}`, `https://t.me/${curator.telegram_username}`));
        }
        else {
            row.push(telegraf_1.Markup.button.callback(`👤 ${curator.name}`, "team:curator:noop"));
        }
        if (assignedCuratorId === curator.id) {
            row.push(telegraf_1.Markup.button.callback("✅ Назначен", "team:curator:assigned"));
        }
        else {
            row.push(telegraf_1.Markup.button.callback("📨 Запрос", `team:curator:request:${curator.id}`));
        }
        return [row];
    });
    if (includeBack) {
        rows.push([telegraf_1.Markup.button.callback("⬅️ Назад", "team:curators:back")]);
    }
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function curatorRequestDecisionKeyboard(requestId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("✅ Принять", `team:curator-request:${requestId}:accept`),
            telegraf_1.Markup.button.callback("❌ Отклонить", `team:curator-request:${requestId}:reject`),
        ],
    ]);
}
