"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCuratorAddScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const views_1 = require("../../handlers/teambot/views");
const curators_service_1 = require("../../services/curators.service");
const logging_service_1 = require("../../services/logging.service");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
function parseCuratorInput(value) {
    const trimmed = value.trim();
    const match = trimmed.match(/^(@[A-Za-z0-9_]{4,32})\s+(.+)$/);
    if (!match) {
        return null;
    }
    const telegramUsername = (0, curators_service_1.normalizeTelegramUsername)(match[1]);
    const name = match[2].trim();
    if (!telegramUsername || !name) {
        return null;
    }
    return { telegramUsername, name };
}
async function leaveToCurators(ctx) {
    ctx.session.curatorDraft = undefined;
    await ctx.scene.leave();
    await (0, views_1.showAdminCurators)(ctx);
}
exports.adminCuratorAddScene = new telegraf_1.Scenes.WizardScene("admin-curator-add", async (ctx) => {
    ctx.session.curatorDraft = {};
    await ctx.reply("Введите куратора в формате: <code>@username Имя</code>", {
        parse_mode: "HTML",
        ...cancelKeyboard,
    });
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Отправьте данные куратора текстом.");
        return;
    }
    const text = ctx.message.text.trim();
    if (text === constants_1.CANCEL_BUTTON) {
        await leaveToCurators(ctx);
        return;
    }
    const parsed = parseCuratorInput(text);
    if (!parsed) {
        await ctx.reply("Неверный формат. Используйте: <code>@username Имя</code>", {
            parse_mode: "HTML",
        });
        return;
    }
    const curator = await (0, curators_service_1.createCurator)(parsed.telegramUsername, parsed.name);
    if (ctx.state.user) {
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "create_curator", `curator:${curator?.id ?? "n/a"}; username:@${parsed.telegramUsername}; name:${parsed.name}`);
    }
    await ctx.reply(curator?.linked_user_id
        ? `Куратор ${parsed.name} (@${parsed.telegramUsername}) добавлен и привязан к пользователю AWAKE BOT.`
        : `Куратор ${parsed.name} (@${parsed.telegramUsername}) добавлен. Привязка к AWAKE BOT появится после первого входа этого пользователя.`);
    await leaveToCurators(ctx);
});
