import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { config } from "../../config/env";
import { showWithdrawRequestsScreen } from "../../handlers/teambot/views";
import { adminProfitReportKeyboard } from "../../keyboards/admin";
import { getTeambotTelegram } from "../../services/bot-clients.service";
import { createProfitReport } from "../../services/profit-reports.service";
import type { AppContext } from "../../types/context";
import { escapeHtml, formatMoney, formatUserLabel } from "../../utils/text";
import { parsePositiveNumber } from "../../utils/validators";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

async function closeSceneToWithdraw(ctx: AppContext, notice?: string) {
  ctx.session.profitReportDraft = undefined;
  await ctx.scene.leave();

  if (notice) {
    await ctx.reply(notice, Markup.removeKeyboard());
  } else {
    await ctx.reply("\u2063", Markup.removeKeyboard());
  }

  await showWithdrawRequestsScreen(ctx);
}

async function notifyAdminsAboutProfitReport(ctx: AppContext, requestId: number, amount: number) {
  if (!ctx.from || !ctx.state.user) {
    return;
  }

  const text = [
    "<b>💸 Новая заявка о профите</b>",
    `Заявка: #${requestId}`,
    `Воркер: ${escapeHtml(formatUserLabel(ctx.state.user))}`,
    `Telegram ID: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${escapeHtml(ctx.from.username)})` : ""}`,
    `Сумма профита: ${formatMoney(amount)}`,
    "",
    "Подтверждение админом добавит профит в баланс AWAKE BOT и зачтёт его в кассу проекта.",
    "Выберите, как зачесть профит в кассу проекта.",
  ].join("\n");

  const telegram = getTeambotTelegram();
  for (const adminTelegramId of config.adminTelegramIds) {
    try {
      await telegram.sendMessage(adminTelegramId, text, {
        parse_mode: "HTML",
        ...adminProfitReportKeyboard(requestId),
      });
    } catch {
      continue;
    }
  }
}

export const profitReportScene = new Scenes.WizardScene<AppContext>(
  "team-profit-report",
  async (ctx) => {
    ctx.session.profitReportDraft = {};
    await ctx.reply("Введите сумму профита, которую нужно отправить на проверку.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите сумму текстом.");
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await closeSceneToWithdraw(ctx, "Отправка профита на проверку отменена.");
      return;
    }

    const amount = parsePositiveNumber(ctx.message.text);
    if (!amount) {
      await ctx.reply("Введите корректную сумму профита.");
      return;
    }

    const user = ctx.state.user;
    if (!user) {
      await closeSceneToWithdraw(ctx, "Не удалось создать заявку о профите. Попробуйте ещё раз.");
      return;
    }

    const result = await createProfitReport(user.id, amount);
    if (result.status !== "created" || !result.request) {
      await closeSceneToWithdraw(ctx, "Не удалось создать заявку о профите. Попробуйте ещё раз.");
      return;
    }

    await notifyAdminsAboutProfitReport(ctx, result.request.id, amount);
    await closeSceneToWithdraw(
      ctx,
      `Заявка о профите #${result.request.id} на ${formatMoney(amount)} отправлена администратору на проверку.`,
    );
  },
);
