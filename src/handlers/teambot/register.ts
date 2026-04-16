import type { Telegraf } from "telegraf";
import { adminHomeKeyboard, adminRoleKeyboard } from "../../keyboards/admin";
import { curatorRequestDecisionKeyboard, TEAM_WORK_BUTTONS, teambotBackKeyboard } from "../../keyboards/teambot";
import { BACK_BUTTON, TEAMBOT_MAIN_MENU } from "../../config/constants";
import { getServicebotTelegram, getTeambotTelegram } from "../../services/bot-clients.service";
import { notifyWorkerAboutCardReviewDecision } from "../../services/card-review.service";
import { getWorkerFriendCodeStats, listFriendCodeStats } from "../../services/client-events.service";
import { approveCard, deleteCard, rejectCard } from "../../services/cards.service";
import { getWorkerClientsStats } from "../../services/clients.service";
import {
  acceptCuratorRequest,
  createCuratorRequest,
  deleteCurator,
  rejectCuratorRequest,
  syncCuratorsForUser,
  unassignCuratorFromUser,
} from "../../services/curators.service";
import { getKassaSummary, getTopWorkers } from "../../services/kassa.service";
import { logAdminAction } from "../../services/logging.service";
import { approvePaymentRequest, rejectPaymentRequest, type PaymentRequestWithUser } from "../../services/payment-requests.service";
import { approveProfitReport, rejectProfitReport } from "../../services/profit-reports.service";
import { notifyWorkerChatAboutProfit as sendProjectProfitToWorkerChat } from "../../services/project-profits.service";
import { buildServicebotReferralLink } from "../../services/referrals.service";
import { getProjectStats, getServicebotUsername, getWorkerChatId, recalculateProjectStats, setWorkerChatId } from "../../services/settings.service";
import { ensureUserFriendCode, getUserById, isWorkerSignalEnabled, registerTeambotUser, setUserBlocked, setUserRole, updateWorkerSignalSetting } from "../../services/users.service";
import {
  markWithdrawRequestPaid,
  rejectWithdrawRequest,
  type WithdrawRequestWithUser,
} from "../../services/withdraw-requests.service";
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
  showAdminHome,
  showAdminLogsMenu,
  showAdminOwnerCards,
  showAdminProjectStats,
  showAdminStats,
  showAdminTransfer,
  showAdminUserProfile,
  showAdminUsersMenu,
  showCuratorsChatList,
  showCuratorsScreen,
  showProfileScreen,
  showProjectInfoScreen,
  showRecentUsers,
  showTeambotHome,
  showTeamWorkMenu,
  showTeamWorkSettings,
  showTransferScreen,
  showWithdrawRequestsScreen,
  showWorkerReferralScreen as showWorkerReferralScreenBase,
} from "./views";

async function answerCallback(ctx: AppContext) {
  if ("callbackQuery" in ctx.update) {
    await ctx.answerCbQuery().catch(() => undefined);
  }
}

async function showWorkerReferralScreen(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    await showWorkerReferralScreenBase(ctx);
    return;
  }

  const servicebotUsername = await getServicebotUsername();
  const referralLink = buildServicebotReferralLink(user.id, servicebotUsername);
  const [friendCode, stats, friendStats] = await Promise.all([
    ensureUserFriendCode(user.id),
    getWorkerClientsStats(user.id),
    getWorkerFriendCodeStats(user.id),
  ]);

  await ctx.reply(
    [
      "<b>🔗 Моя рефка</b>",
      "",
      "Персональная ссылка для Honey Bunny:",
      referralLink ? `<code>${escapeHtml(referralLink)}</code>` : "Ссылка появится после запуска servicebot с публичным username.",
      "",
      "<b>Friend code</b>",
      friendCode ? `<code>${escapeHtml(friendCode)}</code>` : "Код ещё не готов.",
      "",
      `🐘 Закреплено клиентов: ${stats.total}`,
      `📱 Запусков Mini App: ${friendStats.appOpens}`,
      `🔎 Открытий карточек: ${friendStats.cardOpens}`,
      `💳 Стартов пополнения: ${friendStats.topupStarts}`,
      `🧾 Отправлено чеков: ${friendStats.receiptsSent}`,
      `📅 Бронирований: ${friendStats.bookings}`,
      "",
      "Переходы, карточки, пополнения и бронирования будут приходить в личные сообщения AWAKE BOT по включённым сигналам.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...teambotBackKeyboard(),
    },
  );
}

async function showAdminFriendCodeStats(ctx: AppContext) {
  const rows = await listFriendCodeStats();
  const lines = ["<b>🧪 Friend code статистика</b>", ""];

  if (!rows.length) {
    lines.push("Пока нет воркеров с активными friend code.");
  } else {
    for (const row of rows) {
      const title = row.username ? `@${escapeHtml(row.username)}` : escapeHtml(row.first_name ?? `ID ${row.telegram_id}`);
      lines.push(
        `<b>${title}</b>`,
        `Код: <code>${escapeHtml(row.friend_code ?? "—")}</code>`,
        `Клиентов: ${row.linkedClients} • Mini App: ${row.appOpens}`,
        `Карточки: ${row.cardOpens} • Пополнения: ${row.topupStarts}`,
        `Чеки: ${row.receiptsSent} • Бронирования: ${row.bookings}`,
        "",
      );
    }
  }

  await ctx.reply(lines.join("\n").trim(), {
    parse_mode: "HTML",
    ...adminHomeKeyboard(),
  });
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

async function registerCurrentTeambotUser(ctx: AppContext) {
  if (!ctx.from) {
    return null;
  }

  const user = await registerTeambotUser({
    telegramId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
  });

  ctx.state.user = user ?? undefined;
  if (user) {
    await syncCuratorsForUser(user.id, ctx.from.username);
    if (user.role === "worker" || user.role === "admin" || user.role === "curator") {
      await ensureUserFriendCode(user.id);
    }
  }

  return user;
}

async function notifyClientAboutPaymentDecision(telegramId: number, text: string) {
  try {
    await getServicebotTelegram().sendMessage(telegramId, text, { parse_mode: "HTML" });
  } catch {
    // ignore delivery errors
  }
}

async function notifyWorkerAboutWithdrawDecision(request: WithdrawRequestWithUser, decision: "paid" | "rejected") {
  try {
    await getTeambotTelegram().sendMessage(
      request.telegram_id,
      [
        decision === "paid" ? "<b>💸 Заявка на вывод выплачена</b>" : "<b>❌ Заявка на вывод отклонена</b>",
        `Заявка: #${request.id}`,
        `Сумма: ${formatMoney(request.amount)}`,
        decision === "paid"
          ? "Админ отметил заявку как выплаченную."
          : "Сумма возвращена в доступный баланс AWAKE BOT. Проверьте реквизиты и создайте заявку заново.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  } catch {
    // ignore delivery errors
  }
}

async function notifyWorkerAboutProfitReportDecision(
  telegramId: number,
  decision: "approved" | "rejected",
  amount: number,
  source?: "direct_transfer" | "honeybunny",
) {
  try {
    await getTeambotTelegram().sendMessage(
      telegramId,
      [
        decision === "approved" ? "<b>✅ Профит подтверждён</b>" : "<b>❌ Профит отклонён</b>",
        `Сумма: ${formatMoney(amount)}`,
        decision === "approved"
          ? `Профит добавлен в баланс AWAKE BOT.\nИсточник: ${source === "honeybunny" ? "HonneyBunny" : "Прямой перевод"}`
          : "Заявка не была зачтена в кассу проекта.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  } catch {
    // ignore delivery errors
  }
}

async function notifyCuratorAboutRequest(
  request: NonNullable<Awaited<ReturnType<typeof createCuratorRequest>>["request"]>,
) {
  if (!request.curator_linked_telegram_id) {
    return false;
  }

  try {
    await getTeambotTelegram().sendMessage(
      request.curator_linked_telegram_id,
      [
        "<b>🧑‍💼 Новая заявка на кураторство</b>",
        "",
        `Воркер: ${escapeHtml(
          formatUserLabel({
            telegram_id: request.worker_telegram_id,
            username: request.worker_username,
            first_name: request.worker_first_name,
          }),
        )}`,
        `Telegram ID: <code>${request.worker_telegram_id}</code>`,
        `Куратор: <b>${escapeHtml(request.curator_name)}</b>${
          request.curator_telegram_username ? ` (@${escapeHtml(request.curator_telegram_username)})` : ""
        }`,
        "",
        "Примите или отклоните заявку кнопками ниже.",
      ].join("\n"),
      {
        parse_mode: "HTML",
        ...curatorRequestDecisionKeyboard(request.id),
      },
    );

    return true;
  } catch {
    return false;
  }
}

async function notifyWorkerAboutCuratorDecision(
  request: NonNullable<Awaited<ReturnType<typeof acceptCuratorRequest>>["request"]>,
  decision: "accepted" | "rejected",
) {
  try {
    await getTeambotTelegram().sendMessage(
      request.worker_telegram_id,
      [
        decision === "accepted" ? "<b>✅ Заявка на куратора принята</b>" : "<b>❌ Заявка на куратора отклонена</b>",
        "",
        `Куратор: <b>${escapeHtml(request.curator_name)}</b>${
          request.curator_telegram_username ? ` (@${escapeHtml(request.curator_telegram_username)})` : ""
        }`,
        decision === "accepted"
          ? "Куратор теперь закреплён за вами и будет отображаться в профиле."
          : "Можно выбрать другого куратора из актуального списка.",
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  } catch {
    // ignore delivery errors
  }
}

function buildTopWorkersSection(
  title: string,
  workers: Array<{ totalAmount: number; totalCount: number; telegram_id: number; username: string | null; first_name: string | null }>,
) {
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
    "<b>Проект</b>",
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

async function notifyWorkerChatAboutProfitFormatted(request: PaymentRequestWithUser) {
  const workerChatId = await getWorkerChatId();
  if (!workerChatId) {
    return;
  }

  const worker = request.worker_user_id ? await getUserById(request.worker_user_id) : null;
  const curator = request.curator_user_id ? await getUserById(request.curator_user_id) : null;
  const workerLabel = worker ? escapeHtml(formatUserLabel(worker)) : "не назначен";

  const lines = [
    "<b>🔥 Payments</b>",
    `🐺 Профит у ${workerLabel}`,
    "├ Сервис: 🤖 Honey Bunny",
    `├ Сумма оплаты: ${formatMoney(request.amount)}`,
    `├ Доля воркера: ${formatMoney(request.worker_share_amount)}`,
    curator ? `└ Доля куратора (${escapeHtml(formatUserLabel(curator))}): ${formatMoney(request.curator_share_amount)}` : "└ Доля куратора: 0 RUB",
  ];

  try {
    await getTeambotTelegram().sendMessage(workerChatId, lines.join("\n"), { parse_mode: "HTML" });
  } catch {
    // ignore delivery errors
  }
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

    await registerCurrentTeambotUser(ctx);
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

  bot.command("curators", async (ctx) => {
    if (!isTeamMember(ctx)) {
      await ctx.reply("Команда доступна только участникам команды.");
      return;
    }

    await showCuratorsChatList(ctx);
  });

  bot.hears(/мануал/i, async (ctx) => {
    if (!ctx.chat || ctx.chat.type === "private") {
      return;
    }

    await ctx.reply("📚 Канал с мануалами: https://t.me/+oIbWAAT7mIM3YzEx");
  });

  bot.hears(TEAMBOT_MAIN_MENU[0], showTeamWorkMenu);
  bot.hears(TEAMBOT_MAIN_MENU[1], showWithdrawRequestsScreen);
  bot.hears(TEAMBOT_MAIN_MENU[2], showTransferScreen);
  bot.hears(TEAMBOT_MAIN_MENU[3], showProfileScreen);
  bot.hears(TEAMBOT_MAIN_MENU[4], showCuratorsScreen);
  bot.hears(TEAMBOT_MAIN_MENU[5], showProjectInfoScreen);
  bot.hears(TEAM_WORK_BUTTONS.createCard, async (ctx) => ctx.scene.enter("team-create-card"));
  bot.hears(TEAM_WORK_BUTTONS.referral, showWorkerReferralScreen);
  bot.hears(TEAM_WORK_BUTTONS.withdraw, showWithdrawRequestsScreen);
  bot.hears(TEAM_WORK_BUTTONS.settings, showTeamWorkSettings);
  bot.hears(TEAM_WORK_BUTTONS.back, showTeambotHome);
  bot.hears(BACK_BUTTON, showTeambotHome);

  bot.action("team:membership:retry", async (ctx) => {
    await answerCallback(ctx);
    if (ctx.from) {
      await registerCurrentTeambotUser(ctx);
    }

    await showTeambotHome(ctx);
  });

  bot.action("team:menu:work", async (ctx) => {
    await answerCallback(ctx);
    await showTeamWorkMenu(ctx);
  });

  bot.action("team:menu:withdraw", async (ctx) => {
    await answerCallback(ctx);
    await showWithdrawRequestsScreen(ctx);
  });

  bot.action("team:withdraw:create", async (ctx) => {
    await answerCallback(ctx);
    await ctx.scene.enter("team-withdraw-request");
  });

  bot.action("team:withdraw:payout-details", async (ctx) => {
    await answerCallback(ctx);
    await ctx.scene.enter("team-payout-details");
  });

  bot.action("team:profit-report:create", async (ctx) => {
    await answerCallback(ctx);
    await ctx.scene.enter("team-profit-report");
  });

  bot.action("team:withdraw:refresh", async (ctx) => {
    await answerCallback(ctx);
    await showWithdrawRequestsScreen(ctx);
  });

  bot.action("team:withdraw:back", async (ctx) => {
    await answerCallback(ctx);
    await showTeambotHome(ctx);
  });

  bot.action(/^team:signals:toggle:(referrals|navigation|search|payments|bookings)$/, async (ctx) => {
    if (!ctx.state.user) {
      await ctx.answerCbQuery("Сначала выполните /start", { show_alert: true }).catch(() => undefined);
      return;
    }

    const category = ctx.match[1] as "referrals" | "navigation" | "search" | "payments" | "bookings";
    const nextEnabled = !isWorkerSignalEnabled(ctx.state.user, category);
    const updatedUser = await updateWorkerSignalSetting(ctx.state.user.id, category, nextEnabled);

    if (updatedUser) {
      ctx.state.user = updatedUser;
    }

    await ctx.answerCbQuery(nextEnabled ? "Сигнал включён" : "Сигнал отключён").catch(() => undefined);
    await showTeamWorkSettings(ctx);
  });

  bot.action("team:settings:back", async (ctx) => {
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

  bot.action("team:curators:back", async (ctx) => {
    await answerCallback(ctx);
    await showTeambotHome(ctx);
  });

  bot.action("team:curator:noop", async (ctx) => {
    await ctx.answerCbQuery("У этого куратора пока нет публичного username.");
  });

  bot.action("team:curator:assigned", async (ctx) => {
    await ctx.answerCbQuery("Этот куратор уже закреплён за вами.");
  });

  bot.action(/^team:curator:request:(\d+)$/, async (ctx) => {
    if (!ctx.state.user) {
      await ctx.answerCbQuery("Сначала выполните /start", { show_alert: true }).catch(() => undefined);
      return;
    }

    const curatorId = Number(ctx.match[1]);
    const result = await createCuratorRequest(ctx.state.user.id, curatorId);

    if (result.status === "missing") {
      await ctx.answerCbQuery("Куратор не найден.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (result.status === "unavailable") {
      await ctx.answerCbQuery("Этот куратор пока не может принимать заявки.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (result.status === "self") {
      await ctx.answerCbQuery("Нельзя отправить заявку самому себе.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (result.status === "worker_missing") {
      await ctx.answerCbQuery("Сначала выполните /start", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (result.status === "already_assigned") {
      await ctx.answerCbQuery("Этот куратор уже закреплён за вами.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (result.status === "pending_exists") {
      await ctx.answerCbQuery("Заявка уже отправлена и ждёт ответа.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (!result.request) {
      await ctx.answerCbQuery("Не удалось создать заявку.", { show_alert: true }).catch(() => undefined);
      return;
    }

    const delivered = await notifyCuratorAboutRequest(result.request);
    await ctx.answerCbQuery("Заявка отправлена куратору.").catch(() => undefined);
    await ctx.reply(
      delivered
        ? "📨 Заявка отправлена куратору. Ответ придёт в AWAKE BOT."
        : "📨 Заявка создана, но уведомление куратору пока не доставлено. Он увидит её после следующего входа в AWAKE BOT.",
    );
  });

  bot.action(/^team:curator-request:(\d+):(accept|reject)$/, async (ctx) => {
    if (!ctx.state.user) {
      await ctx.answerCbQuery("Сначала выполните /start", { show_alert: true }).catch(() => undefined);
      return;
    }

    const requestId = Number(ctx.match[1]);
    const decision = ctx.match[2] as "accept" | "reject";
    const result =
      decision === "accept"
        ? await acceptCuratorRequest(requestId, ctx.state.user.id)
        : await rejectCuratorRequest(requestId, ctx.state.user.id);

    if (result.status === "missing") {
      await ctx.answerCbQuery("Заявка не найдена.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (result.status === "forbidden") {
      await ctx.answerCbQuery("Эта заявка адресована другому куратору.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (result.status === "processed") {
      await ctx.answerCbQuery("Заявка уже обработана.", { show_alert: true }).catch(() => undefined);
      return;
    }

    if (!result.request) {
      await ctx.answerCbQuery("Не удалось обработать заявку.", { show_alert: true }).catch(() => undefined);
      return;
    }

    await ctx.answerCbQuery(decision === "accept" ? "Заявка принята." : "Заявка отклонена.").catch(() => undefined);
    await notifyWorkerAboutCuratorDecision(result.request, decision === "accept" ? "accepted" : "rejected");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
    await ctx.reply(
      decision === "accept"
        ? "✅ Заявка принята. Воркер закреплён за вами как за куратором."
        : "❌ Заявка на кураторство отклонена.",
    );
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

  bot.action("admin:friend-codes", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    await showAdminFriendCodeStats(ctx);
  });

  bot.action("admin:cards:search", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    await ctx.scene.enter("admin-card-search");
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

  bot.action(/^admin:user:(\d+):withdraw-balance$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    ctx.session.adminWithdrawBalanceDraft = { userId: Number(ctx.match[1]) };
    await ctx.scene.enter("admin-withdraw-balance");
  });

  bot.action(/^admin:user:(\d+):profit-metrics$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    ctx.session.adminProfitMetricsDraft = { userId: Number(ctx.match[1]) };
    await ctx.scene.enter("admin-profit-metrics");
  });

  bot.action(/^admin:user:(\d+):set-role:(client|worker|curator|admin)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const userId = Number(ctx.match[1]);
    const role = ctx.match[2] as "client" | "worker" | "curator" | "admin";
    const updatedUser = await setUserRole(userId, role);
    if (updatedUser) {
      await syncCuratorsForUser(updatedUser.id, updatedUser.username);
    }

    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "set_user_role", `user:${userId}; role:${role}`);
    }

    await showAdminUserProfile(ctx, userId);
  });

  bot.action(/^admin:user:(\d+):(make-curator|make-worker)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    const userId = Number(ctx.match[1]);
    const role = ctx.match[2] === "make-curator" ? "curator" : "worker";
    const updatedUser = await setUserRole(userId, role);
    if (updatedUser) {
      await syncCuratorsForUser(updatedUser.id, updatedUser.username);
    }

    if (ctx.state.user) {
      await logAdminAction(ctx.state.user.id, "quick_set_user_role", `user:${userId}; role:${role}`);
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

  bot.action("admin:add-profit", async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx)) {
      return;
    }

    await ctx.scene.enter("admin-add-profit");
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
      await sendProjectProfitToWorkerChat(result.request);
      await ctx.reply(`Заявка #${requestId} принята. Баланс клиента пополнен.`);
    }

    if (decision === "reject" && result.request) {
      await logAdminAction(ctx.state.user.id, "reject_payment_request", `request:${requestId}; amount:${result.request.amount}`);
      await notifyClientAboutPaymentDecision(
        result.request.telegram_id,
        [
          "<b>❌ Пополнение отклонено</b>",
          "Администратор не подтвердил перевод.",
          "Проверьте чек и отправьте подтверждение ещё раз.",
        ].join("\n"),
      );
      await ctx.reply(`Заявка #${requestId} отклонена.`);
    }

    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
  });

  bot.action(/^admin:withdraw-request:(\d+):(approve|paid|reject)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx) || !ctx.state.user) {
      return;
    }

    const requestId = Number(ctx.match[1]);
    const decision = ctx.match[2] as "approve" | "paid" | "reject";
    const result =
      decision === "approve" || decision === "paid"
          ? await markWithdrawRequestPaid(requestId, ctx.state.user.id)
        : await rejectWithdrawRequest(requestId, ctx.state.user.id);

    if (result.status === "missing") {
      await ctx.reply("Заявка на вывод не найдена.");
      return;
    }

    if (result.status === "processed") {
      await ctx.reply(`Заявка на вывод #${requestId} уже была обработана ранее.`);
      return;
    }

    if (!result.request) {
      await ctx.reply("Не удалось обработать заявку на вывод.");
      return;
    }

    if (decision === "reject") {
      await notifyWorkerAboutWithdrawDecision(result.request, "rejected");
    } else {
      await notifyWorkerAboutWithdrawDecision(result.request, "paid");
    }
    await logAdminAction(
      ctx.state.user.id,
      decision === "paid" || decision === "approve"
          ? "mark_withdraw_request_paid"
          : "reject_withdraw_request",
      `request:${requestId}; amount:${result.request.amount}`,
    );

    await ctx.reply(
      decision === "paid" || decision === "approve"
          ? `Заявка на вывод #${requestId} отмечена как выплаченная.`
          : `Заявка на вывод #${requestId} отклонена, сумма возвращена воркеру.`,
    );
    if (decision === "paid" || decision === "approve" || decision === "reject") {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
    }
  });

  bot.action(/^admin:profit-report:(\d+):(approve:(direct_transfer|honeybunny)|reject)$/, async (ctx) => {
    await answerCallback(ctx);
    if (!isAdmin(ctx) || !ctx.state.user) {
      return;
    }

    const requestId = Number(ctx.match[1]);
    const action = ctx.match[2];
    const source = ctx.match[3] as "direct_transfer" | "honeybunny" | undefined;

    const result =
      action === "reject"
        ? await rejectProfitReport(requestId, ctx.state.user.id)
        : await approveProfitReport(requestId, ctx.state.user.id, source ?? "direct_transfer");

    if (result.status === "missing") {
      await ctx.reply("Заявка о профите не найдена.");
      return;
    }

    if (result.status === "processed") {
      await ctx.reply(`Заявка о профите #${requestId} уже была обработана ранее.`);
      return;
    }

    if (result.status === "failed") {
      await ctx.reply("Не удалось зачесть профит. Попробуйте ещё раз.");
      return;
    }

    if (!result.request) {
      await ctx.reply("Не удалось обработать заявку о профите.");
      return;
    }

    if (action === "reject") {
      await notifyWorkerAboutProfitReportDecision(result.request.telegram_id, "rejected", result.request.amount);
      await logAdminAction(
        ctx.state.user.id,
        "reject_profit_report",
        `request:${requestId}; amount:${result.request.amount}`,
      );
      await ctx.reply(`Заявка о профите #${requestId} отклонена.`);
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
      return;
    }

    if ("paymentRequest" in result && result.paymentRequest) {
      await recalculateProjectStats();
      await sendProjectProfitToWorkerChat(result.paymentRequest);
    }

    await notifyWorkerAboutProfitReportDecision(result.request.telegram_id, "approved", result.request.amount, source);
    await logAdminAction(
      ctx.state.user.id,
      "approve_profit_report",
      `request:${requestId}; amount:${result.request.amount}; source:${source}`,
    );
    await ctx.reply(
      `Заявка о профите #${requestId} подтверждена, добавлена в баланс AWAKE BOT и зачтена как ${source === "honeybunny" ? "HonneyBunny" : "прямой перевод"}.`,
    );
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
