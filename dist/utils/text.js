"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMoney = formatMoney;
exports.escapeHtml = escapeHtml;
exports.formatUserLabel = formatUserLabel;
exports.getRoleTitle = getRoleTitle;
exports.getCardCategoryTitle = getCardCategoryTitle;
exports.getLevelTitle = getLevelTitle;
exports.buildTeamProfileText = buildTeamProfileText;
exports.buildProjectInfoText = buildProjectInfoText;
exports.buildCuratorText = buildCuratorText;
exports.buildCardText = buildCardText;
exports.buildServiceProfileText = buildServiceProfileText;
const env_1 = require("../config/env");
const date_1 = require("./date");
const moneyFormatter = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});
function formatMoney(amount) {
    return `${moneyFormatter.format(amount)} RUB`;
}
function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function formatUserLabel(user) {
    if (user.username) {
        return `@${user.username}`;
    }
    return user.first_name || String(user.telegram_id);
}
function getRoleTitle(role) {
    switch (role) {
        case "admin":
            return "🛡 Администратор";
        case "curator":
            return "🧑‍💼 Куратор";
        case "worker":
            return "💼 Воркер";
        default:
            return "🐘 Мамонт";
    }
}
function getCardCategoryTitle(category) {
    return category === "pepper" ? "Девушки с перчиком" : "Девушки";
}
function getLevelTitle(totalProfit) {
    if (totalProfit >= 500_000) {
        return "Платиновый";
    }
    if (totalProfit >= 100_000) {
        return "Продвинутый";
    }
    return "Начальный";
}
function buildTeamProfileText(user, totalProfits = 0) {
    return [
        "<b>👤 Профиль сотрудника</b>",
        "",
        `🆔 Telegram ID: <code>${user.telegram_id}</code>`,
        `🏅 Уровень: ${getLevelTitle(user.total_profit)}`,
        `📈 Количество профитов: ${totalProfits}`,
        `💸 Сумма профитов: ${formatMoney(user.total_profit)}`,
        `📊 Средний профит: ${formatMoney(user.avg_profit)}`,
        `🏆 Рекордный профит: ${formatMoney(user.best_profit)}`,
        `💼 Баланс AWAKE BOT: ${formatMoney(user.withdrawable_balance)}`,
        `\uD83E\uDDEE \u0414\u043E\u043B\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u044B: ${user.role === "admin" ? "100%" : "25%"}`,
        `📌 Статус: ${getRoleTitle(user.role)}`,
        `🗓 В команде: ${(0, date_1.daysBetween)(user.created_at)} дн.`,
    ].join("\n");
}
function buildProjectInfoText(stats) {
    return [
        "<b>ℹ️ О проекте</b>",
        "",
        `🎂 День рождения команды: ${(0, date_1.formatDate)(env_1.config.projectStartDate)}`,
        `📈 Подтверждено профитов: ${stats.totalProfits}`,
        `💸 Сумма профитов: ${formatMoney(stats.totalProfitAmount)}`,
        "",
        "<b>💳 Выплаты</b>",
        `Профит: ${stats.payoutPercent}%`,
        "Состояние сервисов: Ворк",
    ].join("\n");
}
function buildCuratorText(curator) {
    if (!curator) {
        return [
            "<b>🧑‍💼 Система кураторов</b>",
            "",
            "У вас пока нет назначенного куратора.",
            "Кураторы будут добавлены позже.",
        ].join("\n");
    }
    return [
        "<b>🧑‍💼 Система кураторов</b>",
        "",
        `Куратор: <b>${escapeHtml(curator.name)}</b>`,
        curator.description ? `Описание: ${escapeHtml(curator.description)}` : "Описание пока не заполнено.",
    ].join("\n");
}
function buildCardText(card) {
    const lines = [
        `<b>${escapeHtml(card.name)}</b>, ${card.age}`,
        "",
        `Раздел: ${escapeHtml(getCardCategoryTitle(card.category))}`,
        `Город: ${escapeHtml(card.city)}`,
    ];
    if (card.description) {
        lines.push(`Описание: ${escapeHtml(card.description)}`);
    }
    lines.push("", `1 час: ${formatMoney(card.price_1h)}`, `3 часа: ${formatMoney(card.price_3h)}`, `Весь день: ${formatMoney(card.price_full_day)}`);
    return lines.join("\n");
}
function buildServiceProfileText(user) {
    return [
        "<b>👤 Мой профиль</b>",
        "",
        `🆔 Telegram ID: <code>${user.telegram_id}</code>`,
        `💼 Баланс: ${formatMoney(user.balance)}`,
        `🗓 Дата регистрации: ${(0, date_1.formatDate)(user.created_at)}`,
    ].join("\n");
}
