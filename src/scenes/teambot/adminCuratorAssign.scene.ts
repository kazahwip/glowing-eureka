import { Markup, Scenes } from "telegraf";
import { assignCuratorToUser, listCurators } from "../../services/curators.service";
import { logAdminAction } from "../../services/logging.service";
import { getUserByTelegramId } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { parseTelegramId } from "../../utils/validators";
import { showAdminCurators, showAdminUserProfile } from "../../handlers/teambot/views";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

export const adminCuratorAssignScene = new Scenes.WizardScene<AppContext>(
  "admin-curator-assign",
  async (ctx) => {
    const presetTelegramId = ctx.session.curatorDraft?.userTelegramId;
    if (presetTelegramId) {
      const curators = await listCurators();
      await ctx.reply(
        `Пользователь выбран: ${presetTelegramId}. Введите ID куратора.\n\n${curators.map((item) => `${item.id}. ${item.name}`).join("\n") || "Кураторов пока нет."}`,
        cancelKeyboard,
      );
      return ctx.wizard.selectStep(1);
    }

    ctx.session.curatorDraft = {};
    await ctx.reply("Введите Telegram ID пользователя.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === "Отмена") {
        ctx.session.curatorDraft = undefined;
        await ctx.scene.leave();
        await showAdminCurators(ctx);
        return;
      }

      const userTelegramId = parseTelegramId(ctx.message.text);
      if (!userTelegramId) {
        await ctx.reply("Введите корректный Telegram ID.");
        return;
      }

      const user = await getUserByTelegramId(userTelegramId);
      if (!user) {
        await ctx.reply("Пользователь не найден.");
        return;
      }

      const curators = await listCurators();
      ctx.session.curatorDraft = { ...ctx.session.curatorDraft, userTelegramId };
      await ctx.reply(
        `Пользователь найден. Введите ID куратора.\n\n${curators.map((item) => `${item.id}. ${item.name}`).join("\n") || "Кураторов пока нет."}`,
        cancelKeyboard,
      );
      return ctx.wizard.next();
    }

    await ctx.reply("Введите Telegram ID текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      const userTelegramId = ctx.session.curatorDraft?.userTelegramId;
      if (ctx.message.text === "Отмена" || !userTelegramId) {
        ctx.session.curatorDraft = undefined;
        await ctx.scene.leave();
        await showAdminCurators(ctx);
        return;
      }

      const curatorId = parseTelegramId(ctx.message.text);
      if (!curatorId) {
        await ctx.reply("Введите корректный ID куратора.");
        return;
      }

      const user = await getUserByTelegramId(userTelegramId);
      if (!user) {
        await ctx.reply("Пользователь больше не найден.");
        return;
      }

      await assignCuratorToUser(user.id, curatorId);
      if (ctx.state.user) {
        await logAdminAction(ctx.state.user.id, "assign_curator", `user:${user.id}; curator:${curatorId}`);
      }

      ctx.session.curatorDraft = undefined;
      await ctx.scene.leave();
      await ctx.reply("Куратор назначен.");
      await showAdminUserProfile(ctx, user.id);
      return;
    }

    await ctx.reply("Введите ID куратора.");
  },
);
