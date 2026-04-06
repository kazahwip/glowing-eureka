"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const reviews_service_1 = require("../../services/reviews.service");
const views_1 = require("../../handlers/servicebot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
exports.reviewScene = new telegraf_1.Scenes.WizardScene("service-review", async (ctx) => {
    await ctx.reply("Напишите отзыв одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === constants_1.CANCEL_BUTTON) {
            await ctx.scene.leave();
            await (0, views_1.showReviewsPage)(ctx, 1);
            return;
        }
        const user = ctx.state.user;
        if (!user) {
            await ctx.reply("Сначала выполните /start.");
            return;
        }
        await (0, reviews_service_1.createReview)(user.id, ctx.message.text.trim());
        await ctx.scene.leave();
        await ctx.reply("Отзыв сохранён.");
        await (0, views_1.showReviewsPage)(ctx, 1);
        return;
    }
    await ctx.reply("Отправьте отзыв текстом.");
});
