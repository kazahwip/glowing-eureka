import { Markup, Scenes } from "telegraf";
import { createCurator } from "../../services/curators.service";
import { logAdminAction } from "../../services/logging.service";
import type { AppContext } from "../../types/context";
import { showAdminCurators } from "../../handlers/teambot/views";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

export const adminCuratorAddScene = new Scenes.WizardScene<AppContext>(
  "admin-curator-add",
  async (ctx) => {
    ctx.session.curatorDraft = {};
    await ctx.reply("Введите имя куратора.", cancelKeyboard);
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

      ctx.session.curatorDraft = { name: ctx.message.text.trim() };
      await ctx.reply("Введите описание куратора.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите имя текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      const draft = ctx.session.curatorDraft;
      if (ctx.message.text === "Отмена" || !draft?.name) {
        ctx.session.curatorDraft = undefined;
        await ctx.scene.leave();
        await showAdminCurators(ctx);
        return;
      }

      const curator = await createCurator(draft.name, ctx.message.text.trim());
      if (ctx.state.user) {
        await logAdminAction(ctx.state.user.id, "create_curator", `curator:${curator?.id ?? "n/a"}`);
      }

      ctx.session.curatorDraft = undefined;
      await ctx.scene.leave();
      await ctx.reply("Куратор добавлен.");
      await showAdminCurators(ctx);
      return;
    }

    await ctx.reply("Введите описание текстом.");
  },
);
