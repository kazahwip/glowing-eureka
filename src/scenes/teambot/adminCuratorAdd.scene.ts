import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { showAdminCurators } from "../../handlers/teambot/views";
import { logAdminAction } from "../../services/logging.service";
import { createCurator } from "../../services/curators.service";
import type { AppContext } from "../../types/context";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

async function leaveToCurators(ctx: AppContext) {
  ctx.session.curatorDraft = undefined;
  await ctx.scene.leave();
  await showAdminCurators(ctx);
}

export const adminCuratorAddScene = new Scenes.WizardScene<AppContext>(
  "admin-curator-add",
  async (ctx) => {
    ctx.session.curatorDraft = {};
    await ctx.reply("Введите имя куратора.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      const text = ctx.message.text.trim();

      if (text === CANCEL_BUTTON) {
        await leaveToCurators(ctx);
        return;
      }

      if (!text) {
        await ctx.reply("Имя куратора не должно быть пустым.");
        return;
      }

      ctx.session.curatorDraft = { name: text };
      await ctx.reply("Введите описание куратора.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите имя текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      const text = ctx.message.text.trim();
      const draft = ctx.session.curatorDraft;

      if (text === CANCEL_BUTTON || !draft?.name) {
        await leaveToCurators(ctx);
        return;
      }

      const curator = await createCurator(draft.name, text);
      if (ctx.state.user) {
        await logAdminAction(ctx.state.user.id, "create_curator", `curator:${curator?.id ?? "n/a"}`);
      }

      await ctx.reply(`Куратор «${draft.name}» добавлен в список.`);
      await leaveToCurators(ctx);
      return;
    }

    await ctx.reply("Введите описание текстом.");
  },
);

