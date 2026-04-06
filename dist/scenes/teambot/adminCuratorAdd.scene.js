"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCuratorAddScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const views_1 = require("../../handlers/teambot/views");
const logging_service_1 = require("../../services/logging.service");
const curators_service_1 = require("../../services/curators.service");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
async function leaveToCurators(ctx) {
    ctx.session.curatorDraft = undefined;
    await ctx.scene.leave();
    await (0, views_1.showAdminCurators)(ctx);
}
exports.adminCuratorAddScene = new telegraf_1.Scenes.WizardScene("admin-curator-add", async (ctx) => {
    ctx.session.curatorDraft = {};
    await ctx.reply("Введите имя куратора.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        const text = ctx.message.text.trim();
        if (text === constants_1.CANCEL_BUTTON) {
            await leaveToCurators(ctx);
            return;
        }
        if (!text) {
            await ctx.reply("Имя куратора не должно быть пустым.");
            return;
        }
        ctx.session.curatorDraft = { name: text };
        await ctx.reply("Введите описание куратора.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите имя текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        const text = ctx.message.text.trim();
        const draft = ctx.session.curatorDraft;
        if (text === constants_1.CANCEL_BUTTON || !draft?.name) {
            await leaveToCurators(ctx);
            return;
        }
        const curator = await (0, curators_service_1.createCurator)(draft.name, text);
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "create_curator", `curator:${curator?.id ?? "n/a"}`);
        }
        await ctx.reply(`Куратор «${draft.name}» добавлен в список.`);
        await leaveToCurators(ctx);
        return;
    }
    await ctx.reply("Введите описание текстом.");
});
