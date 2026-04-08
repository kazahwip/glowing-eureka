import { Markup } from "telegraf";
import {
  adminCardActionsKeyboard,
  adminCardDeleteConfirmKeyboard,
  adminCardsKeyboard,
  adminCuratorActionsKeyboard,
  adminCuratorsKeyboard,
  adminHomeKeyboard,
  adminLogsKeyboard,
  adminOwnerCardsKeyboard,
  adminProjectStatsKeyboard,
  adminUserActionsKeyboard,
  adminUsersKeyboard,
} from "../../keyboards/admin";
import {
  curatorDirectoryKeyboard,
  teamWorkKeyboard,
  teambotBackKeyboard,
  teambotMainMenuInlineKeyboard,
  withdrawRequestKeyboard,
  workerSignalSettingsKeyboard,
} from "../../keyboards/teambot";
import { countCards, getCardWithOwner, listCardsByOwner, listRecentCardsForAdmin } from "../../services/cards.service";
import { getWorkerClientsStats } from "../../services/clients.service";
import { getCuratorById, getCuratorWithUser, listCurators } from "../../services/curators.service";
import { getWorkerProfitMetrics } from "../../services/kassa.service";
import { getRecentAdminLogs, getRecentErrorLogs } from "../../services/logging.service";
import { buildServicebotReferralLink } from "../../services/referrals.service";
import { getProjectStats, getServicebotUsername, getTransferDetails } from "../../services/settings.service";
import { getUserById, getUserStatsSummary, listRecentUsers } from "../../services/users.service";
import { getWithdrawRequestSummary, listRecentWithdrawRequestsByUser } from "../../services/withdraw-requests.service";
import type { AppContext } from "../../types/context";
import type { Curator, User } from "../../types/entities";
import { formatDateTime } from "../../utils/date";
import { sendScreen } from "../../utils/media";
import {
  buildProjectInfoText,
  buildTeamProfileText,
  escapeHtml,
  formatMoney,
  formatUserLabel,
  getCardCategoryTitle,
  getRoleTitle,
} from "../../utils/text";

function getPhotoExtra(markup: { reply_markup: unknown }) {
  return markup as never;
}

function getMessageExtra(markup: { reply_markup: unknown }) {
  return markup as never;
}

function buildCuratorsDirectoryText(currentCurator: Curator | null | undefined, hasCurators: boolean) {
  const lines = ["<b>🧑‍💼 Система кураторов</b>", ""];

  if (currentCurator) {
    lines.push(
      `Ваш куратор: <b>${escapeHtml(currentCurator.name)}</b>${
        currentCurator.telegram_username ? ` (@${escapeHtml(currentCurator.telegram_username)})` : ""
      }`,
      "Ниже можно открыть профиль куратора или отправить новую заявку.",
    );
  } else {
    lines.push("У вас пока нет назначенного куратора.");
  }

  lines.push("", "Кураторы берут 10% от подтвержденной оплаты.", "");
  lines.push(hasCurators ? "Выберите куратора из списка ниже." : "Список кураторов пока пуст.");

  return lines.join("\n");
}

function buildSignalSettingsText() {
  return [
    "<b>⚙️ Настройки сигналов</b>",
    "",
    "Выберите, какие логи по мамонтам и действиям клиентов должны приходить вам в личные сообщения AWAKE BOT.",
    "",
    "🐘 Новые мамонты — переходы по вашей рефке",
    "🧭 Навигация по боту — открытие основных разделов",
    "🔎 Города и анкеты — выбор разделов, городов и анкет",
    "💳 Пополнения и оплата — переходы к оплате и пополнению",
    "📅 Предзаказы — заявки по анкетам и бронированию",
  ].join("\n");
}

function getWithdrawStatusLabel(status: "pending" | "approved" | "paid" | "rejected") {
  if (status === "approved") {
    return "✅ Подтверждена";
  }

  if (status === "paid") {
    return "💸 Выплачена";
  }

  if (status === "rejected") {
    return "❌ Отклонена";
  }

  return "⏳ На проверке";
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
      "Здесь можно создавать карточки, брать реферальную ссылку и открывать рабочие настройки.",
    ].join("\n"),
    photoExtra: getPhotoExtra(teamWorkKeyboard()),
    messageExtra: getMessageExtra(teamWorkKeyboard()),
  });
}

export async function showTeamWorkSettings(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "bot.png",
    text: buildSignalSettingsText(),
    photoExtra: getPhotoExtra(workerSignalSettingsKeyboard(user)),
    messageExtra: getMessageExtra(workerSignalSettingsKeyboard(user)),
  });
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
      referralLink ? `<code>${escapeHtml(referralLink)}</code>` : "Ссылка появится после запуска servicebot с публичным username.",
      "",
      `🐘 Закреплено мамонтов: ${stats.total}`,
      "Переходы, открытие вкладок, выбор моделей и шаги к пополнению будут приходить вам в личные сообщения AWAKE BOT.",
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

export async function showWithdrawRequestsScreen(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  const [currentCurator, summary, requests] = await Promise.all([
    user.curator_id ? getCuratorById(user.curator_id) : Promise.resolve(null),
    getWithdrawRequestSummary(user.id),
    listRecentWithdrawRequestsByUser(user.id, 5),
  ]);
  const payoutLines = [
    "<b>💸 Заявка на вывод</b>",
    "",
    `Доступно для вывода: ${formatMoney(user.withdrawable_balance)}`,
    `Ожидает проверки: ${summary.pendingCount} шт. • ${formatMoney(summary.pendingAmount)}`,
    `Подтверждено админом: ${formatMoney(summary.approvedAmount)}`,
    `Уже выплачено: ${formatMoney(summary.paidAmount)}`,
  ];

  if (user.role === "admin") {
    payoutLines.push(
      "Доля администратора: 100% от подтвержденной оплаты.",
      "Кураторская доля для админского профита не применяется.",
    );
  } else {
    payoutLines.push(
      "Доля воркера: 25% от подтвержденной оплаты.",
      currentCurator
        ? `Доля куратора ${escapeHtml(currentCurator.name)}: 10% от подтвержденной оплаты.`
        : "Если будет назначен куратор, его доля составит 10%.",
    );
  }

  payoutLines.push("", "<b>Последние заявки</b>");

  if (!requests.length) {
    payoutLines.push("Заявок пока нет. Создайте первую через кнопку ниже.");
  } else {
    for (const request of requests) {
      payoutLines.push(
        `#${request.id} • ${getWithdrawStatusLabel(request.status)}`,
        `${formatMoney(request.amount)} • ${formatDateTime(request.created_at)}`,
      );
    }
  }

  await ctx.reply(payoutLines.join("\n"), {
    parse_mode: "HTML",
    ...withdrawRequestKeyboard(user.withdrawable_balance > 0),
  });
}
export async function showCuratorsScreen(ctx: AppContext) {
  const user = ctx.state.user;
  const [currentCurator, curators] = await Promise.all([
    user?.curator_id ? getCuratorById(user.curator_id) : Promise.resolve(null),
    listCurators(),
  ]);

  await sendScreen(ctx, {
    botKind: "teambot",
    banner: "curators.png",
    text: buildCuratorsDirectoryText(currentCurator, curators.length > 0),
    photoExtra: getPhotoExtra(curatorDirectoryKeyboard(curators, user?.curator_id ?? null, true)),
    messageExtra: getMessageExtra(curatorDirectoryKeyboard(curators, user?.curator_id ?? null, true)),
  });
}

export async function showCuratorsChatList(ctx: AppContext) {
  const user = ctx.state.user;
  const [currentCurator, curators] = await Promise.all([
    user?.curator_id ? getCuratorById(user.curator_id) : Promise.resolve(null),
    listCurators(),
  ]);

  const lines = ["<b>🧑‍💼 Актуальный список кураторов</b>"];
  if (currentCurator) {
    lines.push("", `Текущий куратор: <b>${escapeHtml(currentCurator.name)}</b>`);
  }

  lines.push("", "Кураторы берут 10% от подтвержденной оплаты.");
  lines.push("", curators.length ? "Откройте профиль куратора или отправьте заявку прямо из списка." : "Список кураторов пока пуст.");

  await ctx.reply(lines.join("\n"), {
    parse_mode: "HTML",
    ...curatorDirectoryKeyboard(curators, user?.curator_id ?? null, false),
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
  await ctx.reply(["<b>🛡 Админ-панель AWAKE BOT</b>", "", "Выберите нужный раздел управления."].join("\n"), {
    parse_mode: "HTML",
    ...adminHomeKeyboard(),
  });
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
      ...users.map((user) => [{ text: `${user.id}. ${formatUserLabel(user)} (${user.telegram_id})`, callback_data: `admin:user:${user.id}:view` }]),
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
    `Баланс Honey Bunny: ${formatMoney(user.balance)}`,
    `Баланс AWAKE BOT: ${formatMoney(user.withdrawable_balance)}`,
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
    ...adminUserActionsKeyboard(user.id, user.role, user.is_blocked === 1, Boolean(user.curator_id)),
  });
}

function buildAdminCardText(card: NonNullable<Awaited<ReturnType<typeof getCardWithOwner>>>) {
  return [
    "<b>📋 Карточка анкеты</b>",
    "",
    `ID: #${card.id}`,
    `Имя: ${escapeHtml(card.name)}`,
    `Возраст: ${card.age}`,
    `Категория: ${escapeHtml(getCardCategoryTitle(card.category))}`,
    `Город: ${escapeHtml(card.city)}`,
    `Статус: ${card.is_active ? "✅ Активна" : "⛔ Неактивна"}`,
    `Модерация: ${escapeHtml(card.review_status)}`,
    `Источник: ${escapeHtml(card.source)}`,
    `Владелец: ${escapeHtml(
      formatUserLabel({
        telegram_id: card.owner_telegram_id,
        username: card.owner_username,
        first_name: card.owner_first_name,
      }),
    )}`,
    `Telegram ID владельца: <code>${card.owner_telegram_id}</code>`,
    `Фото: ${card.photos.length}`,
    `Создана: ${formatDateTime(card.created_at)}`,
    "",
    `1 час: ${formatMoney(card.price_1h)}`,
    `3 часа: ${formatMoney(card.price_3h)}`,
    `Весь день: ${formatMoney(card.price_full_day)}`,
    ...(card.description ? ["", `Описание: ${escapeHtml(card.description)}`] : []),
  ].join("\n");
}

export async function showAdminCardsMenu(ctx: AppContext) {
  const cards = await listRecentCardsForAdmin(15);
  const text = cards.length
    ? "<b>📋 Анкеты</b>\n\nПоследние карточки в базе. Откройте нужную анкету для просмотра и удаления."
    : "<b>📋 Анкеты</b>\n\nВ базе пока нет карточек.";

  await ctx.reply(text, {
    parse_mode: "HTML",
    ...adminCardsKeyboard(cards),
  });
}

export async function showAdminOwnerCards(ctx: AppContext, ownerUserId: number) {
  const user = await getUserById(ownerUserId);
  if (!user) {
    await ctx.reply("Пользователь не найден.");
    return;
  }

  const cards = await listCardsByOwner(ownerUserId);
  const title = escapeHtml(formatUserLabel(user));
  const text = cards.length
    ? `<b>📋 Анкеты пользователя</b>\n\nВладелец: ${title}\nНайдено анкет: ${cards.length}`
    : `<b>📋 Анкеты пользователя</b>\n\nУ ${title} пока нет анкет.`;

  await ctx.reply(text, {
    parse_mode: "HTML",
    ...adminOwnerCardsKeyboard(cards, ownerUserId),
  });
}

export async function showAdminCardProfile(ctx: AppContext, cardId: number) {
  const card = await getCardWithOwner(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  await ctx.reply(buildAdminCardText(card), {
    parse_mode: "HTML",
    ...adminCardActionsKeyboard(card.id, card.owner_user_id),
  });
}

export async function showAdminCardDeleteConfirm(ctx: AppContext, cardId: number) {
  const card = await getCardWithOwner(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  await ctx.reply(
    [
      "<b>⚠️ Подтвердите удаление анкеты</b>",
      "",
      `Вы собираетесь удалить анкету <b>${escapeHtml(card.name)}</b> (#${card.id}).`,
      "Карточка исчезнет из Honey Bunny, а связанные фото, избранное и бронирования будут удалены каскадно.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...adminCardDeleteConfirmKeyboard(card.id, card.owner_user_id),
    },
  );
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
  const curator = await getCuratorWithUser(curatorId);
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
      `Username: ${curator.telegram_username ? `@${escapeHtml(curator.telegram_username)}` : "не указан"}`,
      `Привязка к AWAKE BOT: ${
        curator.linked_user_id && curator.linked_telegram_id ? `<code>${curator.linked_telegram_id}</code>` : "нет"
      }`,
      `Описание: ${curator.description ? escapeHtml(curator.description) : "не заполнено"}`,
      `Статус: ${curator.is_active ? "✅ Активен" : "⛔ Отключен"}`,
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...adminCuratorActionsKeyboard(curator.id, curator.telegram_username),
    },
  );
}

export async function showAdminTransfer(ctx: AppContext) {
  const transferDetails = await getTransferDetails();
  await ctx.reply(
    ["<b>💳 Реквизиты</b>", "", escapeHtml(transferDetails), "", "Чтобы изменить данные, нажмите кнопку ниже."].join("\n"),
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
        .map((log) => `🕒 ${formatDateTime(log.created_at)} | admin #${log.admin_user_id}\n${escapeHtml(log.action)}${log.details ? `\n${escapeHtml(log.details)}` : ""}`)
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
        .map((log) => `🕒 ${formatDateTime(log.created_at)} | ${escapeHtml(log.bot_name)} | ${log.user_telegram_id ?? "n/a"}\n${escapeHtml(log.message)}`)
        .join("\n\n")
    : "Журнал ошибок пока пуст.";

  await ctx.reply(`<b>🚨 Журнал ошибок</b>\n\n${text}`, {
    parse_mode: "HTML",
    ...adminLogsKeyboard(),
  });
}
