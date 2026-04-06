"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminTransferScene = void 0;
const telegraf_1 = require("telegraf");
const settings_service_1 = require("../../services/settings.service");
const logging_service_1 = require("../../services/logging.service");
const views_1 = require("../../handlers/teambot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
exports.adminTransferScene = new telegraf_1.Scenes.WizardScene("admin-transfer-edit", async (ctx) => {
    await ctx.reply("Отправьте новый текст реквизитов одним сообщением.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        await ctx.scene.leave();
        if (ctx.message.text === "Отмена") {
            await (0, views_1.showAdminTransfer)(ctx);
            return;
        }
        await (0, settings_service_1.setTransferDetails)(ctx.message.text.trim());
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "update_transfer_details", ctx.message.text.trim());
        }
        await ctx.reply("Реквизиты обновлены.");
        await (0, views_1.showAdminTransfer)(ctx);
        return;
    }
    await ctx.reply("Отправьте текст реквизитов.");
});
