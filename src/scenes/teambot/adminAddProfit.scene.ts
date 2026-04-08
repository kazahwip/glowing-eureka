import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { showAdminProjectStats } from "../../handlers/teambot/views";
import { logAdminAction } from "../../services/logging.service";
import { createManualProfit } from "../../services/payment-requests.service";
import { notifyWorkerChatAboutProfit } from "../../services/project-profits.service";
import { recalculateProjectStats } from "../../services/settings.service";
import { getUserByTelegramId, getUserByUsername } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { formatUserLabel, formatMoney } from "../../utils/text";
import { parsePositiveNumber, parseTelegramId } from "../../utils/validators";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

function isWorkerLike(role: string, hasWorkerAccess: number) {
  return role === "worker" || role === "admin" || role === "curator" || hasWorkerAccess === 1;
}

async function resolveWorker(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const telegramId = parseTelegramId(trimmed);
  if (telegramId) {
    return getUserByTelegramId(telegramId);
  }

  if (trimmed.startsWith("@")) {
    return getUserByUsername(trimmed);
  }

  return null;
}

async function leaveToProjectStats(ctx: AppContext) {
  ctx.session.adminProfitDraft = undefined;
  await ctx.scene.leave();
  await showAdminProjectStats(ctx);
}

export const adminAddProfitScene = new Scenes.WizardScene<AppContext>(
  "admin-add-profit",
  async (ctx) => {
    ctx.session.adminProfitDraft = {};
    await ctx.reply("Введите Telegram ID или @username воркера, на которого нужно зачислить профит.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите Telegram ID или @username текстом.");
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await leaveToProjectStats(ctx);
      return;
    }

    const user = await resolveWorker(ctx.message.text);
    if (!user || !isWorkerLike(user.role, user.has_worker_access)) {
      await ctx.reply("Воркер не найден. Используйте Telegram ID или @username участника команды.");
      return;
    }

    ctx.session.adminProfitDraft = {
      workerUserId: user.id,
      workerLabel: formatUserLabel(user),
    };

    await ctx.reply(
      `Воркер: ${formatUserLabel(user)}\nВведите сумму профита в RUB.`,
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
      await leaveToProjectStats(ctx);
      return;
    }

    const amount = parsePositiveNumber(ctx.message.text);
    if (amount === null) {
      await ctx.reply("Введите корректную сумму профита.");
      return;
    }

    ctx.session.adminProfitDraft = {
      ...ctx.session.adminProfitDraft,
      amount,
    };

    await ctx.reply(
      "Введите комментарий для лога или отправьте '-' если комментарий не нужен.",
      cancelKeyboard,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите комментарий текстом или '-' для пропуска.");
      return;
    }

    const draft = ctx.session.adminProfitDraft;
    if (ctx.message.text === CANCEL_BUTTON || !draft?.workerUserId || !draft.amount) {
      await leaveToProjectStats(ctx);
      return;
    }

    const comment = ctx.message.text.trim() === "-" ? undefined : ctx.message.text.trim();
    if (!ctx.state.user) {
      await ctx.reply("????? ????????? ???? ? teambot. ????????? /start ? ?????????? ??? ???.");
      await leaveToProjectStats(ctx);
      return;
    }

    const result = await createManualProfit(ctx.state.user.id, draft.workerUserId, draft.amount, comment);

    if (result.status !== "created" || !result.request) {
      await ctx.reply("Не удалось добавить профит. Попробуйте ещё раз.");
      await leaveToProjectStats(ctx);
      return;
    }

    await recalculateProjectStats();
    if (ctx.state.user) {
      await logAdminAction(
        ctx.state.user.id,
        "create_manual_profit",
        `worker:${draft.workerUserId}; amount:${draft.amount}; comment:${comment ?? "-"}`,
      );
    }

    await notifyWorkerChatAboutProfit(result.request);

    await ctx.reply(
      [
        "✅ Профит добавлен.",
        `Воркер: ${draft.workerLabel ?? draft.workerUserId}`,
        `Сумма: ${formatMoney(draft.amount)}`,
        `Источник: Прямой перевод`,
      ].join("\n"),
    );

    await leaveToProjectStats(ctx);
  },
);
