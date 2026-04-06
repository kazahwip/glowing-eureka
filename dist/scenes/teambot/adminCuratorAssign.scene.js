"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCuratorAssignScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const views_1 = require("../../handlers/teambot/views");
const curators_service_1 = require("../../services/curators.service");
const logging_service_1 = require("../../services/logging.service");
const users_service_1 = require("../../services/users.service");
const validators_1 = require("../../utils/validators");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
function formatCuratorsForPrompt(curators) {
    if (!curators.length) {
        return "Кураторов пока нет.";
    }
    return curators.map((item) => `${item.id}. ${item.name}${item.telegram_username ? ` (@${item.telegram_username})` : ""}`).join("\n");
}
async function leaveToCurators(ctx) {
    ctx.session.curatorDraft = undefined;
    await ctx.scene.leave();
    await (0, views_1.showAdminCurators)(ctx);
}
exports.adminCuratorAssignScene = new telegraf_1.Scenes.WizardScene("admin-curator-assign", async (ctx) => {
    const presetTelegramId = ctx.session.curatorDraft?.userTelegramId;
    const curators = await (0, curators_service_1.listCurators)();
    if (presetTelegramId) {
        await ctx.reply(`Пользователь выбран: ${presetTelegramId}\n\nВведите ID куратора:\n${formatCuratorsForPrompt(curators)}`, cancelKeyboard);
        return ctx.wizard.selectStep(1);
    }
    ctx.session.curatorDraft = {};
    await ctx.reply("Введите Telegram ID пользователя.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите Telegram ID текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await leaveToCurators(ctx);
        return;
    }
    const userTelegramId = (0, validators_1.parseTelegramId)(ctx.message.text);
    if (!userTelegramId) {
        await ctx.reply("Введите корректный Telegram ID.");
        return;
    }
    const user = await (0, users_service_1.getUserByTelegramId)(userTelegramId);
    if (!user) {
        await ctx.reply("Пользователь не найден.");
        return;
    }
    const curators = await (0, curators_service_1.listCurators)();
    ctx.session.curatorDraft = { ...ctx.session.curatorDraft, userTelegramId };
    await ctx.reply(`Пользователь найден. Введите ID куратора:\n${formatCuratorsForPrompt(curators)}`, cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите ID куратора текстом.");
        return;
    }
    const userTelegramId = ctx.session.curatorDraft?.userTelegramId;
    if (ctx.message.text === constants_1.CANCEL_BUTTON || !userTelegramId) {
        await leaveToCurators(ctx);
        return;
    }
    const curatorId = (0, validators_1.parseTelegramId)(ctx.message.text);
    if (!curatorId) {
        await ctx.reply("Введите корректный ID куратора.");
        return;
    }
    const user = await (0, users_service_1.getUserByTelegramId)(userTelegramId);
    if (!user) {
        await ctx.reply("Пользователь больше не найден.");
        await leaveToCurators(ctx);
        return;
    }
    await (0, curators_service_1.assignCuratorToUser)(user.id, curatorId);
    if (ctx.state.user) {
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "assign_curator", `user:${user.id}; curator:${curatorId}`);
    }
    ctx.session.curatorDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply("Куратор назначен.");
    await (0, views_1.showAdminUserProfile)(ctx, user.id);
});
