import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { showAdminCurators } from "../../handlers/teambot/views";
import { createCurator, normalizeTelegramUsername } from "../../services/curators.service";
import { logAdminAction } from "../../services/logging.service";
import type { AppContext } from "../../types/context";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

function parseCuratorInput(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^(@[A-Za-z0-9_]{4,32})\s+(.+)$/);
  if (!match) {
    return null;
  }

  const telegramUsername = normalizeTelegramUsername(match[1]);
  const name = match[2].trim();
  if (!telegramUsername || !name) {
    return null;
  }

  return { telegramUsername, name };
}

async function leaveToCurators(ctx: AppContext) {
  ctx.session.curatorDraft = undefined;
  await ctx.scene.leave();
  await showAdminCurators(ctx);
}

export const adminCuratorAddScene = new Scenes.WizardScene<AppContext>(
  "admin-curator-add",
  async (ctx) => {
    ctx.session.curatorDraft = {};
    await ctx.reply("Введите куратора в формате: <code>@username Имя</code>", {
      parse_mode: "HTML",
      ...cancelKeyboard,
    });
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Отправьте данные куратора текстом.");
      return;
    }

    const text = ctx.message.text.trim();
    if (text === CANCEL_BUTTON) {
      await leaveToCurators(ctx);
      return;
    }

    const parsed = parseCuratorInput(text);
    if (!parsed) {
      await ctx.reply("Неверный формат. Используйте: <code>@username Имя</code>", {
        parse_mode: "HTML",
      });
      return;
    }

    const curator = await createCurator(parsed.telegramUsername, parsed.name);
    if (ctx.state.user) {
      await logAdminAction(
        ctx.state.user.id,
        "create_curator",
        `curator:${curator?.id ?? "n/a"}; username:@${parsed.telegramUsername}; name:${parsed.name}`,
      );
    }

    await ctx.reply(
      curator?.linked_user_id
        ? `Куратор ${parsed.name} (@${parsed.telegramUsername}) добавлен и привязан к пользователю teambot.`
        : `Куратор ${parsed.name} (@${parsed.telegramUsername}) добавлен. Привязка к teambot появится после первого входа этого пользователя.`,
    );

    await leaveToCurators(ctx);
  },
);
