import { Markup, Scenes } from "telegraf";
import { setTransferDetails } from "../../services/settings.service";
import { logAdminAction } from "../../services/logging.service";
import type { AppContext } from "../../types/context";
import { showAdminTransfer } from "../../handlers/teambot/views";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

export const adminTransferScene = new Scenes.WizardScene<AppContext>(
  "admin-transfer-edit",
  async (ctx) => {
    await ctx.reply("Отправьте новый текст реквизитов одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
      await ctx.scene.leave();
      if (ctx.message.text === "Отмена") {
        await showAdminTransfer(ctx);
        return;
      }

      await setTransferDetails(ctx.message.text.trim());
      if (ctx.state.user) {
        await logAdminAction(ctx.state.user.id, "update_transfer_details", ctx.message.text.trim());
      }
      await ctx.reply("Реквизиты обновлены.");
      await showAdminTransfer(ctx);
      return;
    }

    await ctx.reply("Отправьте текст реквизитов.");
  },
);
