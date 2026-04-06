import type { MiddlewareFn } from "telegraf";
import { config } from "../config/env";
import type { AppContext } from "../types/context";
import { getUserByTelegramId } from "../services/users.service";

export function attachBotKind(botKind: "teambot" | "servicebot"): MiddlewareFn<AppContext> {
  return async (ctx, next) => {
    ctx.state.botKind = botKind;
    await next();
  };
}

export const attachCurrentUser: MiddlewareFn<AppContext> = async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    const user = await getUserByTelegramId(telegramId);
    ctx.state.user = user ?? undefined;
    ctx.state.isAdmin = config.adminTelegramIds.includes(telegramId);
  }

  await next();
};

export const rejectBlockedUsers: MiddlewareFn<AppContext> = async (ctx, next) => {
  if (ctx.state.user?.is_blocked) {
    await ctx.reply("Ваш доступ ограничен. Обратитесь к администратору.");
    return;
  }

  await next();
};

export function requireAdmin(): MiddlewareFn<AppContext> {
  return async (ctx, next) => {
    if (!ctx.from || !config.adminTelegramIds.includes(ctx.from.id)) {
      await ctx.reply("Раздел доступен только администраторам.");
      return;
    }

    await next();
  };
}

export function requireWorkerAccess(): MiddlewareFn<AppContext> {
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
