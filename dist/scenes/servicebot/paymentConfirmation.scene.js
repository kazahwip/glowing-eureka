"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentConfirmationScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const env_1 = require("../../config/env");
const views_1 = require("../../handlers/servicebot/views");
const admin_1 = require("../../keyboards/admin");
const bot_clients_service_1 = require("../../services/bot-clients.service");
const media_service_1 = require("../../services/media.service");
const payment_requests_service_1 = require("../../services/payment-requests.service");
const settings_service_1 = require("../../services/settings.service");
const text_1 = require("../../utils/text");
const validators_1 = require("../../utils/validators");
const PAID_BUTTON = "✅ Я перевел";
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
const paidKeyboard = telegraf_1.Markup.keyboard([[PAID_BUTTON], [constants_1.CANCEL_BUTTON]]).resize();
async function closeSceneToProfile(ctx, notice) {
    ctx.session.paymentRequestDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply(notice ?? "\u2063", telegraf_1.Markup.removeKeyboard());
    await (0, views_1.showServiceProfile)(ctx);
}
async function notifyAdminsAboutPaymentRequest(ctx, requestId, amount, receiptReference, comment) {
    if (!ctx.from || !ctx.state.user) {
        return;
    }
    const telegram = (0, bot_clients_service_1.getTeambotTelegram)();
    const caption = [
        "<b>💳 Новая заявка на проверку оплаты</b>",
        `Заявка: #${requestId}`,
        `Клиент: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${(0, text_1.escapeHtml)(ctx.from.username)})` : ""}`,
        `Сумма: ${(0, text_1.formatMoney)(amount)}`,
        comment ? `Комментарий: ${(0, text_1.escapeHtml)(comment)}` : undefined,
    ]
        .filter(Boolean)
        .join("\n");
    for (const adminTelegramId of env_1.config.adminTelegramIds) {
        try {
            const media = (0, media_service_1.mediaInputFromReference)(receiptReference);
            if (media) {
                await telegram.sendPhoto(adminTelegramId, media, {
                    caption,
                    parse_mode: "HTML",
                    ...(0, admin_1.adminPaymentRequestKeyboard)(requestId),
                });
            }
            else {
                await telegram.sendMessage(adminTelegramId, caption, {
                    parse_mode: "HTML",
                    ...(0, admin_1.adminPaymentRequestKeyboard)(requestId),
                });
            }
        }
        catch {
            continue;
        }
    }
}
exports.paymentConfirmationScene = new telegraf_1.Scenes.WizardScene("service-payment-confirmation", async (ctx) => {
    ctx.session.paymentRequestDraft = {};
    await ctx.reply("Введите сумму пополнения одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите сумму пополнения текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await closeSceneToProfile(ctx, "Пополнение отменено.");
        return;
    }
    const amount = (0, validators_1.parsePositiveNumber)(ctx.message.text);
    if (!amount) {
        await ctx.reply("Введите корректную сумму пополнения числом.");
        return;
    }
    ctx.session.paymentRequestDraft = { amount };
    const transferDetails = await (0, settings_service_1.getTransferDetails)();
    await ctx.reply([
        "<b>💳 Реквизиты для перевода</b>",
        "",
        `Сумма: ${(0, text_1.formatMoney)(amount)}`,
        (0, text_1.escapeHtml)(transferDetails),
        "",
        "После перевода нажмите «Я перевел».",
    ].join("\n"), {
        parse_mode: "HTML",
        ...paidKeyboard,
    });
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Нажмите «Я перевел» или отмените пополнение.", paidKeyboard);
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await closeSceneToProfile(ctx, "Пополнение отменено.");
        return;
    }
    if (ctx.message.text !== PAID_BUTTON) {
        await ctx.reply("Используйте кнопку «Я перевел», когда перевод будет отправлен.", paidKeyboard);
        return;
    }
    await ctx.reply("Отправьте скриншот или фото чека перевода. При необходимости добавьте комментарий в подпись.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === constants_1.CANCEL_BUTTON) {
        await closeSceneToProfile(ctx, "Пополнение отменено.");
        return;
    }
    if (!ctx.message || !("photo" in ctx.message)) {
        await ctx.reply("Отправьте именно фото или скриншот чека.");
        return;
    }
    const user = ctx.state.user;
    const amount = ctx.session.paymentRequestDraft?.amount;
    const photoId = ctx.message.photo.at(-1)?.file_id;
    if (!user || !amount || !photoId) {
        await closeSceneToProfile(ctx, "Не удалось сохранить заявку. Попробуйте еще раз.");
        return;
    }
    const [receiptReference] = await (0, media_service_1.persistTelegramPhotoReferences)(ctx.telegram, [photoId], `payments/${user.id}`);
    const comment = ctx.message.caption?.trim();
    const request = await (0, payment_requests_service_1.createPaymentRequest)(user.id, amount, receiptReference, comment, user.referred_by_user_id ?? null);
    if (request) {
        await notifyAdminsAboutPaymentRequest(ctx, request.id, amount, receiptReference, comment);
    }
    await closeSceneToProfile(ctx, "Заявка на проверку оплаты отправлена администратору. После подтверждения баланс обновится автоматически.");
});
