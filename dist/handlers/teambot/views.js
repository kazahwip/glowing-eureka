"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showTeambotHome = showTeambotHome;
exports.showTeamWorkMenu = showTeamWorkMenu;
exports.showTeamWorkSettings = showTeamWorkSettings;
exports.showWorkerReferralScreen = showWorkerReferralScreen;
exports.showTransferScreen = showTransferScreen;
exports.showProfileScreen = showProfileScreen;
exports.showWithdrawRequestsScreen = showWithdrawRequestsScreen;
exports.showCuratorsScreen = showCuratorsScreen;
exports.showCuratorsChatList = showCuratorsChatList;
exports.showProjectInfoScreen = showProjectInfoScreen;
exports.showAdminHome = showAdminHome;
exports.showAdminStats = showAdminStats;
exports.showAdminUsersMenu = showAdminUsersMenu;
exports.showRecentUsers = showRecentUsers;
exports.showAdminUserProfile = showAdminUserProfile;
exports.showAdminCardsMenu = showAdminCardsMenu;
exports.showAdminOwnerCards = showAdminOwnerCards;
exports.showAdminCardProfile = showAdminCardProfile;
exports.showAdminCardDeleteConfirm = showAdminCardDeleteConfirm;
exports.showAdminCurators = showAdminCurators;
exports.showAdminCurator = showAdminCurator;
exports.showAdminTransfer = showAdminTransfer;
exports.showAdminProjectStats = showAdminProjectStats;
exports.showAdminLogsMenu = showAdminLogsMenu;
exports.showAdminActionLogs = showAdminActionLogs;
exports.showAdminErrorLogs = showAdminErrorLogs;
const telegraf_1 = require("telegraf");
const admin_1 = require("../../keyboards/admin");
const teambot_1 = require("../../keyboards/teambot");
const cards_service_1 = require("../../services/cards.service");
const clients_service_1 = require("../../services/clients.service");
const curators_service_1 = require("../../services/curators.service");
const kassa_service_1 = require("../../services/kassa.service");
const logging_service_1 = require("../../services/logging.service");
const referrals_service_1 = require("../../services/referrals.service");
const settings_service_1 = require("../../services/settings.service");
const users_service_1 = require("../../services/users.service");
const withdraw_requests_service_1 = require("../../services/withdraw-requests.service");
const date_1 = require("../../utils/date");
const media_1 = require("../../utils/media");
const text_1 = require("../../utils/text");
function getPhotoExtra(markup) {
    return markup;
}
function getMessageExtra(markup) {
    return markup;
}
function buildCuratorsDirectoryText(currentCurator, hasCurators) {
    const lines = ["<b>🧑‍💼 Система кураторов</b>", ""];
    if (currentCurator) {
        lines.push(`Ваш куратор: <b>${(0, text_1.escapeHtml)(currentCurator.name)}</b>${currentCurator.telegram_username ? ` (@${(0, text_1.escapeHtml)(currentCurator.telegram_username)})` : ""}`, "Ниже можно открыть профиль куратора или отправить новую заявку.");
    }
    else {
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
function getWithdrawStatusLabel(status) {
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
async function showTeambotHome(ctx) {
    const cleanupMessage = await ctx.reply(".", telegraf_1.Markup.removeKeyboard()).catch(() => null);
    if (cleanupMessage && "message_id" in cleanupMessage) {
        await ctx.deleteMessage(cleanupMessage.message_id).catch(() => undefined);
    }
    await (0, media_1.sendScreen)(ctx, {
        botKind: "teambot",
        banner: "menu.png",
        text: "",
        photoExtra: getPhotoExtra((0, teambot_1.teambotMainMenuInlineKeyboard)()),
        messageExtra: getMessageExtra((0, teambot_1.teambotMainMenuInlineKeyboard)()),
    });
}
async function showTeamWorkMenu(ctx) {
    await (0, media_1.sendScreen)(ctx, {
        botKind: "teambot",
        banner: "bot.png",
        text: [
            "<b>💼 Бот для работы</b>",
            "",
            "Здесь можно создавать карточки, брать реферальную ссылку и открывать рабочие настройки.",
        ].join("\n"),
        photoExtra: getPhotoExtra((0, teambot_1.teamWorkKeyboard)()),
        messageExtra: getMessageExtra((0, teambot_1.teamWorkKeyboard)()),
    });
}
async function showTeamWorkSettings(ctx) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    await (0, media_1.sendScreen)(ctx, {
        botKind: "teambot",
        banner: "bot.png",
        text: buildSignalSettingsText(),
        photoExtra: getPhotoExtra((0, teambot_1.workerSignalSettingsKeyboard)(user)),
        messageExtra: getMessageExtra((0, teambot_1.workerSignalSettingsKeyboard)(user)),
    });
}
async function showWorkerReferralScreen(ctx) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    const servicebotUsername = await (0, settings_service_1.getServicebotUsername)();
    const referralLink = (0, referrals_service_1.buildServicebotReferralLink)(user.id, servicebotUsername);
    const stats = await (0, clients_service_1.getWorkerClientsStats)(user.id);
    await ctx.reply([
        "<b>🔗 Моя рефка</b>",
        "",
        "Ваша персональная ссылка для Honey Bunny:",
        referralLink ? `<code>${(0, text_1.escapeHtml)(referralLink)}</code>` : "Ссылка появится после запуска servicebot с публичным username.",
        "",
        `🐘 Закреплено мамонтов: ${stats.total}`,
        "Переходы, открытие вкладок, выбор моделей и шаги к пополнению будут приходить вам в личные сообщения AWAKE BOT.",
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, teambot_1.teambotBackKeyboard)(),
    });
}
async function showTransferScreen(ctx) {
    const transferDetails = await (0, settings_service_1.getTransferDetails)();
    await (0, media_1.sendScreen)(ctx, {
        botKind: "teambot",
        banner: "karta.png",
        text: ["<b>💳 Карта для переводов</b>", "", "Актуальные реквизиты:", (0, text_1.escapeHtml)(transferDetails)].join("\n"),
        photoExtra: getPhotoExtra((0, teambot_1.teambotBackKeyboard)()),
        messageExtra: getMessageExtra((0, teambot_1.teambotBackKeyboard)()),
    });
}
async function showProfileScreen(ctx) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    const profitMetrics = await (0, kassa_service_1.getWorkerProfitMetrics)(user.id);
    await (0, media_1.sendScreen)(ctx, {
        botKind: "teambot",
        banner: "profile.png",
        text: (0, text_1.buildTeamProfileText)(user, profitMetrics.totalCount),
        photoExtra: getPhotoExtra((0, teambot_1.teambotBackKeyboard)()),
        messageExtra: getMessageExtra((0, teambot_1.teambotBackKeyboard)()),
    });
}
async function showWithdrawRequestsScreen(ctx) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    const [currentCurator, summary, requests] = await Promise.all([
        user.curator_id ? (0, curators_service_1.getCuratorById)(user.curator_id) : Promise.resolve(null),
        (0, withdraw_requests_service_1.getWithdrawRequestSummary)(user.id),
        (0, withdraw_requests_service_1.listRecentWithdrawRequestsByUser)(user.id, 5),
    ]);
    const payoutLines = [
        "<b>💸 Заявка на вывод</b>",
        "",
        `Доступно для вывода: ${(0, text_1.formatMoney)(user.withdrawable_balance)}`,
        `Ожидает проверки: ${summary.pendingCount} шт. • ${(0, text_1.formatMoney)(summary.pendingAmount)}`,
        `Подтверждено админом: ${(0, text_1.formatMoney)(summary.approvedAmount)}`,
        `Уже выплачено: ${(0, text_1.formatMoney)(summary.paidAmount)}`,
    ];
    if (user.role === "admin") {
        payoutLines.push("Доля администратора: 100% от подтвержденной оплаты.", "Кураторская доля для админского профита не применяется.");
    }
    else {
        payoutLines.push("Доля воркера: 25% от подтвержденной оплаты.", currentCurator
            ? `Доля куратора ${(0, text_1.escapeHtml)(currentCurator.name)}: 10% от подтвержденной оплаты.`
            : "Если будет назначен куратор, его доля составит 10%.");
    }
    payoutLines.push("", "<b>Последние заявки</b>");
    if (!requests.length) {
        payoutLines.push("Заявок пока нет. Создайте первую через кнопку ниже.");
    }
    else {
        for (const request of requests) {
            payoutLines.push(`#${request.id} • ${getWithdrawStatusLabel(request.status)}`, `${(0, text_1.formatMoney)(request.amount)} • ${(0, date_1.formatDateTime)(request.created_at)}`);
        }
    }
    await ctx.reply(payoutLines.join("\n"), {
        parse_mode: "HTML",
        ...(0, teambot_1.withdrawRequestKeyboard)(user.withdrawable_balance > 0),
    });
}
async function showCuratorsScreen(ctx) {
    const user = ctx.state.user;
    const [currentCurator, curators] = await Promise.all([
        user?.curator_id ? (0, curators_service_1.getCuratorById)(user.curator_id) : Promise.resolve(null),
        (0, curators_service_1.listCurators)(),
    ]);
    await (0, media_1.sendScreen)(ctx, {
        botKind: "teambot",
        banner: "curators.png",
        text: buildCuratorsDirectoryText(currentCurator, curators.length > 0),
        photoExtra: getPhotoExtra((0, teambot_1.curatorDirectoryKeyboard)(curators, user?.curator_id ?? null, true)),
        messageExtra: getMessageExtra((0, teambot_1.curatorDirectoryKeyboard)(curators, user?.curator_id ?? null, true)),
    });
}
async function showCuratorsChatList(ctx) {
    const user = ctx.state.user;
    const [currentCurator, curators] = await Promise.all([
        user?.curator_id ? (0, curators_service_1.getCuratorById)(user.curator_id) : Promise.resolve(null),
        (0, curators_service_1.listCurators)(),
    ]);
    const lines = ["<b>🧑‍💼 Актуальный список кураторов</b>"];
    if (currentCurator) {
        lines.push("", `Текущий куратор: <b>${(0, text_1.escapeHtml)(currentCurator.name)}</b>`);
    }
    lines.push("", "Кураторы берут 10% от подтвержденной оплаты.");
    lines.push("", curators.length ? "Откройте профиль куратора или отправьте заявку прямо из списка." : "Список кураторов пока пуст.");
    await ctx.reply(lines.join("\n"), {
        parse_mode: "HTML",
        ...(0, teambot_1.curatorDirectoryKeyboard)(curators, user?.curator_id ?? null, false),
    });
}
async function showProjectInfoScreen(ctx) {
    const stats = await (0, settings_service_1.getProjectStats)();
    await (0, media_1.sendScreen)(ctx, {
        botKind: "teambot",
        banner: "info.png",
        text: (0, text_1.buildProjectInfoText)(stats),
        photoExtra: getPhotoExtra((0, teambot_1.teambotBackKeyboard)()),
        messageExtra: getMessageExtra((0, teambot_1.teambotBackKeyboard)()),
    });
}
async function showAdminHome(ctx) {
    await ctx.reply(["<b>🛡 Админ-панель AWAKE BOT</b>", "", "Выберите нужный раздел управления."].join("\n"), {
        parse_mode: "HTML",
        ...(0, admin_1.adminHomeKeyboard)(),
    });
}
async function showAdminStats(ctx) {
    const users = await (0, users_service_1.getUserStatsSummary)();
    const cards = await (0, cards_service_1.countCards)();
    await ctx.reply([
        "<b>📊 Общая статистика</b>",
        "",
        `👥 Пользователей: ${users.totalUsers}`,
        `💼 Активных сотрудников: ${users.activeWorkers}`,
        `📝 Создано карточек: ${cards}`,
        `💸 Общий профит: ${(0, text_1.formatMoney)(users.totalProfit)}`,
        `📈 Средний профит: ${(0, text_1.formatMoney)(users.avgProfit)}`,
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, admin_1.adminHomeKeyboard)(),
    });
}
async function showAdminUsersMenu(ctx) {
    await ctx.reply("<b>👥 Управление пользователями</b>\n\nВыберите действие.", {
        parse_mode: "HTML",
        ...(0, admin_1.adminUsersKeyboard)(),
    });
}
async function showRecentUsers(ctx) {
    const users = await (0, users_service_1.listRecentUsers)(10);
    if (!users.length) {
        await ctx.reply("Пользователей пока нет.", {
            ...(0, admin_1.adminUsersKeyboard)(),
        });
        return;
    }
    const keyboard = {
        inline_keyboard: [
            ...users.map((user) => [{ text: `${user.id}. ${(0, text_1.formatUserLabel)(user)} (${user.telegram_id})`, callback_data: `admin:user:${user.id}:view` }]),
            [{ text: "⬅️ Назад", callback_data: "admin:users" }],
        ],
    };
    await ctx.reply("<b>🕘 Последние пользователи</b>", {
        parse_mode: "HTML",
        reply_markup: keyboard,
    });
}
function buildAdminUserText(user, curatorName) {
    return [
        "<b>👤 Профиль пользователя</b>",
        "",
        `ID записи: ${user.id}`,
        `Telegram ID: <code>${user.telegram_id}</code>`,
        `Username: ${user.username ? `@${(0, text_1.escapeHtml)(user.username)}` : "не указан"}`,
        `Имя: ${user.first_name ? (0, text_1.escapeHtml)(user.first_name) : "не указано"}`,
        `Роль: ${(0, text_1.getRoleTitle)(user.role)}`,
        `Статус: ${user.is_blocked ? "⛔ Заблокирован" : "✅ Активен"}`,
        `Баланс Honey Bunny: ${(0, text_1.formatMoney)(user.balance)}`,
        `Баланс AWAKE BOT: ${(0, text_1.formatMoney)(user.withdrawable_balance)}`,
        `Профит: ${(0, text_1.formatMoney)(user.total_profit)}`,
        `Куратор: ${curatorName ? (0, text_1.escapeHtml)(curatorName) : "не назначен"}`,
        `Создан: ${(0, date_1.formatDateTime)(user.created_at)}`,
    ].join("\n");
}
async function showAdminUserProfile(ctx, userId) {
    const user = await (0, users_service_1.getUserById)(userId);
    if (!user) {
        await ctx.reply("Пользователь не найден.");
        return;
    }
    const curator = user.curator_id ? await (0, curators_service_1.getCuratorById)(user.curator_id) : null;
    await ctx.reply(buildAdminUserText(user, curator?.name), {
        parse_mode: "HTML",
        ...(0, admin_1.adminUserActionsKeyboard)(user.id, user.role, user.is_blocked === 1, Boolean(user.curator_id)),
    });
}
function buildAdminCardText(card) {
    return [
        "<b>📋 Карточка анкеты</b>",
        "",
        `ID: #${card.id}`,
        `Имя: ${(0, text_1.escapeHtml)(card.name)}`,
        `Возраст: ${card.age}`,
        `Категория: ${(0, text_1.escapeHtml)((0, text_1.getCardCategoryTitle)(card.category))}`,
        `Город: ${(0, text_1.escapeHtml)(card.city)}`,
        `Статус: ${card.is_active ? "✅ Активна" : "⛔ Неактивна"}`,
        `Модерация: ${(0, text_1.escapeHtml)(card.review_status)}`,
        `Источник: ${(0, text_1.escapeHtml)(card.source)}`,
        `Владелец: ${(0, text_1.escapeHtml)((0, text_1.formatUserLabel)({
            telegram_id: card.owner_telegram_id,
            username: card.owner_username,
            first_name: card.owner_first_name,
        }))}`,
        `Telegram ID владельца: <code>${card.owner_telegram_id}</code>`,
        `Фото: ${card.photos.length}`,
        `Создана: ${(0, date_1.formatDateTime)(card.created_at)}`,
        "",
        `1 час: ${(0, text_1.formatMoney)(card.price_1h)}`,
        `3 часа: ${(0, text_1.formatMoney)(card.price_3h)}`,
        `Весь день: ${(0, text_1.formatMoney)(card.price_full_day)}`,
        ...(card.description ? ["", `Описание: ${(0, text_1.escapeHtml)(card.description)}`] : []),
    ].join("\n");
}
async function showAdminCardsMenu(ctx) {
    const cards = await (0, cards_service_1.listRecentCardsForAdmin)(15);
    const text = cards.length
        ? "<b>📋 Анкеты</b>\n\nПоследние карточки в базе. Откройте нужную анкету для просмотра и удаления."
        : "<b>📋 Анкеты</b>\n\nВ базе пока нет карточек.";
    await ctx.reply(text, {
        parse_mode: "HTML",
        ...(0, admin_1.adminCardsKeyboard)(cards),
    });
}
async function showAdminOwnerCards(ctx, ownerUserId) {
    const user = await (0, users_service_1.getUserById)(ownerUserId);
    if (!user) {
        await ctx.reply("Пользователь не найден.");
        return;
    }
    const cards = await (0, cards_service_1.listCardsByOwner)(ownerUserId);
    const title = (0, text_1.escapeHtml)((0, text_1.formatUserLabel)(user));
    const text = cards.length
        ? `<b>📋 Анкеты пользователя</b>\n\nВладелец: ${title}\nНайдено анкет: ${cards.length}`
        : `<b>📋 Анкеты пользователя</b>\n\nУ ${title} пока нет анкет.`;
    await ctx.reply(text, {
        parse_mode: "HTML",
        ...(0, admin_1.adminOwnerCardsKeyboard)(cards, ownerUserId),
    });
}
async function showAdminCardProfile(ctx, cardId) {
    const card = await (0, cards_service_1.getCardWithOwner)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    await ctx.reply(buildAdminCardText(card), {
        parse_mode: "HTML",
        ...(0, admin_1.adminCardActionsKeyboard)(card.id, card.owner_user_id),
    });
}
async function showAdminCardDeleteConfirm(ctx, cardId) {
    const card = await (0, cards_service_1.getCardWithOwner)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    await ctx.reply([
        "<b>⚠️ Подтвердите удаление анкеты</b>",
        "",
        `Вы собираетесь удалить анкету <b>${(0, text_1.escapeHtml)(card.name)}</b> (#${card.id}).`,
        "Карточка исчезнет из Honey Bunny, а связанные фото, избранное и бронирования будут удалены каскадно.",
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, admin_1.adminCardDeleteConfirmKeyboard)(card.id, card.owner_user_id),
    });
}
async function showAdminCurators(ctx) {
    const curators = await (0, curators_service_1.listCurators)();
    const text = curators.length
        ? "<b>🧑‍💼 Кураторы</b>\n\nВыберите куратора или действие ниже."
        : "<b>🧑‍💼 Кураторы</b>\n\nПока нет активных кураторов.";
    await ctx.reply(text, {
        parse_mode: "HTML",
        ...(0, admin_1.adminCuratorsKeyboard)(curators),
    });
}
async function showAdminCurator(ctx, curatorId) {
    const curator = await (0, curators_service_1.getCuratorWithUser)(curatorId);
    if (!curator) {
        await ctx.reply("Куратор не найден.");
        return;
    }
    await ctx.reply([
        "<b>🧑‍💼 Карточка куратора</b>",
        "",
        `ID: ${curator.id}`,
        `Имя: ${(0, text_1.escapeHtml)(curator.name)}`,
        `Username: ${curator.telegram_username ? `@${(0, text_1.escapeHtml)(curator.telegram_username)}` : "не указан"}`,
        `Привязка к AWAKE BOT: ${curator.linked_user_id && curator.linked_telegram_id ? `<code>${curator.linked_telegram_id}</code>` : "нет"}`,
        `Описание: ${curator.description ? (0, text_1.escapeHtml)(curator.description) : "не заполнено"}`,
        `Статус: ${curator.is_active ? "✅ Активен" : "⛔ Отключен"}`,
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, admin_1.adminCuratorActionsKeyboard)(curator.id, curator.telegram_username),
    });
}
async function showAdminTransfer(ctx) {
    const transferDetails = await (0, settings_service_1.getTransferDetails)();
    await ctx.reply(["<b>💳 Реквизиты</b>", "", (0, text_1.escapeHtml)(transferDetails), "", "Чтобы изменить данные, нажмите кнопку ниже."].join("\n"), {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "✏️ Изменить реквизиты", callback_data: "admin:transfer:edit" }],
                [{ text: "⬅️ Назад", callback_data: "admin:home" }],
            ],
        },
    });
}
async function showAdminProjectStats(ctx) {
    const stats = await (0, settings_service_1.getProjectStats)();
    await ctx.reply([
        "<b>📈 Статистика проекта</b>",
        "",
        `📊 Профитов: ${stats.totalProfits}`,
        `💸 Сумма профитов: ${(0, text_1.formatMoney)(stats.totalProfitAmount)}`,
        `💳 Процент выплат: ${stats.payoutPercent}%`,
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, admin_1.adminProjectStatsKeyboard)(),
    });
}
async function showAdminLogsMenu(ctx) {
    await ctx.reply("<b>🗂 Логи</b>\n\nВыберите тип журнала.", {
        parse_mode: "HTML",
        ...(0, admin_1.adminLogsKeyboard)(),
    });
}
async function showAdminActionLogs(ctx) {
    const logs = await (0, logging_service_1.getRecentAdminLogs)(10);
    const text = logs.length
        ? logs
            .map((log) => `🕒 ${(0, date_1.formatDateTime)(log.created_at)} | admin #${log.admin_user_id}\n${(0, text_1.escapeHtml)(log.action)}${log.details ? `\n${(0, text_1.escapeHtml)(log.details)}` : ""}`)
            .join("\n\n")
        : "Журнал действий пока пуст.";
    await ctx.reply(`<b>📝 Журнал действий</b>\n\n${text}`, {
        parse_mode: "HTML",
        ...(0, admin_1.adminLogsKeyboard)(),
    });
}
async function showAdminErrorLogs(ctx) {
    const logs = await (0, logging_service_1.getRecentErrorLogs)(10);
    const text = logs.length
        ? logs
            .map((log) => `🕒 ${(0, date_1.formatDateTime)(log.created_at)} | ${(0, text_1.escapeHtml)(log.bot_name)} | ${log.user_telegram_id ?? "n/a"}\n${(0, text_1.escapeHtml)(log.message)}`)
            .join("\n\n")
        : "Журнал ошибок пока пуст.";
    await ctx.reply(`<b>🚨 Журнал ошибок</b>\n\n${text}`, {
        parse_mode: "HTML",
        ...(0, admin_1.adminLogsKeyboard)(),
    });
}
