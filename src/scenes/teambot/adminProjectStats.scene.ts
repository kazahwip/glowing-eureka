import { Markup, Scenes } from "telegraf";
import { logAdminAction } from "../../services/logging.service";
import { setProjectStats } from "../../services/settings.service";
import type { AppContext } from "../../types/context";
import { parsePositiveNumber } from "../../utils/validators";
import { showAdminProjectStats } from "../../handlers/teambot/views";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

export const adminProjectStatsScene = new Scenes.WizardScene<AppContext>(
  "admin-project-stats-edit",
  async (ctx) => {
    ctx.session.projectStatsDraft = {};
    await ctx.reply("Введите количество профитов.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === "Отмена") {
        ctx.session.projectStatsDraft = undefined;
        await ctx.scene.leave();
        await showAdminProjectStats(ctx);
        return;
      }

      const value = parsePositiveNumber(ctx.message.text) ?? 0;
      ctx.session.projectStatsDraft = { totalProfits: Math.floor(value) };
      await ctx.reply("Введите сумму профитов.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите число текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === "Отмена") {
        ctx.session.projectStatsDraft = undefined;
        await ctx.scene.leave();
        await showAdminProjectStats(ctx);
        return;
      }

      const value = parsePositiveNumber(ctx.message.text) ?? 0;
      ctx.session.projectStatsDraft = {
        ...ctx.session.projectStatsDraft,
        totalProfitAmount: value,
      };
      await ctx.reply("Введите процент выплат.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите сумму текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      const draft = ctx.session.projectStatsDraft;
      if (ctx.message.text === "Отмена" || !draft) {
        ctx.session.projectStatsDraft = undefined;
        await ctx.scene.leave();
        await showAdminProjectStats(ctx);
        return;
      }

      const value = parsePositiveNumber(ctx.message.text);
      if (value === null) {
        await ctx.reply("Введите корректный процент выплат.");
        return;
      }

      await setProjectStats({
        totalProfits: draft.totalProfits ?? 0,
        totalProfitAmount: draft.totalProfitAmount ?? 0,
        payoutPercent: value,
      });

      if (ctx.state.user) {
        await logAdminAction(ctx.state.user.id, "update_project_stats", JSON.stringify(draft));
      }

      ctx.session.projectStatsDraft = undefined;
      await ctx.scene.leave();
      await ctx.reply("Статистика проекта обновлена.");
      await showAdminProjectStats(ctx);
      return;
    }

    await ctx.reply("Введите процент текстом.");
  },
);
