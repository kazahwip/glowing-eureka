import { Markup, type MiddlewareFn } from "telegraf";
import { TEAM_CHAT_URL } from "../config/constants";
import { config } from "../config/env";
import { getWorkerChatId } from "../services/settings.service";
import type { AppContext } from "../types/context";
import { getUserByTelegramId } from "../services/users.service";

const TEAM_MEMBER_STATUSES = new Set(["creator", "administrator", "member"]);

function buildWorkerChatRequiredKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url("💬 Вступить в чат", TEAM_CHAT_URL)],
    [Markup.button.callback("🔄 Проверить", "team:membership:retry")],
  ]);
}

async function isWorkerChatMember(ctx: AppContext) {
  const workerChatId = await getWorkerChatId();
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
  } catch {
    return true;
  }
}

async function replyWorkerChatRequired(ctx: AppContext) {
  if ("callbackQuery" in ctx.update) {
    await ctx.answerCbQuery("Сначала вступите в чат воркеров.", { show_alert: true }).catch(() => undefined);
  }

  await ctx.reply(
    [
      "<b>🔒 AWAKE BOT доступен только участникам чата воркеров</b>",
      "",
      "Вступите в рабочий чат команды по кнопке ниже, затем нажмите «Проверить» или выполните /start ещё раз.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...buildWorkerChatRequiredKeyboard(),
    },
  );
}

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

export const requireWorkerChatMembership: MiddlewareFn<AppContext> = async (ctx, next) => {
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
      await ctx.reply("Воркер-панель пока недоступна. Используйте /awake или зарегистрируйтесь в AWAKE BOT.");
      return;
    }

    await next();
  };
}
