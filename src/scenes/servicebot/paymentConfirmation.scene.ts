import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { config } from "../../config/env";
import { adminPaymentRequestKeyboard } from "../../keyboards/admin";
import { getTeambotTelegram } from "../../services/bot-clients.service";
import { createPaymentRequest } from "../../services/payment-requests.service";
import { mediaInputFromReference, persistTelegramPhotoReferences } from "../../services/media.service";
import type { AppContext } from "../../types/context";
import { escapeHtml, formatMoney } from "../../utils/text";
import { parsePositiveNumber } from "../../utils/validators";
import { showProfileTopupScreen } from "../../handlers/servicebot/views";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

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
    `Мамонт: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${escapeHtml(ctx.from.username)})` : ""}`,
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

export const paymentConfirmationScene = new Scenes.WizardScene<AppContext>(
  "service-payment-confirmation",
  async (ctx) => {
    ctx.session.paymentRequestDraft = {};
    await ctx.reply("Введите сумму перевода одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        ctx.session.paymentRequestDraft = undefined;
        await ctx.scene.leave();
        await showProfileTopupScreen(ctx);
        return;
      }

      const amount = parsePositiveNumber(ctx.message.text);
      if (!amount) {
        await ctx.reply("Введите корректную сумму перевода числом.");
        return;
      }

      ctx.session.paymentRequestDraft = { amount };
      await ctx.reply("Отправьте скриншот или фото чека перевода. При необходимости добавьте комментарий в подпись.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите сумму перевода текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === CANCEL_BUTTON) {
      ctx.session.paymentRequestDraft = undefined;
      await ctx.scene.leave();
      await showProfileTopupScreen(ctx);
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
      ctx.session.paymentRequestDraft = undefined;
      await ctx.scene.leave();
      await ctx.reply("Не удалось сохранить заявку. Попробуйте ещё раз.");
      await showProfileTopupScreen(ctx);
      return;
    }

    const [receiptReference] = await persistTelegramPhotoReferences(ctx.telegram, [photoId], `payments/${user.id}`);
    const comment = ctx.message.caption?.trim();
    const request = await createPaymentRequest(
      user.id,
      amount,
      receiptReference,
      comment,
      user.referred_by_user_id ?? null,
    );

    if (request) {
      await notifyAdminsAboutPaymentRequest(ctx, request.id, amount, receiptReference, comment);
    }

    ctx.session.paymentRequestDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply("Заявка на проверку оплаты отправлена администратору. После проверки баланс будет обновлён вручную.");
    await showProfileTopupScreen(ctx);
  },
);
