import { Markup, Scenes } from "telegraf";
import { AVAILABLE_CITIES, CANCEL_BUTTON, DONE_BUTTON } from "../../config/constants";
import { showTeamWorkMenu } from "../../handlers/teambot/views";
import { teamWorkKeyboard } from "../../keyboards/teambot";
import { notifyAdminsAboutCardReview } from "../../services/card-review.service";
import { createCard } from "../../services/cards.service";
import { persistTelegramPhotoReferences } from "../../services/media.service";
import type { AppContext } from "../../types/context";
import type { CardCategory } from "../../types/entities";
import { parseAge, parsePositiveNumber } from "../../utils/validators";

const CATEGORY_OPTIONS: Array<{ label: string; value: CardCategory }> = [
  { label: "💋 Обычная девушка", value: "girls" },
  { label: "🌶 Девушка с перчиком", value: "pepper" },
];

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();
const photoKeyboard = Markup.keyboard([[DONE_BUTTON], [CANCEL_BUTTON]]).resize();
const categoryKeyboard = Markup.keyboard([
  [CATEGORY_OPTIONS[0].label],
  [CATEGORY_OPTIONS[1].label],
  [CANCEL_BUTTON],
]).resize();
const cityKeyboard = Markup.keyboard([
  [AVAILABLE_CITIES[0], AVAILABLE_CITIES[1]],
  [AVAILABLE_CITIES[2], AVAILABLE_CITIES[3]],
  [AVAILABLE_CITIES[4]],
  [CANCEL_BUTTON],
]).resize();

function parseCategory(text?: string): CardCategory | null {
  return CATEGORY_OPTIONS.find((item) => item.label === text)?.value ?? null;
}

function parseCity(text?: string) {
  return AVAILABLE_CITIES.find((city) => city === text) ?? null;
}

async function leaveToWorkMenu(ctx: AppContext, text: string) {
  ctx.session.cardDraft = undefined;
  await ctx.scene.leave();
  await ctx.reply(text, teamWorkKeyboard());
  await showTeamWorkMenu(ctx);
}

export const teamCreateCardScene = new Scenes.WizardScene<AppContext>(
  "team-create-card",
  async (ctx) => {
    ctx.session.cardDraft = { photos: [] };
    await ctx.reply(`Отправьте 3-4 фотографии анкеты. После загрузки нажмите «${DONE_BUTTON}».`, photoKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      if (ctx.message.text === DONE_BUTTON) {
        const count = ctx.session.cardDraft?.photos?.length ?? 0;
        if (count < 3 || count > 4) {
          await ctx.reply("Нужно загрузить от 3 до 4 фото.");
          return;
        }

        await ctx.reply("Выберите тип анкеты.", categoryKeyboard);
        return ctx.wizard.next();
      }
    }

    if (ctx.message && "photo" in ctx.message) {
      const draft = ctx.session.cardDraft;
      if (!draft) {
        await leaveToWorkMenu(ctx, "Сценарий сброшен.");
        return;
      }

      draft.photos = draft.photos ?? [];
      if (draft.photos.length >= 4) {
        await ctx.reply(`Уже загружено 4 фото. Нажмите «${DONE_BUTTON}» или «${CANCEL_BUTTON}».`);
        return;
      }

      const photo = ctx.message.photo.at(-1);
      if (photo) {
        draft.photos.push(photo.file_id);
      }

      await ctx.reply(
        draft.photos.length >= 3
          ? `Фото сохранено: ${draft.photos.length}/4. Можно отправить ещё одно фото или нажать «${DONE_BUTTON}».`
          : `Фото сохранено: ${draft.photos.length}/4. Загрузите ещё фото.`,
        photoKeyboard,
      );
      return;
    }

    await ctx.reply(`Отправьте фото или нажмите «${DONE_BUTTON}».`);
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      const category = parseCategory(ctx.message.text);
      if (!category) {
        await ctx.reply("Выберите один из двух вариантов кнопкой ниже.", categoryKeyboard);
        return;
      }

      ctx.session.cardDraft = { ...ctx.session.cardDraft, category };
      await ctx.reply("Введите имя.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Выберите тип анкеты кнопкой ниже.", categoryKeyboard);
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      ctx.session.cardDraft = { ...ctx.session.cardDraft, name: ctx.message.text.trim() };
      await ctx.reply("Введите возраст.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите имя текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      const age = parseAge(ctx.message.text);
      if (!age) {
        await ctx.reply("Возраст должен быть числом от 18 до 99.");
        return;
      }

      ctx.session.cardDraft = { ...ctx.session.cardDraft, age };
      await ctx.reply("Введите стоимость за 1 час.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите возраст числом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      const price = parsePositiveNumber(ctx.message.text);
      if (!price) {
        await ctx.reply("Введите корректную стоимость за 1 час.");
        return;
      }

      ctx.session.cardDraft = { ...ctx.session.cardDraft, price1h: price };
      await ctx.reply("Введите стоимость за 3 часа.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите стоимость текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      const price = parsePositiveNumber(ctx.message.text);
      if (!price) {
        await ctx.reply("Введите корректную стоимость за 3 часа.");
        return;
      }

      ctx.session.cardDraft = { ...ctx.session.cardDraft, price3h: price };
      await ctx.reply("Введите стоимость за весь день.", cancelKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите стоимость текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      const price = parsePositiveNumber(ctx.message.text);
      if (!price) {
        await ctx.reply("Введите корректную стоимость за весь день.");
        return;
      }

      ctx.session.cardDraft = { ...ctx.session.cardDraft, priceFullDay: price };
      await ctx.reply("Выберите город кнопкой ниже.", cityKeyboard);
      return ctx.wizard.next();
    }

    await ctx.reply("Введите стоимость текстом.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await leaveToWorkMenu(ctx, "Создание анкеты отменено.");
        return;
      }

      const city = parseCity(ctx.message.text);
      if (!city) {
        await ctx.reply("Выберите город кнопкой ниже.", cityKeyboard);
        return;
      }

      const user = ctx.state.user;
      if (!user) {
        await leaveToWorkMenu(ctx, "Пользователь не найден. Выполните /start заново.");
        return;
      }

      ctx.session.cardDraft = { ...ctx.session.cardDraft, city };
      ctx.session.cardDraft.photos = await persistTelegramPhotoReferences(
        ctx.telegram,
        ctx.session.cardDraft.photos ?? [],
        `cards/${user.id}`,
      );

      const card = await createCard(user.id, ctx.session.cardDraft, {
        reviewStatus: "pending",
        isActive: false,
        source: "user",
      });

      if (card) {
        await notifyAdminsAboutCardReview(card.id);
      }

      await leaveToWorkMenu(ctx, "Анкета отправлена администраторам на проверку. После одобрения она появится в Honey Bunny.");
      return;
    }

    await ctx.reply("Выберите город кнопкой ниже.", cityKeyboard);
  },
);

