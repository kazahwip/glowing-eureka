"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawRequestScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const env_1 = require("../../config/env");
const views_1 = require("../../handlers/teambot/views");
const admin_1 = require("../../keyboards/admin");
const bot_clients_service_1 = require("../../services/bot-clients.service");
const withdraw_requests_service_1 = require("../../services/withdraw-requests.service");
const users_service_1 = require("../../services/users.service");
const text_1 = require("../../utils/text");
const validators_1 = require("../../utils/validators");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
async function closeSceneToWithdraw(ctx, notice) {
    ctx.session.withdrawRequestDraft = undefined;
    await ctx.scene.leave();
    if (notice) {
        await ctx.reply(notice, telegraf_1.Markup.removeKeyboard());
    }
    else {
        await ctx.reply("\u2063", telegraf_1.Markup.removeKeyboard());
    }
    await (0, views_1.showWithdrawRequestsScreen)(ctx);
}
async function notifyAdminsAboutWithdrawRequest(ctx, requestId, amount, payoutDetails, comment) {
    if (!ctx.from || !ctx.state.user) {
        return;
    }
    const caption = [
        "<b>💸 Новая заявка на вывод</b>",
        `Заявка: #${requestId}`,
        `Воркер: ${(0, text_1.escapeHtml)((0, text_1.formatUserLabel)(ctx.state.user))}`,
        `Telegram ID: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${(0, text_1.escapeHtml)(ctx.from.username)})` : ""}`,
        `Сумма: ${(0, text_1.formatMoney)(amount)}`,
        `Реквизиты: ${(0, text_1.escapeHtml)(payoutDetails)}`,
        comment ? `Комментарий: ${(0, text_1.escapeHtml)(comment)}` : undefined,
    ]
        .filter(Boolean)
        .join("\n");
    const telegram = (0, bot_clients_service_1.getTeambotTelegram)();
    for (const adminTelegramId of env_1.config.adminTelegramIds) {
        try {
            await telegram.sendMessage(adminTelegramId, caption, {
                parse_mode: "HTML",
                ...(0, admin_1.adminWithdrawRequestKeyboard)(requestId),
            });
        }
        catch {
            continue;
        }
    }
}
exports.withdrawRequestScene = new telegraf_1.Scenes.WizardScene("team-withdraw-request", async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        await ctx.scene.leave();
        return;
    }
    if (user.withdrawable_balance <= 0) {
        await ctx.reply("Для вывода пока нет доступного баланса.");
        await ctx.scene.leave();
        return;
    }
    ctx.session.withdrawRequestDraft = {};
    await ctx.reply(`Введите сумму вывода. Сейчас доступно ${(0, text_1.formatMoney)(user.withdrawable_balance)}.`, cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите сумму текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await closeSceneToWithdraw(ctx, "Создание заявки на вывод отменено.");
        return;
    }
    const user = ctx.state.user;
    const amount = (0, validators_1.parsePositiveNumber)(ctx.message.text);
    if (!user || !amount) {
        await ctx.reply("Введите корректную сумму вывода.");
        return;
    }
    if (amount > user.withdrawable_balance) {
        await ctx.reply(`Недостаточно доступного баланса. Сейчас доступно ${(0, text_1.formatMoney)(user.withdrawable_balance)}.`);
        return;
    }
    const freshUser = await (0, users_service_1.getUserById)(user.id);
    const payoutDetails = freshUser?.payout_details?.trim() ?? "";
    if (!freshUser || !payoutDetails) {
        await closeSceneToWithdraw(ctx, "Сначала заполните реквизиты через кнопку «💳 Реквизиты для выплаты», затем создайте заявку ещё раз.");
        return;
    }
    ctx.session.withdrawRequestDraft = { amount };
    const result = await (0, withdraw_requests_service_1.createWithdrawRequest)(user.id, amount, payoutDetails);
    if (result.status === "insufficient_balance") {
        await closeSceneToWithdraw(ctx, "Недостаточно доступного баланса для новой заявки.");
        return;
    }
    if (result.status !== "created" || !result.request) {
        await closeSceneToWithdraw(ctx, "Не удалось создать заявку. Попробуйте ещё раз.");
        return;
    }
    await notifyAdminsAboutWithdrawRequest(ctx, result.request.id, amount, payoutDetails);
    if (ctx.state.user) {
        ctx.state.user = {
            ...ctx.state.user,
            payout_details: payoutDetails,
            withdrawable_balance: Math.max(0, ctx.state.user.withdrawable_balance - amount),
        };
    }
    await closeSceneToWithdraw(ctx, `Заявка #${result.request.id} на ${(0, text_1.formatMoney)(amount)} создана и отправлена админам на рассмотрение.`);
});
