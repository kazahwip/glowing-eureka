"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profitReportScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const env_1 = require("../../config/env");
const views_1 = require("../../handlers/teambot/views");
const admin_1 = require("../../keyboards/admin");
const bot_clients_service_1 = require("../../services/bot-clients.service");
const profit_reports_service_1 = require("../../services/profit-reports.service");
const text_1 = require("../../utils/text");
const validators_1 = require("../../utils/validators");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
async function closeSceneToWithdraw(ctx, notice) {
    ctx.session.profitReportDraft = undefined;
    await ctx.scene.leave();
    if (notice) {
        await ctx.reply(notice, telegraf_1.Markup.removeKeyboard());
    }
    else {
        await ctx.reply("\u2063", telegraf_1.Markup.removeKeyboard());
    }
    await (0, views_1.showWithdrawRequestsScreen)(ctx);
}
async function notifyAdminsAboutProfitReport(ctx, requestId, amount, payoutDetails) {
    if (!ctx.from || !ctx.state.user) {
        return;
    }
    const text = [
        "<b>💸 Новая заявка о профите</b>",
        `Заявка: #${requestId}`,
        `Воркер: ${(0, text_1.escapeHtml)((0, text_1.formatUserLabel)(ctx.state.user))}`,
        `Telegram ID: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${(0, text_1.escapeHtml)(ctx.from.username)})` : ""}`,
        `Сумма профита: ${(0, text_1.formatMoney)(amount)}`,
        `Реквизиты для выплаты: ${(0, text_1.escapeHtml)(payoutDetails)}`,
        "",
        "Выберите, как зачесть профит в кассу проекта.",
    ].join("\n");
    const telegram = (0, bot_clients_service_1.getTeambotTelegram)();
    for (const adminTelegramId of env_1.config.adminTelegramIds) {
        try {
            await telegram.sendMessage(adminTelegramId, text, {
                parse_mode: "HTML",
                ...(0, admin_1.adminProfitReportKeyboard)(requestId),
            });
        }
        catch {
            continue;
        }
    }
}
exports.profitReportScene = new telegraf_1.Scenes.WizardScene("team-profit-report", async (ctx) => {
    ctx.session.profitReportDraft = {};
    await ctx.reply("Введите сумму профита, которую нужно отправить на проверку.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите сумму текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await closeSceneToWithdraw(ctx, "Отправка профита на проверку отменена.");
        return;
    }
    const amount = (0, validators_1.parsePositiveNumber)(ctx.message.text);
    if (!amount) {
        await ctx.reply("Введите корректную сумму профита.");
        return;
    }
    ctx.session.profitReportDraft = { amount };
    await ctx.reply("Введите реквизиты для выплаты одним сообщением. Можно указать телефон, номер карты и банк без дополнительной проверки формата.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите реквизиты текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await closeSceneToWithdraw(ctx, "Отправка профита на проверку отменена.");
        return;
    }
    const user = ctx.state.user;
    const amount = ctx.session.profitReportDraft?.amount;
    const payoutDetails = ctx.message.text.trim();
    if (!user || !amount || !payoutDetails) {
        await closeSceneToWithdraw(ctx, "Не удалось создать заявку о профите. Попробуйте ещё раз.");
        return;
    }
    const result = await (0, profit_reports_service_1.createProfitReport)(user.id, amount, payoutDetails);
    if (result.status !== "created" || !result.request) {
        await closeSceneToWithdraw(ctx, "Не удалось создать заявку о профите. Попробуйте ещё раз.");
        return;
    }
    await notifyAdminsAboutProfitReport(ctx, result.request.id, amount, payoutDetails);
    await closeSceneToWithdraw(ctx, `Заявка о профите #${result.request.id} на ${(0, text_1.formatMoney)(amount)} отправлена администратору на проверку.`);
});
