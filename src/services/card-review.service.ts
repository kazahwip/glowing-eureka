import { config } from "../config/env";
import { adminCardReviewKeyboard } from "../keyboards/admin";
import { getTeambotTelegram } from "./bot-clients.service";
import { getCardWithOwner, type CardWithOwner } from "./cards.service";
import { materializeCardPhotoReferences, mediaInputFromReference } from "./media.service";
import { escapeHtml, formatMoney, formatUserLabel, getCardCategoryTitle } from "../utils/text";

function buildReviewCaption(card: CardWithOwner) {
  const ownerLabel = card.owner_username ? `@${card.owner_username}` : card.owner_first_name || String(card.owner_telegram_id);

  return [
    "<b>📝 Новая анкета на проверку</b>",
    `Анкета: #${card.id}`,
    `Воркер: ${escapeHtml(ownerLabel)} (<code>${card.owner_telegram_id}</code>)`,
    `Категория: ${escapeHtml(getCardCategoryTitle(card.category))}`,
    `Город: ${escapeHtml(card.city)}`,
    `Имя: ${escapeHtml(card.name)}`,
    `Возраст: ${card.age}`,
    `1 час: ${formatMoney(card.price_1h)}`,
    `3 часа: ${formatMoney(card.price_3h)}`,
    `Весь день: ${formatMoney(card.price_full_day)}`,
    `Фото: ${card.photos.length}`,
  ].join("\n");
}

export async function notifyAdminsAboutCardReview(cardId: number) {
  const card = await getCardWithOwner(cardId);
  if (!card) {
    return;
  }

  let references: string[] = [];
  if (card.photos.length) {
    try {
      references = await materializeCardPhotoReferences(card.photos);
    } catch {
      references = [];
    }
  }

  const telegram = getTeambotTelegram();
  const caption = buildReviewCaption(card);

  for (const adminTelegramId of config.adminTelegramIds) {
    try {
      const firstReference = references[0];
      const media = firstReference ? mediaInputFromReference(firstReference) : null;
      if (media) {
        await telegram.sendPhoto(adminTelegramId, media, {
          caption,
          parse_mode: "HTML",
          ...adminCardReviewKeyboard(card.id),
        });
      } else {
        await telegram.sendMessage(adminTelegramId, caption, {
          parse_mode: "HTML",
          ...adminCardReviewKeyboard(card.id),
        });
      }
    } catch {
      continue;
    }
  }
}

export async function notifyWorkerAboutCardReviewDecision(
  card: CardWithOwner,
  decision: "approved" | "rejected",
) {
  const telegram = getTeambotTelegram();
  const text =
    decision === "approved"
      ? [
          "<b>✅ Анкета одобрена</b>",
          `Анкета #${card.id} прошла модерацию.`,
          "Теперь она опубликована в Honey Bunny.",
        ].join("\n")
      : [
          "<b>❌ Анкета отклонена</b>",
          `Анкета #${card.id} не прошла модерацию.`,
          "Проверьте данные и отправьте анкету заново.",
        ].join("\n");

  try {
    await telegram.sendMessage(card.owner_telegram_id, text, { parse_mode: "HTML" });
  } catch {
    // ignore delivery errors
  }
}

