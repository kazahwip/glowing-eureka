import { Markup, Scenes } from "telegraf";
import { CANCEL_BUTTON } from "../../config/constants";
import { workerPanelKeyboard } from "../../keyboards/servicebot";
import { runBroadcast } from "../../services/broadcast.service";
import { listWorkerClients } from "../../services/clients.service";
import type { AppContext } from "../../types/context";
import { showWorkerHome } from "../../handlers/servicebot/views";

const cancelKeyboard = Markup.keyboard([[CANCEL_BUTTON]]).resize();

export const workerBroadcastScene = new Scenes.WizardScene<AppContext>(
  "worker-broadcast",
  async (ctx) => {
    ctx.session.broadcastDraft = {};
    await ctx.reply(`Отправьте текст рассылки по мамонтам или фото с подписью. Для отмены нажмите «${CANCEL_BUTTON}».`, cancelKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === CANCEL_BUTTON) {
      ctx.session.broadcastDraft = undefined;
      await ctx.scene.leave();
      await showWorkerHome(ctx);
      return;
    }

    const user = ctx.state.user;
    if (!user) {
      await ctx.reply("Сначала выполните /start.");
      return;
    }

    if (ctx.message && "text" in ctx.message) {
      ctx.session.broadcastDraft = {
        text: ctx.message.text.trim(),
      };
    } else if (ctx.message && "photo" in ctx.message) {
      const fileId = ctx.message.photo.at(-1)?.file_id;
      const caption = ctx.message.caption?.trim();
      if (!fileId || !caption) {
        await ctx.reply("Если отправляете фото, добавьте подпись.");
        return;
      }

      ctx.session.broadcastDraft = {
        text: caption,
        photoFileId: fileId,
      };
    } else {
      await ctx.reply("Отправьте текст или фото с подписью.");
      return;
    }

    const clients = await listWorkerClients(user.id);
    const result = await runBroadcast(ctx.telegram, {
      telegramIds: clients.map((client) => client.telegram_id),
      text: ctx.session.broadcastDraft.text ?? "",
      photoFileId: ctx.session.broadcastDraft.photoFileId,
    });

    ctx.session.broadcastDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply(`Рассылка по мамонтам завершена. Отправлено: ${result.sent}, ошибок: ${result.failed}.`, workerPanelKeyboard());
    await showWorkerHome(ctx);
  },
);
