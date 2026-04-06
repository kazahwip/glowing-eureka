import { Markup, Scenes } from "telegraf";
import { adminBroadcastAudienceKeyboard } from "../../keyboards/admin";
import { runBroadcast } from "../../services/broadcast.service";
import { logAdminAction } from "../../services/logging.service";
import { getUsersByRole } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { showAdminHome } from "../../handlers/teambot/views";

const cancelKeyboard = Markup.keyboard([["Отмена"]]).resize();

export const adminBroadcastScene = new Scenes.WizardScene<AppContext>(
  "admin-broadcast",
  async (ctx) => {
    ctx.session.broadcastDraft = {};
    await ctx.reply("Выберите аудиторию рассылки.", adminBroadcastAudienceKeyboard());
    return ctx.wizard.next();
  },
  async (ctx) => {
    await ctx.reply("Используйте кнопки под сообщением, чтобы выбрать аудиторию.");
  },
  async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === "Отмена") {
      ctx.session.broadcastDraft = undefined;
      await ctx.scene.leave();
      await showAdminHome(ctx);
      return;
    }

    if (ctx.message && "text" in ctx.message) {
      ctx.session.broadcastDraft = {
        ...ctx.session.broadcastDraft,
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
        ...ctx.session.broadcastDraft,
        text: caption,
        photoFileId: fileId,
      };
    } else {
      await ctx.reply("Отправьте текст или фото с подписью.");
      return;
    }

    const audience = ctx.session.broadcastDraft?.audience;
    if (!audience) {
      await ctx.reply("Сначала выберите аудиторию.");
      return;
    }

    const users = await getUsersByRole(audience);
    const result = await runBroadcast(ctx.telegram, {
      telegramIds: users.map((user) => user.telegram_id),
      text: ctx.session.broadcastDraft.text ?? "",
      photoFileId: ctx.session.broadcastDraft.photoFileId,
    });

    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "broadcast", `audience:${audience}; sent:${result.sent}; failed:${result.failed}`);
    }

    ctx.session.broadcastDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply(`Рассылка завершена. Отправлено: ${result.sent}, ошибок: ${result.failed}.`);
    await showAdminHome(ctx);
  },
);

adminBroadcastScene.action(/^admin:broadcast:audience:(all|workers|clients)$/, async (ctx) => {
  const audience = ctx.match[1] as "all" | "workers" | "clients";
  ctx.session.broadcastDraft = {
    ...ctx.session.broadcastDraft,
    audience,
  };
  await ctx.answerCbQuery("Аудитория выбрана");
  await ctx.reply("Теперь отправьте текст рассылки или фото с подписью.", cancelKeyboard);
  return ctx.wizard.selectStep(2);
});
