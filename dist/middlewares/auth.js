"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectBlockedUsers = exports.attachCurrentUser = void 0;
exports.attachBotKind = attachBotKind;
exports.requireAdmin = requireAdmin;
exports.requireWorkerAccess = requireWorkerAccess;
const env_1 = require("../config/env");
const users_service_1 = require("../services/users.service");
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
