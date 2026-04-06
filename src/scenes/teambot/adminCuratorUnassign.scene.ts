import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { showAdminCurators, showAdminUserProfile } from "../../handlers/teambot/views";
import { unassignCuratorFromUser } from "../../services/curators.service";
import { logAdminAction } from "../../services/logging.service";
import { getUserByTelegramId } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { parseTelegramId } from "../../utils/validators";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

export const adminCuratorUnassignScene = new Scenes.WizardScene<AppContext>(
  "admin-curator-unassign",
  async (ctx) => {
    await ctx.reply("Введите Telegram ID пользователя, у которого нужно снять куратора.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    await ctx.scene.leave();

    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите Telegram ID текстом.");
      await showAdminCurators(ctx);
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await showAdminCurators(ctx);
      return;
    }

    const telegramId = parseTelegramId(ctx.message.text);
    if (!telegramId) {
      await ctx.reply("Введите корректный Telegram ID.");
      await showAdminCurators(ctx);
      return;
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      await ctx.reply("Пользователь не найден.");
      await showAdminCurators(ctx);
      return;
    }

    await unassignCuratorFromUser(user.id);
    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "unassign_curator", `user:${user.id}`);
    }

    await ctx.reply("Назначение снято.");
    await showAdminUserProfile(ctx, user.id);
  },
);
