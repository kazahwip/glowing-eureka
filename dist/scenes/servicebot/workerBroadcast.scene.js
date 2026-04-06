"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workerBroadcastScene = void 0;
const telegraf_1 = require("telegraf");
const constants_1 = require("../../config/constants");
const servicebot_1 = require("../../keyboards/servicebot");
const broadcast_service_1 = require("../../services/broadcast.service");
const clients_service_1 = require("../../services/clients.service");
const views_1 = require("../../handlers/servicebot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([[constants_1.CANCEL_BUTTON]]).resize();
exports.workerBroadcastScene = new telegraf_1.Scenes.WizardScene("worker-broadcast", async (ctx) => {
    ctx.session.broadcastDraft = {};
    await ctx.reply(`Отправьте текст рассылки по мамонтам или фото с подписью. Для отмены нажмите «${constants_1.CANCEL_BUTTON}».`, cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message && ctx.message.text === constants_1.CANCEL_BUTTON) {
        ctx.session.broadcastDraft = undefined;
        await ctx.scene.leave();
        await (0, views_1.showWorkerHome)(ctx);
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
    }
    else if (ctx.message && "photo" in ctx.message) {
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
    }
    else {
        await ctx.reply("Отправьте текст или фото с подписью.");
        return;
    }
    const clients = await (0, clients_service_1.listWorkerClients)(user.id);
    const result = await (0, broadcast_service_1.runBroadcast)(ctx.telegram, {
        telegramIds: clients.map((client) => client.telegram_id),
        text: ctx.session.broadcastDraft.text ?? "",
        photoFileId: ctx.session.broadcastDraft.photoFileId,
    });
    ctx.session.broadcastDraft = undefined;
    await ctx.scene.leave();
    await ctx.reply(`Рассылка по мамонтам завершена. Отправлено: ${result.sent}, ошибок: ${result.failed}.`, (0, servicebot_1.workerPanelKeyboard)());
    await (0, views_1.showWorkerHome)(ctx);
});
