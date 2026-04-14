import { Markup } from "telegraf";
import { AGREEMENT_URL, AVAILABLE_CITIES, CARD_CATEGORIES, HOME_BUTTON, REVIEWS_CHANNEL_URL, SERVICEBOT_MAIN_MENU, SUPPORT_BOT_URL, WORKER_PANEL_MENU } from "../config/constants";

export function servicebotMainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(SERVICEBOT_MAIN_MENU[0], "service:catalog"),
      Markup.button.callback(SERVICEBOT_MAIN_MENU[1], "service:club"),
    ],
    [Markup.button.url(SERVICEBOT_MAIN_MENU[2], REVIEWS_CHANNEL_URL)],
    [
      Markup.button.callback(SERVICEBOT_MAIN_MENU[3], "service:profile"),
      Markup.button.callback(SERVICEBOT_MAIN_MENU[4], "service:search"),
    ],
    [
      Markup.button.callback(SERVICEBOT_MAIN_MENU[5], "service:support:open"),
      Markup.button.callback(SERVICEBOT_MAIN_MENU[6], "service:info:root"),
    ],
  ]);
}

export function serviceProfileKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💳 Пополнить баланс", "service:profile:topup")],
    [Markup.button.callback("🎁 Промокод", "service:profile:promo")],
    [Markup.button.callback("💎 Программа лояльности", "service:profile:loyalty")],
    [Markup.button.callback("🎯 Рекомендации", "service:profile:recommendations")],
    [Markup.button.callback("❤️ Избранное", "service:profile:favorites")],
    [Markup.button.callback("⬅️ Назад", "service:home")],
  ]);
}

export function topupConfirmationKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Подтвердить перевод", "service:profile:topup:confirm")],
    [Markup.button.callback("⬅️ Назад", "service:profile")],
  ]);
}

export function cityKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(AVAILABLE_CITIES[0], `service:city:${AVAILABLE_CITIES[0]}`),
      Markup.button.callback(AVAILABLE_CITIES[1], `service:city:${AVAILABLE_CITIES[1]}`),
    ],
    [
      Markup.button.callback(AVAILABLE_CITIES[2], `service:city:${AVAILABLE_CITIES[2]}`),
      Markup.button.callback(AVAILABLE_CITIES[3], `service:city:${AVAILABLE_CITIES[3]}`),
    ],
    [Markup.button.callback(AVAILABLE_CITIES[4], `service:city:${AVAILABLE_CITIES[4]}`)],
    [
      Markup.button.callback("<", "service:cities:noop"),
      Markup.button.callback("1 из 1", "service:cities:noop"),
      Markup.button.callback(">", "service:cities:noop"),
    ],
    [Markup.button.callback("⬅️ Назад", "service:search")],
  ]);
}

export function modelCategoryKeyboard() {
  return Markup.inlineKeyboard([
    ...CARD_CATEGORIES.map((category) => [Markup.button.callback(category.label, `service:category:${category.key}`)]),
    [Markup.button.callback(HOME_BUTTON, "service:home")],
  ]);
}

export function cardListKeyboard(
  cards: Array<{ id: number; name: string; age: number }>,
  category: "girls" | "pepper",
  page: number,
  totalPages: number,
) {
  const rows = cards.map((card) => [Markup.button.callback(`✨ ${card.name}, ${card.age}`, `service:card:${card.id}`)]);
  if (totalPages > 1) {
    rows.push([
      Markup.button.callback("◀️", page > 1 ? `service:cards:page:${page - 1}` : "service:cards:noop"),
      Markup.button.callback(`${page} из ${totalPages}`, "service:cards:noop"),
      Markup.button.callback("▶️", page < totalPages ? `service:cards:page:${page + 1}` : "service:cards:noop"),
    ]);
  }
  rows.push([Markup.button.callback("⬅️ Назад", `service:category:${category}`)]);
  return Markup.inlineKeyboard(rows);
}

export function cardDetailKeyboard(cardId: number, isFavorite: boolean, nextPhotoIndex: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("💘 Оформить", `service:booking:${cardId}`),
      Markup.button.callback("📸 Другое фото", `service:card:photo:${cardId}:${nextPhotoIndex}`),
    ],
    [
      Markup.button.callback("📅 Расписание", `service:schedule:today:${cardId}`),
      Markup.button.callback("⭐ Отзывы", `service:model-reviews:${cardId}`),
    ],
    [Markup.button.callback("🛡 ПОЛИТИКА БЕЗОПАСНОСТИ", `service:safety-policy:${cardId}`)],
    [Markup.button.callback("🏆 Сертификат", `service:certificate:${cardId}`)],
    [Markup.button.callback(isFavorite ? "💔 Убрать из избранного" : "❤️ Добавить в избранное", `service:favorite:${cardId}`)],
    [Markup.button.callback("⬅️ Назад", "service:search-back")],
  ]);
}

export function modelInfoBackKeyboard(cardId: number) {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Назад к модели", `service:card:${cardId}`)]]);
}

export function modelReviewsKeyboard(cardId: number, page: number, hasPrev: boolean, hasNext: boolean) {
  const rows = [];
  if (hasNext) {
    rows.push([Markup.button.callback("🔄 Загрузить ещё", `service:model-reviews:${cardId}:${page + 1}`)]);
  }
  if (hasPrev) {
    rows.push([Markup.button.callback("⬅️ Предыдущие", `service:model-reviews:${cardId}:${page - 1}`)]);
  }
  rows.push([Markup.button.callback("⬅️ Назад к модели", `service:card:${cardId}`)]);
  return Markup.inlineKeyboard(rows);
}

export function modelScheduleKeyboard(cardId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📅 На неделю", `service:schedule:week:${cardId}`),
      Markup.button.callback("⏰ Сегодня", `service:schedule:today:${cardId}`),
    ],
    [Markup.button.callback("📋 Предзаказ", `service:booking:${cardId}`)],
    [Markup.button.callback("⬅️ Назад к модели", `service:card:${cardId}`)],
  ]);
}

export function prebookingKeyboard(cardId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💰 Забронировать со скидкой", `service:payment:open:${cardId}`)],
    [Markup.button.callback("⬅️ Назад к расписанию", `service:schedule:today:${cardId}`)],
  ]);
}

export function paymentKeyboard(cardId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💵 Наличные", `service:payment:cash:${cardId}`)],
    [Markup.button.callback("💳 Баланс бота", `service:payment:bot_balance:${cardId}`)],
    [Markup.button.callback("⬅️ Назад к предзаказу", `service:booking:${cardId}`)],
  ]);
}

export function reviewsKeyboard(page: number, hasNext: boolean) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✍️ Добавить отзыв", "service:reviews:add"),
      Markup.button.callback("⬅️ Назад", "service:home"),
    ],
    [
      Markup.button.callback("◀️", `service:reviews:page:${Math.max(1, page - 1)}`),
      Markup.button.callback(`Стр. ${page}`, "service:reviews:noop"),
      Markup.button.callback("▶️", `service:reviews:page:${hasNext ? page + 1 : page}`),
    ],
  ]);
}

export function supportKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📝 Оставить обращение", "service:support:create")],
    [Markup.button.url("💬 Связаться с оператором", SUPPORT_BOT_URL)],
    [Markup.button.callback("⬅️ Назад", "service:home")],
  ]);
}

export function infoCenterKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🔒 Безопасность и гарантии", "service:info:safety")],
    [
      Markup.button.callback("💎 Программа лояльности", "service:info:loyalty"),
      Markup.button.callback("🎯 Рекомендации", "service:info:recommendations"),
    ],
    [Markup.button.callback("🧑‍💼 Расширенная поддержка", "service:info:premium_support")],
    [Markup.button.callback("⭐ Отзывы", "service:reviews:page:1")],
    [
      Markup.button.callback("📄 Соглашение", "service:info:agreement"),
      Markup.button.callback("💬 Поддержка", "service:support:open"),
    ],
    [Markup.button.callback(HOME_BUTTON, "service:home")],
  ]);
}

export function safetyInfoKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("🛡️ Технические гарантии", "service:info:tech"),
      Markup.button.callback("⚖️ Юридическая защита", "service:info:legal"),
    ],
    [
      Markup.button.callback("💰 Финансовые гарантии", "service:info:finance"),
      Markup.button.callback("🔐 Защита данных", "service:info:data"),
    ],
    [
      Markup.button.callback("✅ Проверка моделей", "service:info:verification"),
      Markup.button.callback("🚨 Экстренная помощь", "service:info:emergency"),
    ],
    [Markup.button.callback("🏆 Награды и сертификаты", "service:info:awards")],
    [Markup.button.callback("⬅️ Назад", "service:info:root")],
  ]);
}

export function infoSectionBackKeyboard(callbackData = "service:info:safety") {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ К безопасности", callbackData)]]);
}

export function legalInfoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📄 Соглашение", "service:info:agreement")],
    [Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
  ]);
}

export function financeInfoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💳 Пополнить", "service:profile:topup")],
    [Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
  ]);
}

export function verificationInfoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🏅 Проверенные модели", "service:search")],
    [Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
  ]);
}

export function emergencyInfoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💬 Написать", "service:support:create")],
    [Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
  ]);
}

export function awardsInfoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⭐ Отзывы", "service:reviews:page:1")],
    [Markup.button.callback("⬅️ К безопасности", "service:info:safety")],
  ]);
}

export function agreementKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url("🌐 Открыть полную версию", AGREEMENT_URL)],
    [Markup.button.callback("⬅️ К инфо-центру", "service:info:root")],
  ]);
}

export function simpleInfoBackKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ К инфо-центру", "service:info:root")]]);
}

export function workerPanelKeyboard() {
  return Markup.keyboard([
    [WORKER_PANEL_MENU[0], WORKER_PANEL_MENU[1]],
    [WORKER_PANEL_MENU[2]],
    [WORKER_PANEL_MENU[3]],
  ]).resize();
}

export function workerBackInlineKeyboard() {
  return Markup.inlineKeyboard([[Markup.button.callback("⬅️ Назад", "service:worker:home")]]);
}
