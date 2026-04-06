import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { createReview } from "../../services/reviews.service";
import type { AppContext } from "../../types/context";
import { showReviewsPage } from "../../handlers/servicebot/views";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

export const reviewScene = new Scenes.WizardScene<AppContext>(
  "service-review",
  async (ctx) => {
    await ctx.reply("Напишите отзыв одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await ctx.scene.leave();
        await showReviewsPage(ctx, 1);
        return;
      }

      const user = ctx.state.user;
      if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
      }

      await createReview(user.id, ctx.message.text.trim());
      await ctx.scene.leave();
      await ctx.reply("Отзыв сохранён.");
      await showReviewsPage(ctx, 1);
      return;
    }

    await ctx.reply("Отправьте отзыв текстом.");
  },
);
