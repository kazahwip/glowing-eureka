import { Markup, Scenes } from "telegraf";
import { searchUsers } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { formatUserLabel } from "../../utils/text";
import { showAdminUsersMenu } from "../../handlers/teambot/views";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

export const adminUserSearchScene = new Scenes.WizardScene<AppContext>(
  "admin-user-search",
  async (ctx) => {
    await ctx.reply("Введите Telegram ID, внутренний ID или username пользователя.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      await ctx.scene.leave();
      if (ctx.message.text === "Отмена") {
        await showAdminUsersMenu(ctx);
        return;
      }

      const users = await searchUsers(ctx.message.text.trim());
      if (!users.length) {
        await ctx.reply("Пользователи не найдены.");
        await showAdminUsersMenu(ctx);
        return;
      }

      await ctx.reply("<b>Результаты поиска</b>", {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            ...users.map((user) => [
              { text: `${user.id}. ${formatUserLabel(user)} (${user.telegram_id})`, callback_data: `admin:user:${user.id}:view` },
            ]),
            [{ text: "Назад", callback_data: "admin:users" }],
          ],
        },
      });
      return;
    }

    await ctx.reply("Введите поисковый запрос текстом.");
  },
);
