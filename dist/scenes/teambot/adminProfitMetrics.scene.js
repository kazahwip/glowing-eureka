"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminProfitMetricsScene = void 0;
const telegraf_1 = require("telegraf");
const views_1 = require("../../handlers/teambot/views");
const kassa_service_1 = require("../../services/kassa.service");
const logging_service_1 = require("../../services/logging.service");
const users_service_1 = require("../../services/users.service");
const text_1 = require("../../utils/text");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
function parseInteger(raw) {
    if (!/^\d+$/.test(raw.trim())) {
        return null;
    }
    return Number(raw.trim());
}
function parseAmount(raw) {
    const normalized = raw.trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        return null;
    }
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
exports.adminProfitMetricsScene = new telegraf_1.Scenes.WizardScene("admin-profit-metrics", async (ctx) => {
    const userId = ctx.session.adminProfitMetricsDraft?.userId;
    if (!userId) {
        await ctx.scene.leave();
        await ctx.reply("Не удалось определить пользователя.");
        return;
    }
    const user = await (0, users_service_1.getUserById)(userId);
    const metrics = await (0, kassa_service_1.getWorkerProfitMetrics)(userId);
    if (!user) {
        await ctx.scene.leave();
        await ctx.reply("Пользователь не найден.");
        return;
    }
    await ctx.reply([
        "Введите новое количество профитов для пользователя.",
        `Сейчас: ${metrics.totalCount}`,
        `Сумма профитов: ${(0, text_1.formatMoney)(user.total_profit)}`,
    ].join("\n"), cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите количество профитов текстом.");
        return;
    }
    if (ctx.message.text === "Отмена") {
        const userId = ctx.session.adminProfitMetricsDraft?.userId;
        delete ctx.session.adminProfitMetricsDraft;
        await ctx.scene.leave();
        if (userId) {
            await (0, views_1.showAdminUserProfile)(ctx, userId);
        }
        return;
    }
    const totalCount = parseInteger(ctx.message.text);
    if (totalCount === null) {
        await ctx.reply("Некорректное количество. Используйте целое число.");
        return;
    }
    ctx.session.adminProfitMetricsDraft = {
        ...ctx.session.adminProfitMetricsDraft,
        totalCount,
    };
    await ctx.reply("Введите новую сумму профитов в RUB.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    const draft = ctx.session.adminProfitMetricsDraft;
    const userId = draft?.userId;
    const totalCount = draft?.totalCount;
    delete ctx.session.adminProfitMetricsDraft;
    await ctx.scene.leave();
    if (!userId || totalCount === undefined) {
        await ctx.reply("Не удалось сохранить значения.");
        return;
    }
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите сумму текстом.");
        await (0, views_1.showAdminUserProfile)(ctx, userId);
        return;
    }
    if (ctx.message.text === "Отмена") {
        await (0, views_1.showAdminUserProfile)(ctx, userId);
        return;
    }
    const totalAmount = parseAmount(ctx.message.text);
    if (totalAmount === null) {
        await ctx.reply("Некорректная сумма. Используйте формат `15000` или `15000.50`.", {
            parse_mode: "Markdown",
        });
        await (0, views_1.showAdminUserProfile)(ctx, userId);
        return;
    }
    const updatedUser = await (0, users_service_1.updateUserManualProfitMetrics)(userId, totalCount, totalAmount);
    if (!updatedUser) {
        await ctx.reply("Пользователь не найден.");
        return;
    }
    if (ctx.state.user) {
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "set_profit_metrics", `user:${userId}; count:${totalCount}; amount:${totalAmount}`);
    }
    await ctx.reply(`Профиты обновлены: ${totalCount} шт. • ${(0, text_1.formatMoney)(totalAmount)}.`);
    await (0, views_1.showAdminUserProfile)(ctx, userId);
});
