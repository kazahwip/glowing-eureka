"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminWithdrawBalanceScene = void 0;
const telegraf_1 = require("telegraf");
const views_1 = require("../../handlers/teambot/views");
const logging_service_1 = require("../../services/logging.service");
const users_service_1 = require("../../services/users.service");
const text_1 = require("../../utils/text");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
function parseAmount(raw) {
    const normalized = raw.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        return null;
    }
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
exports.adminWithdrawBalanceScene = new telegraf_1.Scenes.WizardScene("admin-withdraw-balance", async (ctx) => {
    const userId = ctx.session.adminWithdrawBalanceDraft?.userId;
    if (!userId) {
        await ctx.scene.leave();
        await ctx.reply("Не удалось определить пользователя.");
        return;
    }
    const user = await (0, users_service_1.getUserById)(userId);
    if (!user) {
        await ctx.scene.leave();
        await ctx.reply("Пользователь не найден.");
        return;
    }
    await ctx.reply(`Введите новый баланс AWAKE BOT для вывода.\nСейчас доступно: ${(0, text_1.formatMoney)(user.withdrawable_balance)}.`, cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите сумму текстом.");
        return;
    }
    const userId = ctx.session.adminWithdrawBalanceDraft?.userId;
    delete ctx.session.adminWithdrawBalanceDraft;
    await ctx.scene.leave();
    if (!userId) {
        await ctx.reply("Не удалось определить пользователя.");
        return;
    }
    if (ctx.message.text === "Отмена") {
        await (0, views_1.showAdminUserProfile)(ctx, userId);
        return;
    }
    const amount = parseAmount(ctx.message.text);
    if (amount === null) {
        await ctx.reply("Некорректная сумма. Используйте формат `1500` или `1500.50`.", {
            parse_mode: "Markdown",
        });
        await (0, views_1.showAdminUserProfile)(ctx, userId);
        return;
    }
    const updatedUser = await (0, users_service_1.updateUserWithdrawableBalance)(userId, amount);
    if (!updatedUser) {
        await ctx.reply("Пользователь не найден.");
        return;
    }
    if (ctx.state.user) {
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "set_withdrawable_balance", `user:${userId}; amount:${amount}`);
    }
    await ctx.reply(`Баланс AWAKE BOT обновлён: ${(0, text_1.formatMoney)(amount)}.`);
    await (0, views_1.showAdminUserProfile)(ctx, userId);
});
