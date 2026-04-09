import { Markup, Scenes } from "telegraf";
import { showAdminCardProfile, showAdminCardsMenu } from "../../handlers/teambot/views";
import { getCardWithOwner } from "../../services/cards.service";
import type { AppContext } from "../../types/context";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

function parseCardId(raw: string) {
  const normalized = raw.trim().replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const cardId = Number(normalized);
  return Number.isSafeInteger(cardId) && cardId > 0 ? cardId : null;
}

export const adminCardSearchScene = new Scenes.WizardScene<AppContext>(
  "admin-card-search",
  async (ctx) => {
    await ctx.reply("Введите ID анкеты из Honey Bunny. Можно в формате `15` или `#15`.", {
      parse_mode: "Markdown",
      ...cancelKeyboard,
    });
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите ID анкеты текстом.");
      return;
    }

    await ctx.scene.leave();
    if (ctx.message.text === "Отмена") {
      await showAdminCardsMenu(ctx);
      return;
    }

    const cardId = parseCardId(ctx.message.text);
    if (!cardId) {
      await ctx.reply("Некорректный ID анкеты. Используйте число, например `27`.", {
        parse_mode: "Markdown",
      });
      await showAdminCardsMenu(ctx);
      return;
    }

    const card = await getCardWithOwner(cardId);
    if (!card) {
      await ctx.reply(`Анкета #${cardId} не найдена.`);
      await showAdminCardsMenu(ctx);
      return;
    }

    await showAdminCardProfile(ctx, cardId);
  },
);
