"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminProjectStatsScene = void 0;
const telegraf_1 = require("telegraf");
const logging_service_1 = require("../../services/logging.service");
const settings_service_1 = require("../../services/settings.service");
const validators_1 = require("../../utils/validators");
const views_1 = require("../../handlers/teambot/views");
const cancelKeyboard = telegraf_1.Markup.keyboard([["Отмена"]]).resize();
exports.adminProjectStatsScene = new telegraf_1.Scenes.WizardScene("admin-project-stats-edit", async (ctx) => {
    ctx.session.projectStatsDraft = {};
    await ctx.reply("Введите количество профитов.", cancelKeyboard);
    return ctx.wizard.next();
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === "Отмена") {
            ctx.session.projectStatsDraft = undefined;
            await ctx.scene.leave();
            await (0, views_1.showAdminProjectStats)(ctx);
            return;
        }
        const value = (0, validators_1.parsePositiveNumber)(ctx.message.text) ?? 0;
        ctx.session.projectStatsDraft = { totalProfits: Math.floor(value) };
        await ctx.reply("Введите сумму профитов.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите число текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        if (ctx.message.text === "Отмена") {
            ctx.session.projectStatsDraft = undefined;
            await ctx.scene.leave();
            await (0, views_1.showAdminProjectStats)(ctx);
            return;
        }
        const value = (0, validators_1.parsePositiveNumber)(ctx.message.text) ?? 0;
        ctx.session.projectStatsDraft = {
            ...ctx.session.projectStatsDraft,
            totalProfitAmount: value,
        };
        await ctx.reply("Введите процент выплат.", cancelKeyboard);
        return ctx.wizard.next();
    }
    await ctx.reply("Введите сумму текстом.");
}, async (ctx) => {
    if (ctx.message && "text" in ctx.message) {
        const draft = ctx.session.projectStatsDraft;
        if (ctx.message.text === "Отмена" || !draft) {
            ctx.session.projectStatsDraft = undefined;
            await ctx.scene.leave();
            await (0, views_1.showAdminProjectStats)(ctx);
            return;
        }
        const value = (0, validators_1.parsePositiveNumber)(ctx.message.text);
        if (value === null) {
            await ctx.reply("Введите корректный процент выплат.");
            return;
        }
        await (0, settings_service_1.setProjectStats)({
            totalProfits: draft.totalProfits ?? 0,
            totalProfitAmount: draft.totalProfitAmount ?? 0,
            payoutPercent: value,
        });
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "update_project_stats", JSON.stringify(draft));
        }
        ctx.session.projectStatsDraft = undefined;
        await ctx.scene.leave();
        await ctx.reply("Статистика проекта обновлена.");
        await (0, views_1.showAdminProjectStats)(ctx);
        return;
    }
    await ctx.reply("Введите процент текстом.");
});
