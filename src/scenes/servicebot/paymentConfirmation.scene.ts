import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { config } from "../../config/env";
import { showServiceProfile } from "../../handlers/servicebot/views";
import { adminPaymentRequestKeyboard } from "../../keyboards/admin";
import { getTeambotTelegram } from "../../services/bot-clients.service";
import { persistTelegramPhotoReferences, mediaInputFromReference } from "../../services/media.service";
import { createPaymentRequest } from "../../services/payment-requests.service";
import { sendServicebotAuditEvent } from "../../services/servicebot-audit.service";
import { getTransferDetails } from "../../services/settings.service";
import type { AppContext } from "../../types/context";
import { escapeHtml, formatMoney } from "../../utils/text";
import { parsePositiveNumber } from "../../utils/validators";

const PAID_BUTTON = "✅ Я перевел";
const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();
const paidKeyboard = Markup.keyboard([[PAID_BUTTON], [CANCEL_BUTTON]]).resize();

async function closeSceneToProfile(ctx: AppContext, notice?: string) {
  ctx.session.paymentRequestDraft = undefined;
  await ctx.scene.leave();
  await ctx.reply(notice ?? "\u2063", Markup.removeKeyboard());
  await showServiceProfile(ctx);
}

async function notifyAdminsAboutPaymentRequest(
  ctx: AppContext,
  requestId: number,
  amount: number,
  receiptReference: string,
  comment?: string,
) {
  if (!ctx.from || !ctx.state.user) {
    return;
  }

  const telegram = getTeambotTelegram();
  const caption = [
    "<b>💳 Новая заявка на проверку оплаты</b>",
    `Заявка: #${requestId}`,
    `Клиент: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${escapeHtml(ctx.from.username)})` : ""}`,
    `Сумма: ${formatMoney(amount)}`,
    comment ? `Комментарий: ${escapeHtml(comment)}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  for (const adminTelegramId of config.adminTelegramIds) {
    try {
      const media = mediaInputFromReference(receiptReference);
      if (media) {
        await telegram.sendPhoto(adminTelegramId, media, {
          caption,
          parse_mode: "HTML",
          ...adminPaymentRequestKeyboard(requestId),
        });
      } else {
        await telegram.sendMessage(adminTelegramId, caption, {
          parse_mode: "HTML",
          ...adminPaymentRequestKeyboard(requestId),
        });
      }
    } catch {
      continue;
    }
  }
}

async function showTransferDetails(ctx: AppContext, amount: number) {
  const transferDetails = await getTransferDetails();
  await ctx.reply(
    [
      "<b>💳 Реквизиты для перевода</b>",
      "",
      `Сумма: ${formatMoney(amount)}`,
      escapeHtml(transferDetails),
      "",
      "После перевода нажмите «Я перевел».",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...paidKeyboard,
    },
  );
}

export const paymentConfirmationScene = new Scenes.WizardScene<AppContext>(
  "service-payment-confirmation",
  async (ctx) => {
    const presetAmount = ctx.session.paymentRequestDraft?.amount;
    if (presetAmount) {
      await showTransferDetails(ctx, presetAmount);
      return ctx.wizard.selectStep(2);
    }

    ctx.session.paymentRequestDraft = {};
    await ctx.reply("Введите сумму пополнения одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите сумму пополнения текстом.");
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await closeSceneToProfile(ctx, "Пополнение отменено.");
      return;
    }

    const amount = parsePositiveNumber(ctx.message.text);
    if (!amount) {
      await ctx.reply("Введите корректную сумму пополнения числом.");
      return;
    }

    ctx.session.paymentRequestDraft = { amount };
    await showTransferDetails(ctx, amount);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Нажмите «Я перевел» или отмените пополнение.", paidKeyboard);
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await closeSceneToProfile(ctx, "Пополнение отменено.");
      return;
    }

    if (ctx.message.text !== PAID_BUTTON) {
      await ctx.reply("Используйте кнопку «Я перевел», когда перевод будет отправлен.", paidKeyboard);
      return;
    }

    await ctx.reply("Отправьте скриншот или фото чека перевода. При необходимости добавьте комментарий в подпись.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === CANCEL_BUTTON) {
      await closeSceneToProfile(ctx, "Пополнение отменено.");
      return;
    }

    if (!ctx.message || !("photo" in ctx.message)) {
      await ctx.reply("Отправьте именно фото или скриншот чека.");
      return;
    }

    const user = ctx.state.user;
    const amount = ctx.session.paymentRequestDraft?.amount;
    const photoId = ctx.message.photo.at(-1)?.file_id;
    if (!user || !amount || !photoId) {
      await closeSceneToProfile(ctx, "Не удалось сохранить заявку. Попробуйте еще раз.");
      return;
    }

    const [receiptReference] = await persistTelegramPhotoReferences(ctx.telegram, [photoId], `payments/${user.id}`);
    const comment = ctx.message.caption?.trim();
    const request = await createPaymentRequest(
      user.id,
      amount,
      receiptReference,
      comment,
      ctx.session.paymentRequestDraft?.workerUserId ?? ctx.session.inlineWorkerUserId ?? user.referred_by_user_id ?? null,
    );

    if (request) {
      await notifyAdminsAboutPaymentRequest(ctx, request.id, amount, receiptReference, comment);
      await sendServicebotAuditEvent({
        telegramId: user.telegram_id,
        username: user.username,
        action: "uploaded_topup_receipt",
        details: `request_id=${request.id}; amount=${amount.toFixed(2)} RUB`,
      });
    }

    await closeSceneToProfile(
      ctx,
      "Заявка на проверку оплаты отправлена администратору. После подтверждения баланс обновится автоматически.",
    );
  },
);
