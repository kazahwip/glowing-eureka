import { Markup, Scenes } from "telegraf";
import { showAdminUserProfile } from "../../handlers/teambot/views";
import { getWorkerProfitMetrics } from "../../services/kassa.service";
import { logAdminAction } from "../../services/logging.service";
import { getUserById, updateUserManualProfitMetrics } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { formatMoney } from "../../utils/text";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

function parseInteger(raw: string) {
  if (!/^\d+$/.test(raw.trim())) {
    return null;
  }

  return Number(raw.trim());
}

function parseAmount(raw: string) {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export const adminProfitMetricsScene = new Scenes.WizardScene<AppContext>(
  "admin-profit-metrics",
  async (ctx) => {
    const userId = ctx.session.adminProfitMetricsDraft?.userId;
    if (!userId) {
      await ctx.scene.leave();
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getUserById(userId);
    const metrics = await getWorkerProfitMetrics(userId);
    if (!user) {
      await ctx.scene.leave();
      await ctx.reply("Пользователь не найден.");
      return;
    }

    await ctx.reply(
      [
        "Введите новое количество профитов для пользователя.",
        `Сейчас: ${metrics.totalCount}`,
        `Сумма профитов: ${formatMoney(user.total_profit)}`,
      ].join("\n"),
      cancelKeyboard,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите количество профитов текстом.");
      return;
    }

    if (ctx.message.text === "Отмена") {
      const userId = ctx.session.adminProfitMetricsDraft?.userId;
      delete ctx.session.adminProfitMetricsDraft;
      await ctx.scene.leave();
      if (userId) {
        await showAdminUserProfile(ctx, userId);
      }
      return;
    }

    const totalCount = parseInteger(ctx.message.text);
    if (totalCount === null) {
      await ctx.reply("Некорректное количество. Используйте целое число.");
      return;
    }

    ctx.session.adminProfitMetricsDraft = {
      ...ctx.session.adminProfitMetricsDraft,
      totalCount,
    };
    await ctx.reply("Введите новую сумму профитов в RUB.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const draft = ctx.session.adminProfitMetricsDraft;
    const userId = draft?.userId;
    const totalCount = draft?.totalCount;
    delete ctx.session.adminProfitMetricsDraft;
    await ctx.scene.leave();

    if (!userId || totalCount === undefined) {
      await ctx.reply("Не удалось сохранить значения.");
      return;
    }

    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите сумму текстом.");
      await showAdminUserProfile(ctx, userId);
      return;
    }

    if (ctx.message.text === "Отмена") {
      await showAdminUserProfile(ctx, userId);
      return;
    }

    const totalAmount = parseAmount(ctx.message.text);
    if (totalAmount === null) {
      await ctx.reply("Некорректная сумма. Используйте формат `15000` или `15000.50`.", {
        parse_mode: "Markdown",
      });
      await showAdminUserProfile(ctx, userId);
      return;
    }

    const updatedUser = await updateUserManualProfitMetrics(userId, totalCount, totalAmount);
    if (!updatedUser) {
      await ctx.reply("Пользователь не найден.");
      return;
    }

    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "set_profit_metrics", `user:${userId}; count:${totalCount}; amount:${totalAmount}`);
    }

    await ctx.reply(`Профиты обновлены: ${totalCount} шт. • ${formatMoney(totalAmount)}.`);
    await showAdminUserProfile(ctx, userId);
  },
);
