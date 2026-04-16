"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicebotMainMenuKeyboard = servicebotMainMenuKeyboard;
exports.serviceProfileKeyboard = serviceProfileKeyboard;
exports.topupConfirmationKeyboard = topupConfirmationKeyboard;
exports.cityKeyboard = cityKeyboard;
exports.modelCategoryKeyboard = modelCategoryKeyboard;
exports.cardListKeyboard = cardListKeyboard;
exports.cardDetailKeyboard = cardDetailKeyboard;
exports.modelInfoBackKeyboard = modelInfoBackKeyboard;
exports.modelReviewsKeyboard = modelReviewsKeyboard;
exports.modelScheduleKeyboard = modelScheduleKeyboard;
exports.prebookingKeyboard = prebookingKeyboard;
exports.paymentKeyboard = paymentKeyboard;
exports.reviewsKeyboard = reviewsKeyboard;
exports.supportKeyboard = supportKeyboard;
exports.infoCenterKeyboard = infoCenterKeyboard;
exports.safetyInfoKeyboard = safetyInfoKeyboard;
exports.infoSectionBackKeyboard = infoSectionBackKeyboard;
exports.legalInfoKeyboard = legalInfoKeyboard;
exports.financeInfoKeyboard = financeInfoKeyboard;
exports.verificationInfoKeyboard = verificationInfoKeyboard;
exports.emergencyInfoKeyboard = emergencyInfoKeyboard;
exports.awardsInfoKeyboard = awardsInfoKeyboard;
exports.agreementKeyboard = agreementKeyboard;
exports.simpleInfoBackKeyboard = simpleInfoBackKeyboard;
exports.workerPanelKeyboard = workerPanelKeyboard;
exports.workerBackInlineKeyboard = workerBackInlineKeyboard;
const telegraf_1 = require("telegraf");
const constants_1 = require("../config/constants");
const webapp_1 = require("../utils/webapp");
function servicebotMainMenuKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.webApp(constants_1.SERVICEBOT_MAIN_MENU[0], (0, webapp_1.buildWebappUrl)("catalog")),
            telegraf_1.Markup.button.webApp(constants_1.SERVICEBOT_MAIN_MENU[1], (0, webapp_1.buildWebappUrl)("club")),
        ],
        [telegraf_1.Markup.button.webApp(constants_1.SERVICEBOT_MAIN_MENU[2], (0, webapp_1.buildWebappUrl)("reviews"))],
        [
            telegraf_1.Markup.button.webApp(constants_1.SERVICEBOT_MAIN_MENU[3], (0, webapp_1.buildWebappUrl)("profile")),
            telegraf_1.Markup.button.webApp(constants_1.SERVICEBOT_MAIN_MENU[4], (0, webapp_1.buildWebappUrl)("search")),
        ],
        [
            telegraf_1.Markup.button.webApp(constants_1.SERVICEBOT_MAIN_MENU[5], (0, webapp_1.buildWebappUrl)("support")),
            telegraf_1.Markup.button.webApp(constants_1.SERVICEBOT_MAIN_MENU[6], (0, webapp_1.buildWebappUrl)("info")),
        ],
    ]);
}
function serviceProfileKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("💳 Пополнить баланс", "service:profile:topup")],
        [telegraf_1.Markup.button.callback("🎁 Промокод", "service:profile:promo")],
        [telegraf_1.Markup.button.callback("💎 Программа лояльности", "service:profile:loyalty")],
        [telegraf_1.Markup.button.callback("🎯 Рекомендации", "service:profile:recommendations")],
        [telegraf_1.Markup.button.callback("❤️ Избранное", "service:profile:favorites")],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "service:home")],
    ]);
}
function topupConfirmationKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("✅ Подтвердить перевод", "service:profile:topup:confirm")],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "service:profile")],
    ]);
}
function cityKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback(constants_1.AVAILABLE_CITIES[0], `service:city:${constants_1.AVAILABLE_CITIES[0]}`),
            telegraf_1.Markup.button.callback(constants_1.AVAILABLE_CITIES[1], `service:city:${constants_1.AVAILABLE_CITIES[1]}`),
        ],
        [
            telegraf_1.Markup.button.callback(constants_1.AVAILABLE_CITIES[2], `service:city:${constants_1.AVAILABLE_CITIES[2]}`),
            telegraf_1.Markup.button.callback(constants_1.AVAILABLE_CITIES[3], `service:city:${constants_1.AVAILABLE_CITIES[3]}`),
        ],
        [telegraf_1.Markup.button.callback(constants_1.AVAILABLE_CITIES[4], `service:city:${constants_1.AVAILABLE_CITIES[4]}`)],
        [
            telegraf_1.Markup.button.callback("<", "service:cities:noop"),
            telegraf_1.Markup.button.callback("1 из 1", "service:cities:noop"),
            telegraf_1.Markup.button.callback(">", "service:cities:noop"),
        ],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "service:search")],
    ]);
}
function modelCategoryKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        ...constants_1.CARD_CATEGORIES.map((category) => [telegraf_1.Markup.button.callback(category.label, `service:category:${category.key}`)]),
        [telegraf_1.Markup.button.callback(constants_1.HOME_BUTTON, "service:home")],
    ]);
}
function cardListKeyboard(cards, category, page, totalPages) {
    const rows = cards.map((card) => [telegraf_1.Markup.button.callback(`✨ ${card.name}, ${card.age}`, `service:card:${card.id}`)]);
    if (totalPages > 1) {
        rows.push([
            telegraf_1.Markup.button.callback("◀️", page > 1 ? `service:cards:page:${page - 1}` : "service:cards:noop"),
            telegraf_1.Markup.button.callback(`${page} из ${totalPages}`, "service:cards:noop"),
            telegraf_1.Markup.button.callback("▶️", page < totalPages ? `service:cards:page:${page + 1}` : "service:cards:noop"),
        ]);
    }
    rows.push([telegraf_1.Markup.button.callback("⬅️ Назад", `service:category:${category}`)]);
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function cardDetailKeyboard(cardId, isFavorite, nextPhotoIndex) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("💘 Оформить", `service:booking:${cardId}`),
            telegraf_1.Markup.button.callback("📸 Другое фото", `service:card:photo:${cardId}:${nextPhotoIndex}`),
        ],
        [
            telegraf_1.Markup.button.callback("📅 Расписание", `service:schedule:today:${cardId}`),
            telegraf_1.Markup.button.callback("⭐ Отзывы", `service:model-reviews:${cardId}`),
        ],
        [telegraf_1.Markup.button.callback("🛡 ПОЛИТИКА БЕЗОПАСНОСТИ", `service:safety-policy:${cardId}`)],
        [telegraf_1.Markup.button.callback("🏆 Сертификат", `service:certificate:${cardId}`)],
        [telegraf_1.Markup.button.callback(isFavorite ? "💔 Убрать из избранного" : "❤️ Добавить в избранное", `service:favorite:${cardId}`)],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "service:search-back")],
    ]);
}
function modelInfoBackKeyboard(cardId) {
    return telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback("⬅️ Назад к модели", `service:card:${cardId}`)]]);
}
function modelReviewsKeyboard(cardId, page, hasPrev, hasNext) {
    const rows = [];
    if (hasNext) {
        rows.push([telegraf_1.Markup.button.callback("🔄 Загрузить ещё", `service:model-reviews:${cardId}:${page + 1}`)]);
    }
    if (hasPrev) {
        rows.push([telegraf_1.Markup.button.callback("⬅️ Предыдущие", `service:model-reviews:${cardId}:${page - 1}`)]);
    }
    rows.push([telegraf_1.Markup.button.callback("⬅️ Назад к модели", `service:card:${cardId}`)]);
    return telegraf_1.Markup.inlineKeyboard(rows);
}
function modelScheduleKeyboard(cardId) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("📅 На неделю", `service:schedule:week:${cardId}`),
            telegraf_1.Markup.button.callback("⏰ Сегодня", `service:schedule:today:${cardId}`),
        ],
        [telegraf_1.Markup.button.callback("📋 Предзаказ", `service:booking:${cardId}`)],
        [telegraf_1.Markup.button.callback("⬅️ Назад к модели", `service:card:${cardId}`)],
    ]);
}
function prebookingKeyboard(cardId) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("💰 Забронировать со скидкой", `service:payment:open:${cardId}`)],
        [telegraf_1.Markup.button.callback("⬅️ Назад к расписанию", `service:schedule:today:${cardId}`)],
    ]);
}
function paymentKeyboard(cardId) {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("💵 Наличные", `service:payment:cash:${cardId}`)],
        [telegraf_1.Markup.button.callback("💳 Баланс бота", `service:payment:bot_balance:${cardId}`)],
        [telegraf_1.Markup.button.callback("⬅️ Назад к предзаказу", `service:booking:${cardId}`)],
    ]);
}
function reviewsKeyboard(page, hasNext) {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("✍️ Добавить отзыв", "service:reviews:add"),
            telegraf_1.Markup.button.callback("⬅️ Назад", "service:home"),
        ],
        [
            telegraf_1.Markup.button.callback("◀️", `service:reviews:page:${Math.max(1, page - 1)}`),
            telegraf_1.Markup.button.callback(`Стр. ${page}`, "service:reviews:noop"),
            telegraf_1.Markup.button.callback("▶️", `service:reviews:page:${hasNext ? page + 1 : page}`),
        ],
    ]);
}
function supportKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("📝 Оставить обращение", "service:support:create")],
        [telegraf_1.Markup.button.url("💬 Связаться с оператором", constants_1.SUPPORT_BOT_URL)],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "service:home")],
    ]);
}
function infoCenterKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🔒 Безопасность и гарантии", "service:info:safety")],
        [
            telegraf_1.Markup.button.callback("💎 Программа лояльности", "service:info:loyalty"),
            telegraf_1.Markup.button.callback("🎯 Рекомендации", "service:info:recommendations"),
        ],
        [telegraf_1.Markup.button.callback("🧑‍💼 Расширенная поддержка", "service:info:premium_support")],
        [telegraf_1.Markup.button.callback("⭐ Отзывы", "service:reviews:page:1")],
        [
            telegraf_1.Markup.button.callback("📄 Соглашение", "service:info:agreement"),
            telegraf_1.Markup.button.callback("💬 Поддержка", "service:support:open"),
        ],
        [telegraf_1.Markup.button.callback(constants_1.HOME_BUTTON, "service:home")],
    ]);
}
function safetyInfoKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback("🛡️ Технические гарантии", "service:info:tech"),
            telegraf_1.Markup.button.callback("⚖️ Юридическая защита", "service:info:legal"),
        ],
        [
            telegraf_1.Markup.button.callback("💰 Финансовые гарантии", "service:info:finance"),
            telegraf_1.Markup.button.callback("🔐 Защита данных", "service:info:data"),
        ],
        [
            telegraf_1.Markup.button.callback("✅ Проверка моделей", "service:info:verification"),
            telegraf_1.Markup.button.callback("🚨 Экстренная помощь", "service:info:emergency"),
        ],
        [telegraf_1.Markup.button.callback("🏆 Награды и сертификаты", "service:info:awards")],
        [telegraf_1.Markup.button.callback("⬅️ Назад", "service:info:root")],
    ]);
}
function infoSectionBackKeyboard(callbackData = "service:info:safety") {
    return telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback("⬅️ К безопасности", callbackData)]]);
}
function legalInfoKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("📄 Соглашение", "service:info:agreement")],
        [telegraf_1.Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
    ]);
}
function financeInfoKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("💳 Пополнить", "service:profile:topup")],
        [telegraf_1.Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
    ]);
}
function verificationInfoKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("🏅 Проверенные модели", "service:search")],
        [telegraf_1.Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
    ]);
}
function emergencyInfoKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("💬 Написать", "service:support:create")],
        [telegraf_1.Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
    ]);
}
function awardsInfoKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback("⭐ Отзывы", "service:reviews:page:1")],
        [telegraf_1.Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
    ]);
}
function agreementKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.url("🌐 Открыть полную версию", constants_1.AGREEMENT_URL)],
        [telegraf_1.Markup.button.callback("⬅️ К инфо-центру", "service:info:root")],
    ]);
}
function simpleInfoBackKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback("⬅️ К инфо-центру", "service:info:root")]]);
}
function workerPanelKeyboard() {
    return telegraf_1.Markup.keyboard([
        [constants_1.WORKER_PANEL_MENU[0], constants_1.WORKER_PANEL_MENU[1]],
        [constants_1.WORKER_PANEL_MENU[2]],
        [constants_1.WORKER_PANEL_MENU[3]],
    ]).resize();
}
function workerBackInlineKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([[telegraf_1.Markup.button.callback("⬅️ Назад", "service:worker:home")]]);
}
