"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentConfirmationScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const env_1 = require("../../config/env");
const admin_1 = require("../../keyboards/admin");
const bot_clients_service_1 = require("../../services/bot-clients.service");
const payment_requests_service_1 = require("../../services/payment-requests.service");
const media_service_1 = require("../../services/media.service");
const text_1 = require("../../utils/text");
const validators_1 = require("../../utils/validators");
const views_1 = require("../../handlers/servicebot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
async function notifyAdminsAboutPaymentRequest(ctx, requestId, amount, receiptReference, comment) {
    if (!ctx.from || !ctx.state.user) {
        return;
    }
    const telegram = (0, bot_clients_service_1.getTeambotTelegram)();
    const caption = [
        "<b>💳 Новая заявка на проверку оплаты</b>",
        `Заявка: #${requestId}`,
        `Мамонт: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${(0, text_1.escapeHtml)(ctx.from.username)})` : ""}`,
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
    await ctx.reply("Введите сумму перевода одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            ctx.session.paymentRequestDraft = undefined;
            await ctx.scene.leave();
            await (0, views_1.showProfileTopupScreen)(ctx);
            return;
        }
        const amount = (0, validators_1.parsePositiveNumber)(ctx.message.text);
        if (!amount) {
            await ctx.reply("Введите корректную сумму перевода числом.");
            return;
        }
        ctx.session.paymentRequestDraft = { amount };
        await ctx.reply("Отправьте скриншот или фото чека перевода. При необходимости добавьте комментарий в подпись.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите сумму перевода текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === constants_1.CANCEL_BUTTON) {
        ctx.session.paymentRequestDraft = undefined;
        await ctx.scene.leave();
        await (0, views_1.showProfileTopupScreen)(ctx);
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
        ctx.session.paymentRequestDraft = undefined;
        await ctx.scene.leave();
        await ctx.reply("Не удалось сохранить заявку. Попробуйте ещё раз.");
        await (0, views_1.showProfileTopupScreen)(ctx);
        return;
    }
    const [receiptReference] = await (0, media_service_1.persistTelegramPhotoReferences)(ctx.telegram, [photoId], `payments/${user.id}`);
    const comment = ctx.message.caption?.trim();
    const request = await (0, payment_requests_service_1.createPaymentRequest)(user.id, amount, receiptReference, comment, user.referred_by_user_id ?? null);
    if (request) {
        await notifyAdminsAboutPaymentRequest(ctx, request.id, amount, receiptReference, comment);
    }
    ctx.session.paymentRequestDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply("Заявка на проверку оплаты отправлена администратору. После проверки баланс будет обновлён вручную.");
    await (0, views_1.showProfileTopupScreen)(ctx);
});
