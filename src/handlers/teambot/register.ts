import type { Telegraf } from "telegraf";
import { adminRoleKeyboard } from "../../keyboards/admin";
import { BACK_BUTTON, TEAMBOT_MAIN_MENU, TEAM_WORK_MENU } from "../../config/constants";
import { getServicebotTelegram, getTeambotTelegram } from "../../services/bot-clients.service";
import { notifyWorkerAboutCardReviewDecision } from "../../services/card-review.service";
import { approveCard, deleteCard, rejectCard } from "../../services/cards.service";
import { deleteCurator, unassignCuratorFromUser } from "../../services/curators.service";
import { getKassaSummary, getTopWorkers } from "../../services/kassa.service";
import { logAdminAction } from "../../services/logging.service";
import { approvePaymentRequest, rejectPaymentRequest, type PaymentRequestWithUser } from "../../services/payment-requests.service";
import { getProjectStats, getWorkerChatId, recalculateProjectStats, setWorkerChatId } from "../../services/settings.service";
import { getUserById, registerTeambotUser, setUserBlocked, setUserRole } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import { formatDateTime } from "../../utils/date";
import { escapeHtml, formatMoney, formatUserLabel } from "../../utils/text";
import {
  showAdminActionLogs,
  showAdminCardDeleteConfirm,
  showAdminCardProfile,
  showAdminCardsMenu,
  showAdminCurator,
  showAdminCurators,
  showAdminErrorLogs,
  showAdminOwnerCards,
  showAdminHome,
  showAdminLogsMenu,
  showAdminProjectStats,
  showAdminStats,
  showAdminTransfer,
  showAdminUserProfile,
  showAdminUsersMenu,
  showCuratorsScreen,
  showProfileScreen,
  showProjectInfoScreen,
  showRecentUsers,
  showTeambotHome,
  showTeamWorkMenu,
  showTeamWorkSettings,
  showWorkerReferralScreen,
  showTransferScreen,
} from "./views";

async function answerCallback(ctx: AppContext) {
  if ("callbackQuery" in ctx.update) {
    await ctx.answerCbQuery().catch(() => undefined);
  }
}

function isAdmin(ctx: AppContext) {
  return Boolean(ctx.state.isAdmin && ctx.state.user);
}

function isTeamMember(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    return false;
  }

  return user.role === "worker" || user.role === "admin" || user.role === "curator" || user.has_worker_access === 1;
}

async function notifyClientAboutPaymentDecision(telegramId: number, text: string) {
  try {
    await getServicebotTelegram().sendMessage(telegramId, text, { parse_mode: "HTML" });
  } catch {
    // ignore delivery errors
  }
}

function buildTopWorkersSection(title: string, workers: Array<{ totalAmount: number; totalCount: number; telegram_id: number; username: string | null; first_name: string | null }>) {
  const lines = [`<b>${title}</b>`];

  if (!workers.length) {
    lines.push("Данных пока нет.");
    return lines.join("\n");
  }

  for (const [index, worker] of workers.entries()) {
    const label = escapeHtml(formatUserLabel(worker));
    lines.push(`${index + 1}. ${label} — ${formatMoney(worker.totalAmount)} • ${worker.totalCount} шт.`);
  }

  return lines.join("\n");
}

async function buildKassaText() {
  const [today, week, month, allTime, dayTop, weekTop, monthTop, allTop, projectStats] = await Promise.all([
    getKassaSummary("day"),
    getKassaSummary("week"),
    getKassaSummary("month"),
    getKassaSummary("all"),
    getTopWorkers("day"),
    getTopWorkers("week"),
    getTopWorkers("month"),
    getTopWorkers("all"),
    getProjectStats(),
  ]);

  return [
    "<b>💸 Касса проекта</b>",
    `🕒 Обновлено: ${formatDateTime(new Date())}`,
    "",
    "<b>Сводка</b>",
    `Сегодня: ${today.totalCount} проф. • ${formatMoney(today.totalAmount)}`,
    `Неделя: ${week.totalCount} проф. • ${formatMoney(week.totalAmount)}`,
    `Месяц: ${month.totalCount} проф. • ${formatMoney(month.totalAmount)}`,
    `Все время: ${allTime.totalCount} проф. • ${formatMoney(allTime.totalAmount)}`,
    "",
    `<b>Проект</b>`,
    `Подтверждено профитов: ${projectStats.totalProfits}`,
    `Сумма профитов: ${formatMoney(projectStats.totalProfitAmount)}`,
    "",
    buildTopWorkersSection("🏆 Топ воркеров за день", dayTop),
    "",
    buildTopWorkersSection("🏆 Топ воркеров за неделю", weekTop),
    "",
    buildTopWorkersSection("🏆 Топ воркеров за месяц", monthTop),
    "",
    buildTopWorkersSection("🏆 Топ воркеров за все время", allTop),
  ].join("\n");
}

async function notifyWorkerChatAboutProfit(request: PaymentRequestWithUser) {
  const workerChatId = await getWorkerChatId();
  if (!workerChatId) {
    return;
  }

  const worker = request.worker_user_id ? await getUserById(request.worker_user_id) : null;
  const clientLabel = `<code>${request.telegram_id}</code>${request.username ? ` (@${escapeHtml(request.username)})` : ""}`;
  const workerLabel = worker ? escapeHtml(formatUserLabel(worker)) : "не назначен";

  const lines = [
    "<b>💸 Новый профит</b>",
    `Сумма: ${formatMoney(request.amount)}`,
    `Клиент: ${clientLabel}`,
    `Воркер: ${workerLabel}`,
    `Заявка: #${request.id}`,
    `Время: ${formatDateTime(new Date())}`,
  ];

  try {
    await getTeambotTelegram().sendMessage(workerChatId, lines.join("\n"), { parse_mode: "HTML" });
  } catch {
    // ignore delivery errors
  }
}

export function registerTeambotHandlers(bot: Telegraf<AppContext>) {
  bot.start(async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await registerTeambotUser({
      telegramId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    });

    ctx.state.user = user ?? undefined;
    await showTeambotHome(ctx);
  });

  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx)) {
      await ctx.reply("Команда доступна только администраторам.");
      return;
    }

    await showAdminHome(ctx);
  });

  bot.command("kassa", async (ctx) => {
    if (!isTeamMember(ctx)) {
      await ctx.reply("Команда доступна только участникам команды.");
      return;
    }

    if (ctx.chat && ctx.chat.type !== "private") {
      await setWorkerChatId(ctx.chat.id);
    }

    await recalculateProjectStats();
    await ctx.reply(await buildKassaText(), {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🔄 Обновить", callback_data: "team:kassa:refresh" }]],
      },
    });
  });

  bot.hears(TEAMBOT_MAIN_MENU[0], showTeamWorkMenu);
  bot.hears(TEAMBOT_MAIN_MENU[1], showTransferScreen);
  bot.hears(TEAMBOT_MAIN_MENU[2], showProfileScreen);
  bot.hears(TEAMBOT_MAIN_MENU[3], showCuratorsScreen);
  bot.hears(TEAMBOT_MAIN_MENU[4], showProjectInfoScreen);
  bot.hears(TEAM_WORK_MENU[0], async (ctx) => ctx.scene.enter("team-create-card"));
  bot.hears(TEAM_WORK_MENU[1], showWorkerReferralScreen);
  bot.hears(TEAM_WORK_MENU[2], showTeamWorkSettings);
  bot.hears(BACK_BUTTON, showTeambotHome);

  bot.action("team:menu:work", async (ctx) => {
    await answerCallback(ctx);
    await showTeamWorkMenu(ctx);
  });

  bot.action("team:menu:transfer", async (ctx) => {
    await answerCallback(ctx);
    await showTransferScreen(ctx);
  });

  bot.action("team:menu:profile", async (ctx) => {
    await answerCallback(ctx);
    await showProfileScreen(ctx);
  });

  bot.action("team:menu:curators", async (ctx) => {
    await answerCallback(ctx);
    await showCuratorsScreen(ctx);
  });

  bot.action("team:menu:project", async (ctx) => {
    await answerCallback(ctx);
    await showProjectInfoScreen(ctx);
  });

  bot.action("team:kassa:refresh", async (ctx) => {
    await answerCallback(ctx);
    if (!isTeamMember(ctx)) {
      return;
    }

    await recalculateProjectStats();
    await ctx.reply(await buildKassaText(), {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[{ text: "🔄 Обновить", callback_data: "team:kassa:refresh" }]],
      },
    });
  });

  bot.action("admin:home", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminHome(ctx);
  });

  bot.action("admin:stats", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminStats(ctx);
  });

  bot.action("admin:users", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminUsersMenu(ctx);
  });

  bot.action("admin:cards", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminCardsMenu(ctx);
  });

  bot.action("admin:users:list", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showRecentUsers(ctx);
  });

  bot.action("admin:users:search", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await ctx.scene.enter("admin-user-search");
  });

  bot.action(/^admin:user:(\d+):view$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    await showAdminUserProfile(ctx, Number(ctx.match[1]));
  });

  bot.action(/^admin:cards:owner:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    await showAdminOwnerCards(ctx, Number(ctx.match[1]));
  });

  bot.action(/^admin:card:(\d+):view$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    await showAdminCardProfile(ctx, Number(ctx.match[1]));
  });

  bot.action(/^admin:card:(\d+):delete:confirm$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    await showAdminCardDeleteConfirm(ctx, Number(ctx.match[1]));
  });

  bot.action(/^admin:card:(\d+):delete:apply$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx) || !ctx.state.user) {
      return;
    }

    const cardId = Number(ctx.match[1]);
    const card = await deleteCard(cardId);
    if (!card) {
      await ctx.reply("Анкета не найдена или уже была удалена.");
      return;
    }

    await logAdminAction(ctx.state.user.id, "delete_card", `card:${cardId}; owner:${card.owner_user_id}; name:${card.name}`);
    await ctx.reply(`Анкета #${cardId} удалена. Карточка больше не будет видна в Honey Bunny.`);
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
    await showAdminOwnerCards(ctx, card.owner_user_id);
  });

  bot.action(/^admin:user:(\d+):role$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const userId = Number(ctx.match[1]);
    await ctx.reply("Выберите новую роль.", adminRoleKeyboard(userId));
  });

  bot.action(/^admin:user:(\d+):set-role:(client|worker|curator|admin)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const userId = Number(ctx.match[1]);
    const role = ctx.match[2] as "client" | "worker" | "curator" | "admin";
    await setUserRole(userId, role);
    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "set_user_role", `user:${userId}; role:${role}`);
    }
    await showAdminUserProfile(ctx, userId);
  });

  bot.action(/^admin:user:(\d+):block$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const userId = Number(ctx.match[1]);
    const user = await getUserById(userId);
    if (!user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }

    await setUserBlocked(userId, user.is_blocked === 0);
    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "toggle_block_user", `user:${userId}; blocked:${user.is_blocked === 0}`);
    }
    await showAdminUserProfile(ctx, userId);
  });

  bot.action(/^admin:user:(\d+):assign-curator$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const user = await getUserById(Number(ctx.match[1]));
    if (!user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }

    ctx.session.curatorDraft = { userTelegramId: user.telegram_id };
    await ctx.scene.enter("admin-curator-assign");
  });

  bot.action(/^admin:user:(\d+):remove-curator$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const user = await getUserById(Number(ctx.match[1]));
    if (!user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }

    await unassignCuratorFromUser(user.id);
    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "unassign_curator", `user:${user.id}`);
    }
    await showAdminUserProfile(ctx, user.id);
  });

  bot.action("admin:curators", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminCurators(ctx);
  });

  bot.action(/^admin:curator:view:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminCurator(ctx, Number(ctx.match[1]));
  });

  bot.action(/^admin:curator:delete:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const curatorId = Number(ctx.match[1]);
    await deleteCurator(curatorId);
    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "delete_curator", `curator:${curatorId}`);
    }
    await showAdminCurators(ctx);
  });

  bot.action("admin:curator:add", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await ctx.scene.enter("admin-curator-add");
  });

  bot.action("admin:curator:assign", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    ctx.session.curatorDraft = {};
    await ctx.scene.enter("admin-curator-assign");
  });

  bot.action("admin:curator:unassign", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await ctx.scene.enter("admin-curator-unassign");
  });

  bot.action("admin:transfer", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminTransfer(ctx);
  });

  bot.action("admin:transfer:edit", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await ctx.scene.enter("admin-transfer-edit");
  });

  bot.action("admin:project-stats", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminProjectStats(ctx);
  });

  bot.action("admin:project-stats:edit", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await ctx.scene.enter("admin-project-stats-edit");
  });

  bot.action("admin:project-stats:recalc", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const stats = await recalculateProjectStats();
    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "recalculate_project_stats", JSON.stringify(stats));
    }
    await showAdminProjectStats(ctx);
  });

  bot.action(/^admin:payment-request:(\d+):(approve|reject)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx) || !ctx.state.user) {
      return;
    }

    const requestId = Number(ctx.match[1]);
    const decision = ctx.match[2] as "approve" | "reject";
    const result =
      decision === "approve"
        ? await approvePaymentRequest(requestId, ctx.state.user.id)
        : await rejectPaymentRequest(requestId, ctx.state.user.id);

    if (result.status === "missing") {
      await ctx.reply("Заявка на оплату не найдена.");
      return;
    }

    if (result.status === "processed") {
      await ctx.reply(`Заявка #${requestId} уже была обработана ранее.`);
      return;
    }

    if (decision === "approve" && result.request) {
      await recalculateProjectStats();
      await logAdminAction(ctx.state.user.id, "approve_payment_request", `request:${requestId}; amount:${result.request.amount}`);
      await notifyClientAboutPaymentDecision(
        result.request.telegram_id,
        [
          "<b>✅ Пополнение подтверждено</b>",
          `На баланс зачислено ${result.request.amount.toFixed(2)} RUB.`,
          "Проверьте профиль в Honey Bunny.",
        ].join("\n"),
      );
      await notifyWorkerChatAboutProfit(result.request);
      await ctx.reply(`Заявка #${requestId} принята. Баланс клиента пополнен.`);
    }

    if (decision === "reject" && result.request) {
      await logAdminAction(ctx.state.user.id, "reject_payment_request", `request:${requestId}; amount:${result.request.amount}`);
      await notifyClientAboutPaymentDecision(
        result.request.telegram_id,
        [
          "<b>❌ Пополнение отклонено</b>",
          "Администратор не подтвердил перевод.",
          "Проверьте чек и отправьте подтверждение еще раз.",
        ].join("\n"),
      );
      await ctx.reply(`Заявка #${requestId} отклонена.`);
    }

    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
  });

  bot.action(/^admin:card-review:(\d+):(approve|reject)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx) || !ctx.state.user) {
      return;
    }

    const cardId = Number(ctx.match[1]);
    const decision = ctx.match[2] as "approve" | "reject";
    const result = decision === "approve" ? await approveCard(cardId, ctx.state.user.id) : await rejectCard(cardId, ctx.state.user.id);

    if (result.status === "missing") {
      await ctx.reply("Анкета не найдена.");
      return;
    }

    if (result.status === "processed") {
      await ctx.reply(`Анкета #${cardId} уже была обработана ранее.`);
      return;
    }

    if (result.card) {
      await notifyWorkerAboutCardReviewDecision(result.card, decision === "approve" ? "approved" : "rejected");
    }

    if (decision === "approve") {
      await logAdminAction(ctx.state.user.id, "approve_card_review", `card:${cardId}`);
      await ctx.reply(`Анкета #${cardId} одобрена и опубликована в Honey Bunny.`);
    } else {
      await logAdminAction(ctx.state.user.id, "reject_card_review", `card:${cardId}`);
      await ctx.reply(`Анкета #${cardId} отклонена.`);
    }

    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
  });

  bot.action("admin:broadcast", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await ctx.scene.enter("admin-broadcast");
  });

  bot.action("admin:logs", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminLogsMenu(ctx);
  });

  bot.action("admin:logs:actions", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminActionLogs(ctx);
  });

  bot.action("admin:logs:errors", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }
    await showAdminErrorLogs(ctx);
  });

  bot.action("admin:close", async (ctx) => {
    await answerCallback(ctx);
    await showTeambotHome(ctx);
  });

  bot.action("common:close", async (ctx) => {
    await answerCallback(ctx);
    await showTeambotHome(ctx);
  });
}
