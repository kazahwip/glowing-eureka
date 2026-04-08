import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { showWithdrawRequestsScreen } from "../../handlers/teambot/views";
import { updateUserPayoutDetails } from "../../services/users.service";
import type { AppContext } from "../../types/context";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

async function closeScene(ctx: AppContext, notice?: string) {
  await ctx.scene.leave();
  await ctx.reply(notice ?? "\u2063", Markup.removeKeyboard());
  await showWithdrawRequestsScreen(ctx);
}

export const payoutDetailsScene = new Scenes.WizardScene<AppContext>(
  "team-payout-details",
  async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      await ctx.reply("Сначала выполните /start.");
      await ctx.scene.leave();
      return;
    }

    const lines = [
      "<b>💳 Реквизиты для выплаты</b>",
      "",
      user.payout_details ? `Текущие реквизиты:\n${user.payout_details}` : "Реквизиты пока не заполнены.",
      "",
      "Отправьте одним сообщением реквизиты для будущих выплат. Можно указать карту, телефон, банк и комментарий без дополнительной проверки формата.",
    ];

    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      ...cancelKeyboard,
    });

    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Отправьте реквизиты текстом.");
      return;
    }

    if (ctx.message.text === CANCEL_BUTTON) {
      await closeScene(ctx, "Изменение реквизитов отменено.");
      return;
    }

    const user = ctx.state.user;
    const payoutDetails = ctx.message.text.trim();
    if (!user || !payoutDetails) {
      await closeScene(ctx, "Не удалось сохранить реквизиты. Попробуйте ещё раз.");
      return;
    }

    const updatedUser = await updateUserPayoutDetails(user.id, payoutDetails);
    if (updatedUser) {
      ctx.state.user = updatedUser;
    }

    await closeScene(ctx, "Реквизиты для выплаты сохранены.");
  },
);
