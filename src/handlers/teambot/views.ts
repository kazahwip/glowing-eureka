import { Markup } from "telegraf";
import {
  adminCuratorActionsKeyboard,
  adminCuratorsKeyboard,
  adminHomeKeyboard,
  adminLogsKeyboard,
  adminProjectStatsKeyboard,
  adminUserActionsKeyboard,
  adminUsersKeyboard,
} from "../../keyboards/admin";
import { teamWorkKeyboard, teambotBackKeyboard, teambotMainMenuInlineKeyboard } from "../../keyboards/teambot";
import { countCards } from "../../services/cards.service";
import { getWorkerClientsStats } from "../../services/clients.service";
import { getCuratorById, listCurators } from "../../services/curators.service";
import { getWorkerProfitMetrics } from "../../services/kassa.service";
import { getRecentAdminLogs, getRecentErrorLogs } from "../../services/logging.service";
import { buildServicebotReferralLink } from "../../services/referrals.service";
import { getProjectStats, getServicebotUsername, getTransferDetails } from "../../services/settings.service";
import { getUserById, getUserStatsSummary, listRecentUsers } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import type { User } from "../../types/entities";
import { formatDateTime } from "../../utils/date";
import { sendScreen } from "../../utils/media";
import {
  buildCuratorText,
  buildProjectInfoText,
  buildTeamProfileText,
  escapeHtml,
  formatMoney,
  formatUserLabel,
  getRoleTitle,
} from "../../utils/text";

function getPhotoExtra(markup: { reply_markup: unknown }) {
  return markup as never;
}

function getMessageExtra(markup: { reply_markup: unknown }) {
  return markup as never;
}

export async function showTeambotHome(ctx: AppContext) {
  const cleanupMessage = await ctx.reply(".", Markup.removeKeyboard()).catch(() => null);
  if (cleanupMessage && "message_id" in cleanupMessage) {
    await ctx.deleteMessage(cleanupMessage.message_id).catch(() => undefined);
  }

  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "menu.png",
    text: "",
    photoExtra: getPhotoExtra(teambotMainMenuInlineKeyboard()),
    messageExtra: getMessageExtra(teambotMainMenuInlineKeyboard()),
  });
}

export async function showTeamWorkMenu(ctx: AppContext) {
  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "bot.png",
    text: [
      "<b>💼 Бот для работы</b>",
      "",
      "В этом разделе можно создавать карточки, получать личную реферальную ссылку и открывать рабочие настройки.",
    ].join("\n"),
    photoExtra: getPhotoExtra(teamWorkKeyboard()),
    messageExtra: getMessageExtra(teamWorkKeyboard()),
  });
}

export async function showTeamWorkSettings(ctx: AppContext) {
  await ctx.reply(
    [
      "<b>⚙️ Настройки воркера</b>",
      "",
      "Здесь собраны быстрые подсказки по рабочему разделу.",
      "🔗 Моя рефка вынесена в отдельную кнопку, чтобы ссылку можно было быстро копировать и отправлять клиентам.",
      "Все переходы по реферальной ссылке и ключевые действия в Honey Bunny закрепляются за вами и приходят в личные сообщения teambot.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...teambotBackKeyboard(),
    },
  );
}

export async function showWorkerReferralScreen(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  const servicebotUsername = await getServicebotUsername();
  const referralLink = buildServicebotReferralLink(user.id, servicebotUsername);
  const stats = await getWorkerClientsStats(user.id);

  await ctx.reply(
    [
      "<b>🔗 Моя рефка</b>",
      "",
      "Ваша персональная ссылка для Honey Bunny:",
      referralLink
        ? `<code>${escapeHtml(referralLink)}</code>`
        : "Ссылка появится после запуска servicebot с публичным username.",
      "",
      `🐘 Закреплено мамонтов: ${stats.total}`,
      "Переходы, открытие вкладок, выбор моделей и шаги к пополнению будут приходить вам в личные сообщения teambot.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...teambotBackKeyboard(),
    },
  );
}

export async function showTransferScreen(ctx: AppContext) {
  const transferDetails = await getTransferDetails();
  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "karta.png",
    text: ["<b>💳 Карта для переводов</b>", "", "Актуальные реквизиты:", escapeHtml(transferDetails)].join("\n"),
    photoExtra: getPhotoExtra(teambotBackKeyboard()),
    messageExtra: getMessageExtra(teambotBackKeyboard()),
  });
}

export async function showProfileScreen(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  const profitMetrics = await getWorkerProfitMetrics(user.id);
  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "profile.png",
    text: buildTeamProfileText(user, profitMetrics.totalCount),
    photoExtra: getPhotoExtra(teambotBackKeyboard()),
    messageExtra: getMessageExtra(teambotBackKeyboard()),
  });
}

export async function showCuratorsScreen(ctx: AppContext) {
  const user = ctx.state.user;
  const curator = user?.curator_id ? await getCuratorById(user.curator_id) : null;

  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "curators.png",
    text: buildCuratorText(curator),
    photoExtra: getPhotoExtra(teambotBackKeyboard()),
    messageExtra: getMessageExtra(teambotBackKeyboard()),
  });
}

export async function showProjectInfoScreen(ctx: AppContext) {
  const stats = await getProjectStats();
  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "info.png",
    text: buildProjectInfoText(stats),
    photoExtra: getPhotoExtra(teambotBackKeyboard()),
    messageExtra: getMessageExtra(teambotBackKeyboard()),
  });
}

export async function showAdminHome(ctx: AppContext) {
  await ctx.reply(
    ["<b>🛡 Админ-панель teambot</b>", "", "Выберите нужный раздел управления."].join("\n"),
    {
      parse_mode: "HTML",
      ...adminHomeKeyboard(),
    },
  );
}

export async function showAdminStats(ctx: AppContext) {
  const users = await getUserStatsSummary();
  const cards = await countCards();

  await ctx.reply(
    [
      "<b>📊 Общая статистика</b>",
      "",
      `👥 Пользователей: ${users.totalUsers}`,
      `💼 Активных сотрудников: ${users.activeWorkers}`,
      `📝 Создано карточек: ${cards}`,
      `💸 Общий профит: ${formatMoney(users.totalProfit)}`,
      `📈 Средний профит: ${formatMoney(users.avgProfit)}`,
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...adminHomeKeyboard(),
    },
  );
}

export async function showAdminUsersMenu(ctx: AppContext) {
  await ctx.reply("<b>👥 Управление пользователями</b>\n\nВыберите действие.", {
    parse_mode: "HTML",
    ...adminUsersKeyboard(),
  });
}

export async function showRecentUsers(ctx: AppContext) {
  const users = await listRecentUsers(10);
  if (!users.length) {
    await ctx.reply("Пользователей пока нет.", {
      ...adminUsersKeyboard(),
    });
    return;
  }

  const keyboard = {
    inline_keyboard: [
      ...users.map((user) => [
        { text: `${user.id}. ${formatUserLabel(user)} (${user.telegram_id})`, callback_data: `admin:user:${user.id}:view` },
      ]),
      [{ text: "⬅️ Назад", callback_data: "admin:users" }],
    ],
  };

  await ctx.reply("<b>🕘 Последние пользователи</b>", {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
}

function buildAdminUserText(user: User, curatorName?: string | null) {
  return [
    "<b>👤 Профиль пользователя</b>",
    "",
    `ID записи: ${user.id}`,
    `Telegram ID: <code>${user.telegram_id}</code>`,
    `Username: ${user.username ? `@${escapeHtml(user.username)}` : "не указан"}`,
    `Имя: ${user.first_name ? escapeHtml(user.first_name) : "не указано"}`,
    `Роль: ${getRoleTitle(user.role)}`,
    `Статус: ${user.is_blocked ? "⛔ Заблокирован" : "✅ Активен"}`,
    `Баланс: ${formatMoney(user.balance)}`,
    `Профит: ${formatMoney(user.total_profit)}`,
    `Куратор: ${curatorName ? escapeHtml(curatorName) : "не назначен"}`,
    `Создан: ${formatDateTime(user.created_at)}`,
  ].join("\n");
}

export async function showAdminUserProfile(ctx: AppContext, userId: number) {
  const user = await getUserById(userId);
  if (!user) {
    await ctx.reply("Пользователь не найден.");
    return;
  }

  const curator = user.curator_id ? await getCuratorById(user.curator_id) : null;
  await ctx.reply(buildAdminUserText(user, curator?.name), {
    parse_mode: "HTML",
    ...adminUserActionsKeyboard(user.id, user.is_blocked === 1, Boolean(user.curator_id)),
  });
}

export async function showAdminCurators(ctx: AppContext) {
  const curators = await listCurators();
  const text = curators.length
    ? "<b>🧑‍💼 Кураторы</b>\n\nВыберите куратора или действие ниже."
    : "<b>🧑‍💼 Кураторы</b>\n\nПока нет активных кураторов.";

  await ctx.reply(text, {
    parse_mode: "HTML",
    ...adminCuratorsKeyboard(curators),
  });
}

export async function showAdminCurator(ctx: AppContext, curatorId: number) {
  const curator = await getCuratorById(curatorId);
  if (!curator) {
    await ctx.reply("Куратор не найден.");
    return;
  }

  await ctx.reply(
    [
      "<b>🧑‍💼 Карточка куратора</b>",
      "",
      `ID: ${curator.id}`,
      `Имя: ${escapeHtml(curator.name)}`,
      `Описание: ${curator.description ? escapeHtml(curator.description) : "не заполнено"}`,
      `Статус: ${curator.is_active ? "✅ Активен" : "⛔ Отключен"}`,
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...adminCuratorActionsKeyboard(curator.id),
    },
  );
}

export async function showAdminTransfer(ctx: AppContext) {
  const transferDetails = await getTransferDetails();
  await ctx.reply(
    [
      "<b>💳 Реквизиты</b>",
      "",
      escapeHtml(transferDetails),
      "",
      "Чтобы изменить данные, нажмите кнопку ниже.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✏️ Изменить реквизиты", callback_data: "admin:transfer:edit" }],
          [{ text: "⬅️ Назад", callback_data: "admin:home" }],
        ],
      },
    },
  );
}

export async function showAdminProjectStats(ctx: AppContext) {
  const stats = await getProjectStats();
  await ctx.reply(
    [
      "<b>📈 Статистика проекта</b>",
      "",
      `📊 Профитов: ${stats.totalProfits}`,
      `💸 Сумма профитов: ${formatMoney(stats.totalProfitAmount)}`,
      `💳 Процент выплат: ${stats.payoutPercent}%`,
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...adminProjectStatsKeyboard(),
    },
  );
}

export async function showAdminLogsMenu(ctx: AppContext) {
  await ctx.reply("<b>🗂 Логи</b>\n\nВыберите тип журнала.", {
    parse_mode: "HTML",
    ...adminLogsKeyboard(),
  });
}

export async function showAdminActionLogs(ctx: AppContext) {
  const logs = await getRecentAdminLogs(10);
  const text = logs.length
    ? logs
        .map(
          (log) =>
            `🕒 ${formatDateTime(log.created_at)} | admin #${log.admin_user_id}\n${escapeHtml(log.action)}${
              log.details ? `\n${escapeHtml(log.details)}` : ""
            }`,
        )
        .join("\n\n")
    : "Журнал действий пока пуст.";

  await ctx.reply(`<b>📝 Журнал действий</b>\n\n${text}`, {
    parse_mode: "HTML",
    ...adminLogsKeyboard(),
  });
}

export async function showAdminErrorLogs(ctx: AppContext) {
  const logs = await getRecentErrorLogs(10);
  const text = logs.length
    ? logs
        .map(
          (log) =>
            `🕒 ${formatDateTime(log.created_at)} | ${escapeHtml(log.bot_name)} | ${log.user_telegram_id ?? "n/a"}\n${escapeHtml(log.message)}`,
        )
        .join("\n\n")
    : "Журнал ошибок пока пуст.";

  await ctx.reply(`<b>🚨 Журнал ошибок</b>\n\n${text}`, {
    parse_mode: "HTML",
    ...adminLogsKeyboard(),
  });
}

