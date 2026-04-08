"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAddProfitScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const views_1 = require("../../handlers/teambot/views");
const logging_service_1 = require("../../services/logging.service");
const payment_requests_service_1 = require("../../services/payment-requests.service");
const project_profits_service_1 = require("../../services/project-profits.service");
const settings_service_1 = require("../../services/settings.service");
const users_service_1 = require("../../services/users.service");
const text_1 = require("../../utils/text");
const validators_1 = require("../../utils/validators");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
function isWorkerLike(role, hasWorkerAccess) {
    return role === "worker" || role === "admin" || role === "curator" || hasWorkerAccess === 1;
}
async function resolveWorker(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }
    const telegramId = (0, validators_1.parseTelegramId)(trimmed);
    if (telegramId) {
        return (0, users_service_1.getUserByTelegramId)(telegramId);
    }
    if (trimmed.startsWith("@")) {
        return (0, users_service_1.getUserByUsername)(trimmed);
    }
    return null;
}
async function leaveToProjectStats(ctx) {
    ctx.session.adminProfitDraft = undefined;
    await ctx.scene.leave();
    await (0, views_1.showAdminProjectStats)(ctx);
}
exports.adminAddProfitScene = new telegraf_1.Scenes.WizardScene("admin-add-profit", async (ctx) => {
    ctx.session.adminProfitDraft = {};
    await ctx.reply("Введите Telegram ID или @username воркера, на которого нужно зачислить профит.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите Telegram ID или @username текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await leaveToProjectStats(ctx);
        return;
    }
    const user = await resolveWorker(ctx.message.text);
    if (!user || !isWorkerLike(user.role, user.has_worker_access)) {
        await ctx.reply("Воркер не найден. Используйте Telegram ID или @username участника команды.");
        return;
    }
    ctx.session.adminProfitDraft = {
        workerUserId: user.id,
        workerLabel: (0, text_1.formatUserLabel)(user),
    };
    await ctx.reply(`Воркер: ${(0, text_1.formatUserLabel)(user)}\nВведите сумму профита в RUB.`, cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите сумму текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await leaveToProjectStats(ctx);
        return;
    }
    const amount = (0, validators_1.parsePositiveNumber)(ctx.message.text);
    if (amount === null) {
        await ctx.reply("Введите корректную сумму профита.");
        return;
    }
    ctx.session.adminProfitDraft = {
        ...ctx.session.adminProfitDraft,
        amount,
    };
    await ctx.reply("Введите комментарий для лога или отправьте '-' если комментарий не нужен.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите комментарий текстом или '-' для пропуска.");
        return;
    }
    const draft = ctx.session.adminProfitDraft;
    if (ctx.message.text === constants_1.CANCEL_BUTTON || !draft?.workerUserId || !draft.amount) {
        await leaveToProjectStats(ctx);
        return;
    }
    const comment = ctx.message.text.trim() === "-" ? undefined : ctx.message.text.trim();
    if (!ctx.state.user) {
        await ctx.reply("Сначала войдите в AWAKE BOT. Выполните /start и повторите ещё раз.");
        await leaveToProjectStats(ctx);
        return;
    }
    const result = await (0, payment_requests_service_1.createManualProfit)(ctx.state.user.id, draft.workerUserId, draft.amount, comment);
    if (result.status !== "created" || !result.request) {
        await ctx.reply("Не удалось добавить профит. Попробуйте ещё раз.");
        await leaveToProjectStats(ctx);
        return;
    }
    await (0, settings_service_1.recalculateProjectStats)();
    if (ctx.state.user) {
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "create_manual_profit", `worker:${draft.workerUserId}; amount:${draft.amount}; comment:${comment ?? "-"}`);
    }
    await (0, project_profits_service_1.notifyWorkerChatAboutProfit)(result.request);
    await ctx.reply([
        "✅ Профит добавлен.",
        `Воркер: ${draft.workerLabel ?? draft.workerUserId}`,
        `Сумма: ${(0, text_1.formatMoney)(draft.amount)}`,
        `Источник: Прямой перевод`,
    ].join("\n"));
    await leaveToProjectStats(ctx);
});
