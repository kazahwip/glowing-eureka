import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import type { AppContext } from "../../types/context";
import { showWorkerClientsScreen } from "../../handlers/servicebot/views";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

export const workerClientSearchScene = new Scenes.WizardScene<AppContext>(
  "worker-clients-search",
  async (ctx) => {
    await ctx.reply("Введите Telegram ID или username мамонта.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      await ctx.scene.leave();
      if (ctx.message.text === CANCEL_BUTTON) {
        await showWorkerClientsScreen(ctx);
        return;
      }

      await showWorkerClientsScreen(ctx, ctx.message.text.trim());
      return;
    }

    await ctx.reply("Введите поисковый запрос текстом.");
  },
);
