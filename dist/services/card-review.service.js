"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyAdminsAboutCardReview = notifyAdminsAboutCardReview;
exports.notifyWorkerAboutCardReviewDecision = notifyWorkerAboutCardReviewDecision;
const env_1 = require("../config/env");
const admin_1 = require("../keyboards/admin");
const bot_clients_service_1 = require("./bot-clients.service");
const cards_service_1 = require("./cards.service");
const media_service_1 = require("./media.service");
const text_1 = require("../utils/text");
function buildReviewCaption(card) {
    const ownerLabel = card.owner_username ? `@${card.owner_username}` : card.owner_first_name || String(card.owner_telegram_id);
    return [
        "<b>📝 Новая анкета на проверку</b>",
        `Анкета: #${card.id}`,
        `Воркер: ${(0, text_1.escapeHtml)(ownerLabel)} (<code>${card.owner_telegram_id}</code>)`,
        `Категория: ${(0, text_1.escapeHtml)((0, text_1.getCardCategoryTitle)(card.category))}`,
        `Город: ${(0, text_1.escapeHtml)(card.city)}`,
        `Имя: ${(0, text_1.escapeHtml)(card.name)}`,
        `Возраст: ${card.age}`,
        `1 час: ${(0, text_1.formatMoney)(card.price_1h)}`,
        `3 часа: ${(0, text_1.formatMoney)(card.price_3h)}`,
        `Весь день: ${(0, text_1.formatMoney)(card.price_full_day)}`,
        `Фото: ${card.photos.length}`,
    ].join("\n");
}
async function notifyAdminsAboutCardReview(cardId) {
    const card = await (0, cards_service_1.getCardWithOwner)(cardId);
    if (!card) {
        return;
    }
    let references = [];
    if (card.photos.length) {
        try {
            references = await (0, media_service_1.materializeCardPhotoReferences)(card.photos);
        }
        catch {
            references = [];
        }
    }
    const telegram = (0, bot_clients_service_1.getTeambotTelegram)();
    const caption = buildReviewCaption(card);
    for (const adminTelegramId of env_1.config.adminTelegramIds) {
        try {
            const firstReference = references[0];
            const media = firstReference ? (0, media_service_1.mediaInputFromReference)(firstReference) : null;
            if (media) {
                await telegram.sendPhoto(adminTelegramId, media, {
                    caption,
                    parse_mode: "HTML",
                    ...(0, admin_1.adminCardReviewKeyboard)(card.id),
                });
            }
            else {
                await telegram.sendMessage(adminTelegramId, caption, {
                    parse_mode: "HTML",
                    ...(0, admin_1.adminCardReviewKeyboard)(card.id),
                });
            }
        }
        catch {
            continue;
        }
    }
}
async function notifyWorkerAboutCardReviewDecision(card, decision) {
    const telegram = (0, bot_clients_service_1.getTeambotTelegram)();
    const text = decision === "approved"
        ? [
            "<b>✅ Анкета одобрена</b>",
            `Анкета #${card.id} прошла модерацию.`,
            "Теперь она опубликована в Honey Bunny.",
        ].join("\n")
        : [
            "<b>❌ Анкета отклонена</b>",
            `Анкета #${card.id} не прошла модерацию.`,
            "Проверьте данные и отправьте анкету заново.",
        ].join("\n");
    try {
        await telegram.sendMessage(card.owner_telegram_id, text, { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
