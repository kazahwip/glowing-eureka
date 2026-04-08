"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutDetailsScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const views_1 = require("../../handlers/teambot/views");
const users_service_1 = require("../../services/users.service");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
async function closeScene(ctx, notice) {
    await ctx.scene.leave();
    await ctx.reply(notice ?? "\u2063", telegraf_1.Markup.removeKeyboard());
    await (0, views_1.showWithdrawRequestsScreen)(ctx);
}
exports.payoutDetailsScene = new telegraf_1.Scenes.WizardScene("team-payout-details", async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        await ctx.scene.leave();
        return;
    }
    const lines = [
        "<b>💳 Реквизиты для выплаты</b>",
        "",
        user.payout_details ? `Текущие реквизиты:\n${user.payout_details}` : "Реквизиты пока не заполнены.",
        "",
        "Отправьте одним сообщением реквизиты для будущих выплат. Можно указать карту, телефон, банк и комментарий без дополнительной проверки формата.",
    ];
    await ctx.reply(lines.join("\n"), {
        parse_mode: "HTML",
        ...cancelKeyboard,
    });
    return ctx.wizard.next();
}, async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
        await ctx.reply("Отправьте реквизиты текстом.");
        return;
    }
    if (ctx.message.text === constants_1.CANCEL_BUTTON) {
        await closeScene(ctx, "Изменение реквизитов отменено.");
        return;
    }
    const user = ctx.state.user;
    const payoutDetails = ctx.message.text.trim();
    if (!user || !payoutDetails) {
        await closeScene(ctx, "Не удалось сохранить реквизиты. Попробуйте ещё раз.");
        return;
    }
    const updatedUser = await (0, users_service_1.updateUserPayoutDetails)(user.id, payoutDetails);
    if (updatedUser) {
        ctx.state.user = updatedUser;
    }
    await closeScene(ctx, "Реквизиты для выплаты сохранены.");
});
