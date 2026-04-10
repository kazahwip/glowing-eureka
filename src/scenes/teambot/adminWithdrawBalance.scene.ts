import { Markup, Scenes } from "telegraf";
import { showAdminUserProfile } from "../../handlers/teambot/views";
import { logAdminAction } from "../../services/logging.service";
import { getUserById, updateUserWithdrawableBalance } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { formatMoney } from "../../utils/text";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

function parseAmount(raw: string) {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export const adminWithdrawBalanceScene = new Scenes.WizardScene<AppContext>(
  "admin-withdraw-balance",
  async (ctx) => {
    const userId = ctx.session.adminWithdrawBalanceDraft?.userId;
    if (!userId) {
      await ctx.scene.leave();
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getUserById(userId);
    if (!user) {
      await ctx.scene.leave();
      await ctx.reply("Пользователь не найден.");
      return;
    }

    await ctx.reply(
      `Введите новый баланс AWAKE BOT для вывода.\nСейчас доступно: ${formatMoney(user.withdrawable_balance)}.`,
      cancelKeyboard,
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply("Введите сумму текстом.");
      return;
    }

    const userId = ctx.session.adminWithdrawBalanceDraft?.userId;
    delete ctx.session.adminWithdrawBalanceDraft;
    await ctx.scene.leave();

    if (!userId) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    if (ctx.message.text === "Отмена") {
      await showAdminUserProfile(ctx, userId);
      return;
    }

    const amount = parseAmount(ctx.message.text);
    if (amount === null) {
      await ctx.reply("Некорректная сумма. Используйте формат `1500` или `1500.50`.", {
        parse_mode: "Markdown",
      });
      await showAdminUserProfile(ctx, userId);
      return;
    }

    const updatedUser = await updateUserWithdrawableBalance(userId, amount);
    if (!updatedUser) {
      await ctx.reply("Пользователь не найден.");
      return;
    }

    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "set_withdrawable_balance", `user:${userId}; amount:${amount}`);
    }

    await ctx.reply(`Баланс AWAKE BOT обновлён: ${formatMoney(amount)}.`);
    await showAdminUserProfile(ctx, userId);
  },
);
