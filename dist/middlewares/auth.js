"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireWorkerChatMembership = exports.rejectBlockedUsers = exports.attachCurrentUser = void 0;
exports.attachBotKind = attachBotKind;
exports.requireAdmin = requireAdmin;
exports.requireWorkerAccess = requireWorkerAccess;
const telegraf_1 = require("telegraf");
const constants_1 = require("../config/constants");
const env_1 = require("../config/env");
const settings_service_1 = require("../services/settings.service");
const users_service_1 = require("../services/users.service");
const TEAM_MEMBER_STATUSES = new Set(["creator", "administrator", "member"]);
function buildWorkerChatRequiredKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.url("💬 Вступить в чат", constants_1.TEAM_CHAT_URL)],
        [telegraf_1.Markup.button.callback("🔄 Проверить", "team:membership:retry")],
    ]);
}
async function isWorkerChatMember(ctx) {
    const workerChatId = await (0, settings_service_1.getWorkerChatId)();
    if (!workerChatId || !ctx.from) {
        return true;
    }
    try {
        const member = await ctx.telegram.getChatMember(workerChatId, ctx.from.id);
        if (TEAM_MEMBER_STATUSES.has(member.status)) {
            return true;
        }
        if (member.status === "restricted") {
            return Boolean("is_member" in member && member.is_member);
        }
        return false;
    }
    catch {
        return true;
    }
}
async function replyWorkerChatRequired(ctx) {
    if ("callbackQuery" in ctx.update) {
        await ctx.answerCbQuery("Сначала вступите в чат воркеров.", { show_alert: true }).catch(() => undefined);
    }
    await ctx.reply([
        "<b>🔒 TeamBot доступен только участникам чата воркеров</b>",
        "",
        "Вступите в рабочий чат команды по кнопке ниже, затем нажмите «Проверить» или выполните /start ещё раз.",
    ].join("\n"), {
        parse_mode: "HTML",
        ...buildWorkerChatRequiredKeyboard(),
    });
}
function attachBotKind(botKind) {
    return async (ctx, next) => {
        ctx.state.botKind = botKind;
        await next();
    };
}
const attachCurrentUser = async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (telegramId) {
        const user = await (0, users_service_1.getUserByTelegramId)(telegramId);
        ctx.state.user = user ?? undefined;
        ctx.state.isAdmin = env_1.config.adminTelegramIds.includes(telegramId);
    }
    await next();
};
exports.attachCurrentUser = attachCurrentUser;
const rejectBlockedUsers = async (ctx, next) => {
    if (ctx.state.user?.is_blocked) {
        await ctx.reply("Ваш доступ ограничен. Обратитесь к администратору.");
        return;
    }
    await next();
};
exports.rejectBlockedUsers = rejectBlockedUsers;
const requireWorkerChatMembership = async (ctx, next) => {
    if (ctx.state.botKind !== "teambot" || !ctx.chat || ctx.chat.type !== "private" || !ctx.from || ctx.state.isAdmin) {
        await next();
        return;
    }
    const isMember = await isWorkerChatMember(ctx);
    if (!isMember) {
        await replyWorkerChatRequired(ctx);
        return;
    }
    await next();
};
exports.requireWorkerChatMembership = requireWorkerChatMembership;
function requireAdmin() {
    return async (ctx, next) => {
        if (!ctx.from || !env_1.config.adminTelegramIds.includes(ctx.from.id)) {
            await ctx.reply("Раздел доступен только администраторам.");
            return;
        }
        await next();
    };
}
function requireWorkerAccess() {
    return async (ctx, next) => {
        const user = ctx.state.user;
        if (!user) {
            await ctx.reply("Сначала выполните /start.");
            return;
        }
        const allowed = user.has_worker_access === 1 || ["worker", "admin", "curator"].includes(user.role);
        if (!allowed) {
            await ctx.reply("Воркер-панель пока недоступна. Используйте /awake или зарегистрируйтесь в teambot.");
            return;
        }
        await next();
    };
}
