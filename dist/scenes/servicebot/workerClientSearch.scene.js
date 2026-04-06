"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerClientSearchScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const views_1 = require("../../handlers/servicebot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
exports.workerClientSearchScene = new telegraf_1.Scenes.WizardScene("worker-clients-search", async (ctx) => {
    await ctx.reply("Введите Telegram ID или username мамонта.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        await ctx.scene.leave();
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await (0, views_1.showWorkerClientsScreen)(ctx);
            return;
        }
        await (0, views_1.showWorkerClientsScreen)(ctx, ctx.message.text.trim());
        return;
    }
    await ctx.reply("Введите поисковый запрос текстом.");
});
