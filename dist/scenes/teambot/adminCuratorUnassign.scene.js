"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCuratorUnassignScene = void 0;
const telegraf_1 = require("telegraf");
const logging_service_1 = require("../../services/logging.service");
const users_service_1 = require("../../services/users.service");
const curators_service_1 = require("../../services/curators.service");
const validators_1 = require("../../utils/validators");
const views_1 = require("../../handlers/teambot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
exports.adminCuratorUnassignScene = new telegraf_1.Scenes.WizardScene("admin-curator-unassign", async (ctx) => {
    await ctx.reply("Введите Telegram ID пользователя, у которого нужно снять куратора.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        await ctx.scene.leave();
        if (ctx.message.text === "Отмена") {
            await (0, views_1.showAdminCurators)(ctx);
            return;
        }
        const telegramId = (0, validators_1.parseTelegramId)(ctx.message.text);
        if (!telegramId) {
            await ctx.reply("Введите корректный Telegram ID.");
            await (0, views_1.showAdminCurators)(ctx);
            return;
        }
        const user = await (0, users_service_1.getUserByTelegramId)(telegramId);
        if (!user) {
            await ctx.reply("Пользователь не найден.");
            await (0, views_1.showAdminCurators)(ctx);
            return;
        }
        await (0, curators_service_1.unassignCuratorFromUser)(user.id);
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "unassign_curator", `user:${user.id}`);
        }
        await ctx.reply("Назначение снято.");
        await (0, views_1.showAdminUserProfile)(ctx, user.id);
        return;
    }
    await ctx.reply("Введите Telegram ID текстом.");
});
