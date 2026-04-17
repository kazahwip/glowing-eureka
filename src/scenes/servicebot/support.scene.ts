import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { config } from "../../config/env";
import { createSupportTicket } from "../../services/support.service";
import { sendServicebotAuditEvent } from "../../services/servicebot-audit.service";
import type { AppContext } from "../../types/context";
import { showSupportScreen } from "../../handlers/servicebot/views";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

async function notifySupport(ctx: AppContext, text: string) {
  for (const telegramId of config.supportNotifyIds.length ? config.supportNotifyIds : config.adminTelegramIds) {
    try {
      await ctx.telegram.sendMessage(telegramId, text, { parse_mode: "HTML" });
    } catch {
      continue;
    }
  }
}

export const supportScene = new Scenes.WizardScene<AppContext>(
  "service-support",
  async (ctx) => {
    await ctx.reply("Опишите обращение одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      if (ctx.message.text === CANCEL_BUTTON) {
        await ctx.scene.leave();
        await showSupportScreen(ctx);
        return;
      }

      const user = ctx.state.user;
      if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
      }

      const ticket = await createSupportTicket(user.id, ctx.message.text.trim());
      await sendServicebotAuditEvent({
        telegramId: user.telegram_id,
        username: user.username,
        action: "created_support_ticket",
        details: `ticket_id=${ticket?.id ?? "n/a"}`,
      });
      await notifySupport(
        ctx,
        [
          "<b>Новое обращение в поддержку</b>",
          `Пользователь: <code>${user.telegram_id}</code>`,
          `Тикет: #${ticket?.id ?? "n/a"}`,
          `Сообщение: ${ctx.message.text.trim()}`,
        ].join("\n"),
      );

      await ctx.scene.leave();
      await ctx.reply("Обращение сохранено. Оператор получит уведомление.");
      await showSupportScreen(ctx);
      return;
    }

    await ctx.reply("Отправьте текст обращения одним сообщением.");
  },
);
