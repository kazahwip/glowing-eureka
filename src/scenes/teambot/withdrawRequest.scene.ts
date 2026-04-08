import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { config } from "../../config/env";
import { showWithdrawRequestsScreen } from "../../handlers/teambot/views";
import { adminWithdrawRequestKeyboard } from "../../keyboards/admin";
import { getTeambotTelegram } from "../../services/bot-clients.service";
import { createWithdrawRequest } from "../../services/withdraw-requests.service";
import type { AppContext } from "../../types/context";
import { escapeHtml, formatMoney, formatUserLabel } from "../../utils/text";
import { parsePositiveNumber } from "../../utils/validators";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

async function closeSceneToWithdraw(ctx: AppContext, notice?: string) {
  ctx.session.withdrawRequestDraft = undefined;
  await ctx.scene.leave();

  if (notice) {
    await ctx.reply(notice, Markup.removeKeyboard());
  } else {
    await ctx.reply("\u2063", Markup.removeKeyboard());
  }

  await showWithdrawRequestsScreen(ctx);
}

async function notifyAdminsAboutWithdrawRequest(ctx: AppContext, requestId: number, amount: number, payoutDetails: string, comment?: string) {
  if (!ctx.from || !ctx.state.user) {
    return;
  }

  const caption = [
    "<b>💸 Новая заявка на вывод</b>",
    `Заявка: #${requestId}`,
    `Воркер: ${escapeHtml(formatUserLabel(ctx.state.user))}`,
    `Telegram ID: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${escapeHtml(ctx.from.username)})` : ""}`,
    `Сумма: ${formatMoney(amount)}`,
    `Реквизиты: ${escapeHtml(payoutDetails)}`,
    comment ? `Комментарий: ${escapeHtml(comment)}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const telegram = getTeambotTelegram();
  for (const adminTelegramId of config.adminTelegramIds) {
    try {
      await telegram.sendMessage(adminTelegramId, caption, {
        parse_mode: "HTML",
        ...adminWithdrawRequestKeyboard(requestId),
      });
    } catch {
      continue;
    }
  }
}

export const withdrawRequestScene = new Scenes.WizardScene<AppContext>(
  "team-withdraw-request",
  async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      await ctx.reply("Сначала выполните /start.");
      await ctx.scene.leave();
      return;
    }

    if (user.withdrawable_balance <= 0) {
      await ctx.reply("Для вывода пока нет доступного баланса.");
      await ctx.scene.leave();
      return;
    }

    ctx.session.withdrawRequestDraft = {};
    await ctx.reply(
      `Введите сумму вывода. Сейчас доступно ${formatMoney(user.withdrawable_balance)}.`,
      cancelKeyboard,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите сумму текстом.");
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await closeSceneToWithdraw(ctx, "Создание заявки на вывод отменено.");
      return;
    }

    const user = ctx.state.user;
    const amount = parsePositiveNumber(ctx.message.text);
    if (!user || !amount) {
      await ctx.reply("Введите корректную сумму вывода.");
      return;
    }

    if (amount > user.withdrawable_balance) {
      await ctx.reply(`Недостаточно доступного баланса. Сейчас доступно ${formatMoney(user.withdrawable_balance)}.`);
      return;
    }

    ctx.session.withdrawRequestDraft = { amount };
    await ctx.reply(
      "Введите реквизиты для выплаты одним сообщением. Например: номер карты, банк и имя получателя.",
      cancelKeyboard,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите реквизиты текстом.");
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await closeSceneToWithdraw(ctx, "Создание заявки на вывод отменено.");
      return;
    }

    const draft = ctx.session.withdrawRequestDraft;
    const user = ctx.state.user;
    const payoutDetails = ctx.message.text.trim();
    if (!user || !draft?.amount || !payoutDetails) {
      await closeSceneToWithdraw(ctx, "Не удалось создать заявку. Попробуйте ещё раз.");
      return;
    }

    const result = await createWithdrawRequest(user.id, draft.amount, payoutDetails);
    if (result.status === "insufficient_balance") {
      await closeSceneToWithdraw(ctx, "Недостаточно доступного баланса для новой заявки.");
      return;
    }

    if (result.status !== "created" || !result.request) {
      await closeSceneToWithdraw(ctx, "Не удалось создать заявку. Попробуйте ещё раз.");
      return;
    }

    await notifyAdminsAboutWithdrawRequest(ctx, result.request.id, draft.amount, payoutDetails);
    if (ctx.state.user) {
      ctx.state.user = {
        ...ctx.state.user,
        withdrawable_balance: Math.max(0, ctx.state.user.withdrawable_balance - draft.amount),
      };
    }

    await closeSceneToWithdraw(
      ctx,
      `Заявка #${result.request.id} на ${formatMoney(draft.amount)} создана и отправлена админам на рассмотрение.`,
    );
  },
);
