"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const env_1 = require("../../config/env");
const support_service_1 = require("../../services/support.service");
const views_1 = require("../../handlers/servicebot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
async function notifySupport(ctx, text) {
    for (const telegramId of env_1.config.supportNotifyIds.length ? env_1.config.supportNotifyIds : env_1.config.adminTelegramIds) {
        try {
            await ctx.telegram.sendMessage(telegramId, text, { parse_mode: "HTML" });
        }
        catch {
            continue;
        }
    }
}
exports.supportScene = new telegraf_1.Scenes.WizardScene("service-support", async (ctx) => {
    await ctx.reply("Опишите обращение одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await ctx.scene.leave();
            await (0, views_1.showSupportScreen)(ctx);
            return;
        }
        const user = ctx.state.user;
        if (!user) {
            await ctx.reply("Сначала выполните /start.");
            return;
        }
        const ticket = await (0, support_service_1.createSupportTicket)(user.id, ctx.message.text.trim());
        await notifySupport(ctx, [
            "<b>Новое обращение в поддержку</b>",
            `Пользователь: <code>${user.telegram_id}</code>`,
            `Тикет: #${ticket?.id ?? "n/a"}`,
            `Сообщение: ${ctx.message.text.trim()}`,
        ].join("\n"));
        await ctx.scene.leave();
        await ctx.reply("Обращение сохранено. Оператор получит уведомление.");
        await (0, views_1.showSupportScreen)(ctx);
        return;
    }
    await ctx.reply("Отправьте текст обращения одним сообщением.");
});
