"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUserSearchScene = void 0;
const telegraf_1 = require("telegraf");
const users_service_1 = require("../../services/users.service");
const text_1 = require("../../utils/text");
const views_1 = require("../../handlers/teambot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
exports.adminUserSearchScene = new telegraf_1.Scenes.WizardScene("admin-user-search", async (ctx) => {
    await ctx.reply("Введите Telegram ID, внутренний ID или username пользователя.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        await ctx.scene.leave();
        if (ctx.message.text === "Отмена") {
            await (0, views_1.showAdminUsersMenu)(ctx);
            return;
        }
        const users = await (0, users_service_1.searchUsers)(ctx.message.text.trim());
        if (!users.length) {
            await ctx.reply("Пользователи не найдены.");
            await (0, views_1.showAdminUsersMenu)(ctx);
            return;
        }
        await ctx.reply("<b>Результаты поиска</b>", {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    ...users.map((user) => [
                        { text: `${user.id}. ${(0, text_1.formatUserLabel)(user)} (${user.telegram_id})`, callback_data: `admin:user:${user.id}:view` },
                    ]),
                    [{ text: "Назад", callback_data: "admin:users" }],
                ],
            },
        });
        return;
    }
    await ctx.reply("Введите поисковый запрос текстом.");
});
