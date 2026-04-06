import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { showAdminCurators, showAdminUserProfile } from "../../handlers/teambot/views";
import { assignCuratorToUser, listCurators } from "../../services/curators.service";
import { logAdminAction } from "../../services/logging.service";
import { getUserByTelegramId } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { parseTelegramId } from "../../utils/validators";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

function formatCuratorsForPrompt(
  curators: Array<{ id: number; name: string; telegram_username: string | null }>,
) {
  if (!curators.length) {
    return "Кураторов пока нет.";
  }

  return curators.map((item) => `${item.id}. ${item.name}${item.telegram_username ? ` (@${item.telegram_username})` : ""}`).join("\n");
}

async function leaveToCurators(ctx: AppContext) {
  ctx.session.curatorDraft = undefined;
  await ctx.scene.leave();
  await showAdminCurators(ctx);
}

export const adminCuratorAssignScene = new Scenes.WizardScene<AppContext>(
  "admin-curator-assign",
  async (ctx) => {
    const presetTelegramId = ctx.session.curatorDraft?.userTelegramId;
    const curators = await listCurators();

    if (presetTelegramId) {
      await ctx.reply(
        `Пользователь выбран: ${presetTelegramId}\n\nВведите ID куратора:\n${formatCuratorsForPrompt(curators)}`,
        cancelKeyboard,
      );
      return ctx.wizard.selectStep(1);
    }

    ctx.session.curatorDraft = {};
    await ctx.reply("Введите Telegram ID пользователя.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите Telegram ID текстом.");
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await leaveToCurators(ctx);
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
    await ctx.reply(`Пользователь найден. Введите ID куратора:\n${formatCuratorsForPrompt(curators)}`, cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите ID куратора текстом.");
      return;
    }

    const userTelegramId = ctx.session.curatorDraft?.userTelegramId;
    if (ctx.message.text === CANCEL_BUTTON || !userTelegramId) {
      await leaveToCurators(ctx);
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
      await leaveToCurators(ctx);
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
  },
);
