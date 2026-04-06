"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBroadcastScene = void 0;
const telegraf_1 = require("telegraf");
const admin_1 = require("../../keyboards/admin");
const broadcast_service_1 = require("../../services/broadcast.service");
const logging_service_1 = require("../../services/logging.service");
const users_service_1 = require("../../services/users.service");
const views_1 = require("../../handlers/teambot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
exports.adminBroadcastScene = new telegraf_1.Scenes.WizardScene("admin-broadcast", async (ctx) => {
    ctx.session.broadcastDraft = {};
    await ctx.reply("Выберите аудиторию рассылки.", (0, admin_1.adminBroadcastAudienceKeyboard)());
    return ctx.wizard.next();
}, async (ctx) => {
    await ctx.reply("Используйте кнопки под сообщением, чтобы выбрать аудиторию.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === "Отмена") {
        ctx.session.broadcastDraft = undefined;
        await ctx.scene.leave();
        await (0, views_1.showAdminHome)(ctx);
        return;
    }
    if (ctx.message && "text" in ctx.message) {
        ctx.session.broadcastDraft = {
            ...ctx.session.broadcastDraft,
            text: ctx.message.text.trim(),
        };
    }
    else if (ctx.message && "photo" in ctx.message) {
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
    }
    else {
        await ctx.reply("Отправьте текст или фото с подписью.");
        return;
    }
    const audience = ctx.session.broadcastDraft?.audience;
    if (!audience) {
        await ctx.reply("Сначала выберите аудиторию.");
        return;
    }
    const users = await (0, users_service_1.getUsersByRole)(audience);
    const result = await (0, broadcast_service_1.runBroadcast)(ctx.telegram, {
        telegramIds: users.map((user) => user.telegram_id),
        text: ctx.session.broadcastDraft.text ?? "",
        photoFileId: ctx.session.broadcastDraft.photoFileId,
    });
    if (ctx.state.user) {
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "broadcast", `audience:${audience}; sent:${result.sent}; failed:${result.failed}`);
    }
    ctx.session.broadcastDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply(`Рассылка завершена. Отправлено: ${result.sent}, ошибок: ${result.failed}.`);
    await (0, views_1.showAdminHome)(ctx);
});
exports.adminBroadcastScene.action(/^admin:broadcast:audience:(all|workers|clients)$/, async (ctx) => {
    const audience = ctx.match[1];
    ctx.session.broadcastDraft = {
        ...ctx.session.broadcastDraft,
        audience,
    };
    await ctx.answerCbQuery("Аудитория выбрана");
    await ctx.reply("Теперь отправьте текст рассылки или фото с подписью.", cancelKeyboard);
    return ctx.wizard.selectStep(2);
});
