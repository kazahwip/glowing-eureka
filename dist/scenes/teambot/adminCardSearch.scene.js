"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCardSearchScene = void 0;
const telegraf_1 = require("telegraf");
const views_1 = require("../../handlers/teambot/views");
const cards_service_1 = require("../../services/cards.service");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
function parseCardId(raw) {
    const normalized = raw.trim().replace(/^#/, "");
    if (!/^\d+$/.test(normalized)) {
        return null;
    }
    const cardId = Number(normalized);
    return Number.isSafeInteger(cardId) && cardId > 0 ? cardId : null;
}
exports.adminCardSearchScene = new telegraf_1.Scenes.WizardScene("admin-card-search", async (ctx) => {
    await ctx.reply("Введите ID анкеты из Honey Bunny. Можно в формате `15` или `#15`.", {
        parse_mode: "Markdown",
        ...cancelKeyboard,
    });
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Введите ID анкеты текстом.");
        return;
    }
    await ctx.scene.leave();
    if (ctx.message.text === "Отмена") {
        await (0, views_1.showAdminCardsMenu)(ctx);
        return;
    }
    const cardId = parseCardId(ctx.message.text);
    if (!cardId) {
        await ctx.reply("Некорректный ID анкеты. Используйте число, например `27`.", {
            parse_mode: "Markdown",
        });
        await (0, views_1.showAdminCardsMenu)(ctx);
        return;
    }
    const card = await (0, cards_service_1.getCardWithOwner)(cardId);
    if (!card) {
        await ctx.reply(`Анкета #${cardId} не найдена.`);
        await (0, views_1.showAdminCardsMenu)(ctx);
        return;
    }
    await (0, views_1.showAdminCardProfile)(ctx, cardId);
});
