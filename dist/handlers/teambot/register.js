"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTeambotHandlers = registerTeambotHandlers;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const telegraf_1 = require("telegraf");
const env_1 = require("../../config/env");
const admin_1 = require("../../keyboards/admin");
const teambot_1 = require("../../keyboards/teambot");
const constants_1 = require("../../config/constants");
const bot_clients_service_1 = require("../../services/bot-clients.service");
const card_review_service_1 = require("../../services/card-review.service");
const client_events_service_1 = require("../../services/client-events.service");
const cards_service_1 = require("../../services/cards.service");
const clients_service_1 = require("../../services/clients.service");
const curators_service_1 = require("../../services/curators.service");
const kassa_service_1 = require("../../services/kassa.service");
const logging_service_1 = require("../../services/logging.service");
const payment_requests_service_1 = require("../../services/payment-requests.service");
const profit_reports_service_1 = require("../../services/profit-reports.service");
const project_profits_service_1 = require("../../services/project-profits.service");
const referrals_service_1 = require("../../services/referrals.service");
const settings_service_1 = require("../../services/settings.service");
const users_service_1 = require("../../services/users.service");
const withdraw_requests_service_1 = require("../../services/withdraw-requests.service");
const date_1 = require("../../utils/date");
const text_1 = require("../../utils/text");
const views_1 = require("./views");
async function answerCallback(ctx) {
    if ("callbackQuery" in ctx.update) {
        await ctx.answerCbQuery().catch(() => undefined);
    }
}
async function showWorkerReferralScreen(ctx) {
    const user = ctx.state.user;
    if (!user) {
        await (0, views_1.showWorkerReferralScreen)(ctx);
        return;
    }
    const servicebotUsername = await (0, settings_service_1.getServicebotUsername)();
    const referralLink = (0, referrals_service_1.buildServicebotReferralLink)(user.id, servicebotUsername);
    const [friendCode, stats, friendStats] = await Promise.all([
        (0, users_service_1.ensureUserFriendCode)(user.id),
        (0, clients_service_1.getWorkerClientsStats)(user.id),
        (0, client_events_service_1.getWorkerFriendCodeStats)(user.id),
    ]);
    await ctx.reply([
        "<b>🔗 Моя рефка</b>",
        "",
        "Персональная ссылка для Honey Bunny:",
        referralLink ? `<code>${(0, text_1.escapeHtml)(referralLink)}</code>` : "Ссылка появится после запуска servicebot с публичным username.",
        "",
        "<b>Friend code</b>",
        friendCode ? `<code>${(0, text_1.escapeHtml)(friendCode)}</code>` : "Код ещё не готов.",
        "",
        `🐘 Закреплено клиентов: ${stats.total}`,
        `📱 Запусков Mini App: ${friendStats.appOpens}`,
        `🔎 Открытий карточек: ${friendStats.cardOpens}`,
        `💳 Стартов пополнения: ${friendStats.topupStarts}`,
        `🧾 Отправлено чеков: ${friendStats.receiptsSent}`,
        `📅 Бронирований: ${friendStats.bookings}`,
        "",
        "Переходы, карточки, пополнения и бронирования будут приходить в личные сообщения AWAKE BOT по включённым сигналам.",
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, teambot_1.teambotBackKeyboard)(),
    });
}
async function showAdminFriendCodeStats(ctx) {
    const rows = await (0, client_events_service_1.listFriendCodeStats)();
    const lines = ["<b>🧪 Friend code статистика</b>", ""];
    if (!rows.length) {
        lines.push("Пока нет воркеров с активными friend code.");
    }
    else {
        for (const row of rows) {
            const title = row.username ? `@${(0, text_1.escapeHtml)(row.username)}` : (0, text_1.escapeHtml)(row.first_name ?? `ID ${row.telegram_id}`);
            lines.push(`<b>${title}</b>`, `Код: <code>${(0, text_1.escapeHtml)(row.friend_code ?? "—")}</code>`, `Клиентов: ${row.linkedClients} • Mini App: ${row.appOpens}`, `Карточки: ${row.cardOpens} • Пополнения: ${row.topupStarts}`, `Чеки: ${row.receiptsSent} • Бронирования: ${row.bookings}`, "");
        }
    }
    await ctx.reply(lines.join("\n").trim(), {
        parse_mode: "HTML",
        ...(0, admin_1.adminHomeKeyboard)(),
    });
}
function isAdmin(ctx) {
    return Boolean(ctx.state.isAdmin && ctx.state.user);
}
function isTeamMember(ctx) {
    const user = ctx.state.user;
    if (!user) {
        return false;
    }
    return user.role === "worker" || user.role === "admin" || user.role === "curator" || user.has_worker_access === 1;
}
async function registerCurrentTeambotUser(ctx) {
    if (!ctx.from) {
        return null;
    }
    const user = await (0, users_service_1.registerTeambotUser)({
        telegramId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
    });
    ctx.state.user = user ?? undefined;
    if (user) {
        await (0, curators_service_1.syncCuratorsForUser)(user.id, ctx.from.username);
        if (user.role === "worker" || user.role === "admin" || user.role === "curator") {
            await (0, users_service_1.ensureUserFriendCode)(user.id);
        }
    }
    return user;
}
async function notifyClientAboutPaymentDecision(telegramId, text) {
    try {
        await (0, bot_clients_service_1.getServicebotTelegram)().sendMessage(telegramId, text, { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
async function notifyWorkerAboutWithdrawDecision(request, decision) {
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(request.telegram_id, [
            decision === "paid" ? "<b>💸 Заявка на вывод выплачена</b>" : "<b>❌ Заявка на вывод отклонена</b>",
            `Заявка: #${request.id}`,
            `Сумма: ${(0, text_1.formatMoney)(request.amount)}`,
            decision === "paid"
                ? "Админ отметил заявку как выплаченную."
                : "Сумма возвращена в доступный баланс AWAKE BOT. Проверьте реквизиты и создайте заявку заново.",
        ].join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
async function notifyWorkerAboutProfitReportDecision(telegramId, decision, amount, source) {
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(telegramId, [
            decision === "approved" ? "<b>✅ Профит подтверждён</b>" : "<b>❌ Профит отклонён</b>",
            `Сумма: ${(0, text_1.formatMoney)(amount)}`,
            decision === "approved"
                ? `Профит добавлен в баланс AWAKE BOT.\nИсточник: ${source === "honeybunny" ? "HonneyBunny" : "Прямой перевод"}`
                : "Заявка не была зачтена в кассу проекта.",
        ].join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
async function notifyCuratorAboutRequest(request) {
    if (!request.curator_linked_telegram_id) {
        return false;
    }
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(request.curator_linked_telegram_id, [
            "<b>🧑‍💼 Новая заявка на кураторство</b>",
            "",
            `Воркер: ${(0, text_1.escapeHtml)((0, text_1.formatUserLabel)({
                telegram_id: request.worker_telegram_id,
                username: request.worker_username,
                first_name: request.worker_first_name,
            }))}`,
            `Telegram ID: <code>${request.worker_telegram_id}</code>`,
            `Куратор: <b>${(0, text_1.escapeHtml)(request.curator_name)}</b>${request.curator_telegram_username ? ` (@${(0, text_1.escapeHtml)(request.curator_telegram_username)})` : ""}`,
            "",
            "Примите или отклоните заявку кнопками ниже.",
        ].join("\n"), {
            parse_mode: "HTML",
            ...(0, teambot_1.curatorRequestDecisionKeyboard)(request.id),
        });
        return true;
    }
    catch {
        return false;
    }
}
async function notifyWorkerAboutCuratorDecision(request, decision) {
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(request.worker_telegram_id, [
            decision === "accepted" ? "<b>✅ Заявка на куратора принята</b>" : "<b>❌ Заявка на куратора отклонена</b>",
            "",
            `Куратор: <b>${(0, text_1.escapeHtml)(request.curator_name)}</b>${request.curator_telegram_username ? ` (@${(0, text_1.escapeHtml)(request.curator_telegram_username)})` : ""}`,
            decision === "accepted"
                ? "Куратор теперь закреплён за вами и будет отображаться в профиле."
                : "Можно выбрать другого куратора из актуального списка.",
        ].join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
function buildTopWorkersSection(title, workers) {
    const lines = [`<b>${title}</b>`];
    if (!workers.length) {
        lines.push("Данных пока нет.");
        return lines.join("\n");
    }
    for (const [index, worker] of workers.entries()) {
        const label = (0, text_1.escapeHtml)((0, text_1.formatUserLabel)(worker));
        lines.push(`${index + 1}. ${label} — ${(0, text_1.formatMoney)(worker.totalAmount)} • ${worker.totalCount} шт.`);
    }
    return lines.join("\n");
}
async function buildKassaText() {
    const [today, week, month, allTime, dayTop, weekTop, monthTop, allTop, projectStats] = await Promise.all([
        (0, kassa_service_1.getKassaSummary)("day"),
        (0, kassa_service_1.getKassaSummary)("week"),
        (0, kassa_service_1.getKassaSummary)("month"),
        (0, kassa_service_1.getKassaSummary)("all"),
        (0, kassa_service_1.getTopWorkers)("day"),
        (0, kassa_service_1.getTopWorkers)("week"),
        (0, kassa_service_1.getTopWorkers)("month"),
        (0, kassa_service_1.getTopWorkers)("all"),
        (0, settings_service_1.getProjectStats)(),
    ]);
    return [
        "<b>💸 Касса проекта</b>",
        `🕒 Обновлено: ${(0, date_1.formatDateTime)(new Date())}`,
        "",
        "<b>Сводка</b>",
        `Сегодня: ${today.totalCount} проф. • ${(0, text_1.formatMoney)(today.totalAmount)}`,
        `Неделя: ${week.totalCount} проф. • ${(0, text_1.formatMoney)(week.totalAmount)}`,
        `Месяц: ${month.totalCount} проф. • ${(0, text_1.formatMoney)(month.totalAmount)}`,
        `Все время: ${allTime.totalCount} проф. • ${(0, text_1.formatMoney)(allTime.totalAmount)}`,
        "",
        "<b>Проект</b>",
        `Подтверждено профитов: ${projectStats.totalProfits}`,
        `Сумма профитов: ${(0, text_1.formatMoney)(projectStats.totalProfitAmount)}`,
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
async function notifyWorkerChatAboutProfitFormatted(request) {
    const workerChatId = await (0, settings_service_1.getWorkerChatId)();
    if (!workerChatId) {
        return;
    }
    const worker = request.worker_user_id ? await (0, users_service_1.getUserById)(request.worker_user_id) : null;
    const curator = request.curator_user_id ? await (0, users_service_1.getUserById)(request.curator_user_id) : null;
    const workerLabel = worker ? (0, text_1.escapeHtml)((0, text_1.formatUserLabel)(worker)) : "не назначен";
    const lines = [
        "<b>🔥 Payments</b>",
        `🐺 Профит у ${workerLabel}`,
        "├ Сервис: 🤖 Honey Bunny",
        `├ Сумма оплаты: ${(0, text_1.formatMoney)(request.amount)}`,
        `├ Доля воркера: ${(0, text_1.formatMoney)(request.worker_share_amount)}`,
        curator ? `└ Доля куратора (${(0, text_1.escapeHtml)((0, text_1.formatUserLabel)(curator))}): ${(0, text_1.formatMoney)(request.curator_share_amount)}` : "└ Доля куратора: 0 RUB",
    ];
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(workerChatId, lines.join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
async function notifyWorkerChatAboutProfit(request) {
    const workerChatId = await (0, settings_service_1.getWorkerChatId)();
    if (!workerChatId) {
        return;
    }
    const worker = request.worker_user_id ? await (0, users_service_1.getUserById)(request.worker_user_id) : null;
    const clientLabel = `<code>${request.telegram_id}</code>${request.username ? ` (@${(0, text_1.escapeHtml)(request.username)})` : ""}`;
    const workerLabel = worker ? (0, text_1.escapeHtml)((0, text_1.formatUserLabel)(worker)) : "не назначен";
    const lines = [
        "<b>💸 Новый профит</b>",
        `Сумма: ${(0, text_1.formatMoney)(request.amount)}`,
        `Клиент: ${clientLabel}`,
        `Воркер: ${workerLabel}`,
        `Заявка: #${request.id}`,
        `Время: ${(0, date_1.formatDateTime)(new Date())}`,
    ];
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(workerChatId, lines.join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
function registerTeambotHandlers(bot) {
    bot.start(async (ctx) => {
        if (!ctx.from) {
            return;
        }
        await registerCurrentTeambotUser(ctx);
        await (0, views_1.showTeambotHome)(ctx);
    });
    bot.command("admin", async (ctx) => {
        if (!isAdmin(ctx)) {
            await ctx.reply("Команда доступна только администраторам.");
            return;
        }
        await (0, views_1.showAdminHome)(ctx);
    });
    bot.command("kassa", async (ctx) => {
        if (!isTeamMember(ctx)) {
            await ctx.reply("Команда доступна только участникам команды.");
            return;
        }
        if (ctx.chat && ctx.chat.type !== "private") {
            await (0, settings_service_1.setWorkerChatId)(ctx.chat.id);
        }
        await (0, settings_service_1.recalculateProjectStats)();
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
        await (0, views_1.showCuratorsChatList)(ctx);
    });
    bot.hears(/мануал/i, async (ctx) => {
        if (!ctx.chat || ctx.chat.type === "private") {
            return;
        }
        await ctx.reply("📚 Канал с мануалами: https://t.me/+oIbWAAT7mIM3YzEx");
    });
    bot.hears(constants_1.TEAMBOT_MAIN_MENU[0], views_1.showTeamWorkMenu);
    bot.hears(constants_1.TEAMBOT_MAIN_MENU[1], views_1.showWithdrawRequestsScreen);
    bot.hears(constants_1.TEAMBOT_MAIN_MENU[2], views_1.showTransferScreen);
    bot.hears(constants_1.TEAMBOT_MAIN_MENU[3], views_1.showProfileScreen);
    bot.hears(constants_1.TEAMBOT_MAIN_MENU[4], views_1.showCuratorsScreen);
    bot.hears(constants_1.TEAMBOT_MAIN_MENU[5], views_1.showProjectInfoScreen);
    bot.hears(teambot_1.TEAM_WORK_BUTTONS.createCard, async (ctx) => ctx.scene.enter("team-create-card"));
    bot.hears(teambot_1.TEAM_WORK_BUTTONS.referral, showWorkerReferralScreen);
    bot.hears(teambot_1.TEAM_WORK_BUTTONS.withdraw, views_1.showWithdrawRequestsScreen);
    bot.hears(teambot_1.TEAM_WORK_BUTTONS.settings, views_1.showTeamWorkSettings);
    bot.hears(teambot_1.TEAM_WORK_BUTTONS.back, views_1.showTeambotHome);
    bot.hears(constants_1.BACK_BUTTON, views_1.showTeambotHome);
    bot.action("team:membership:retry", async (ctx) => {
        await answerCallback(ctx);
        if (ctx.from) {
            await registerCurrentTeambotUser(ctx);
        }
        await (0, views_1.showTeambotHome)(ctx);
    });
    bot.action("team:menu:work", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showTeamWorkMenu)(ctx);
    });
    bot.action("team:menu:withdraw", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showWithdrawRequestsScreen)(ctx);
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
        await (0, views_1.showWithdrawRequestsScreen)(ctx);
    });
    bot.action("team:withdraw:back", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showTeambotHome)(ctx);
    });
    bot.action(/^team:signals:toggle:(referrals|navigation|search|payments|bookings)$/, async (ctx) => {
        if (!ctx.state.user) {
            await ctx.answerCbQuery("Сначала выполните /start", { show_alert: true }).catch(() => undefined);
            return;
        }
        const category = ctx.match[1];
        const nextEnabled = !(0, users_service_1.isWorkerSignalEnabled)(ctx.state.user, category);
        const updatedUser = await (0, users_service_1.updateWorkerSignalSetting)(ctx.state.user.id, category, nextEnabled);
        if (updatedUser) {
            ctx.state.user = updatedUser;
        }
        await ctx.answerCbQuery(nextEnabled ? "Сигнал включён" : "Сигнал отключён").catch(() => undefined);
        await (0, views_1.showTeamWorkSettings)(ctx);
    });
    bot.action("team:settings:back", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showTeamWorkMenu)(ctx);
    });
    bot.action("team:menu:transfer", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showTransferScreen)(ctx);
    });
    bot.action("team:menu:profile", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showProfileScreen)(ctx);
    });
    bot.action("team:menu:curators", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showCuratorsScreen)(ctx);
    });
    bot.action("team:menu:project", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showProjectInfoScreen)(ctx);
    });
    bot.action("team:curators:back", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showTeambotHome)(ctx);
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
        const result = await (0, curators_service_1.createCuratorRequest)(ctx.state.user.id, curatorId);
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
        await ctx.reply(delivered
            ? "📨 Заявка отправлена куратору. Ответ придёт в AWAKE BOT."
            : "📨 Заявка создана, но уведомление куратору пока не доставлено. Он увидит её после следующего входа в AWAKE BOT.");
    });
    bot.action(/^team:curator-request:(\d+):(accept|reject)$/, async (ctx) => {
        if (!ctx.state.user) {
            await ctx.answerCbQuery("Сначала выполните /start", { show_alert: true }).catch(() => undefined);
            return;
        }
        const requestId = Number(ctx.match[1]);
        const decision = ctx.match[2];
        const result = decision === "accept"
            ? await (0, curators_service_1.acceptCuratorRequest)(requestId, ctx.state.user.id)
            : await (0, curators_service_1.rejectCuratorRequest)(requestId, ctx.state.user.id);
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
        await ctx.reply(decision === "accept"
            ? "✅ Заявка принята. Воркер закреплён за вами как за куратором."
            : "❌ Заявка на кураторство отклонена.");
    });
    bot.action("team:kassa:refresh", async (ctx) => {
        await answerCallback(ctx);
        if (!isTeamMember(ctx)) {
            return;
        }
        await (0, settings_service_1.recalculateProjectStats)();
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
        await (0, views_1.showAdminHome)(ctx);
    });
    bot.action("admin:stats", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminStats)(ctx);
    });
    bot.action("admin:users", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminUsersMenu)(ctx);
    });
    bot.action("admin:cards", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminCardsMenu)(ctx);
    });
    bot.action("admin:friend-codes", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await showAdminFriendCodeStats(ctx);
    });
    bot.action("admin:db:export", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        try {
            await promises_1.default.access(env_1.config.databasePath);
            await ctx.replyWithDocument(telegraf_1.Input.fromLocalFile(env_1.config.databasePath, node_path_1.default.basename(env_1.config.databasePath)), {
                caption: "🗄 Резервная копия базы данных AWAKE BOT",
            });
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "export_database", env_1.config.databasePath);
        }
        catch (error) {
            await ctx.reply(`Не удалось выгрузить БД: ${String(error)}`);
        }
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
        await (0, views_1.showRecentUsers)(ctx);
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
        await (0, views_1.showAdminUserProfile)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^admin:cards:owner:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminOwnerCards)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^admin:card:(\d+):view$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminCardProfile)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^admin:card:(\d+):delete:confirm$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminCardDeleteConfirm)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^admin:card:(\d+):delete:apply$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx) || !ctx.state.user) {
            return;
        }
        const cardId = Number(ctx.match[1]);
        const card = await (0, cards_service_1.deleteCard)(cardId);
        if (!card) {
            await ctx.reply("Анкета не найдена или уже была удалена.");
            return;
        }
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "delete_card", `card:${cardId}; owner:${card.owner_user_id}; name:${card.name}`);
        await ctx.reply(`Анкета #${cardId} удалена. Карточка больше не будет видна в Honey Bunny.`);
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
        await (0, views_1.showAdminOwnerCards)(ctx, card.owner_user_id);
    });
    bot.action(/^admin:user:(\d+):role$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        const userId = Number(ctx.match[1]);
        await ctx.reply("Выберите новую роль.", (0, admin_1.adminRoleKeyboard)(userId));
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
        const role = ctx.match[2];
        const updatedUser = await (0, users_service_1.setUserRole)(userId, role);
        if (updatedUser) {
            await (0, curators_service_1.syncCuratorsForUser)(updatedUser.id, updatedUser.username);
        }
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "set_user_role", `user:${userId}; role:${role}`);
        }
        await (0, views_1.showAdminUserProfile)(ctx, userId);
    });
    bot.action(/^admin:user:(\d+):(make-curator|make-worker)$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        const userId = Number(ctx.match[1]);
        const role = ctx.match[2] === "make-curator" ? "curator" : "worker";
        const updatedUser = await (0, users_service_1.setUserRole)(userId, role);
        if (updatedUser) {
            await (0, curators_service_1.syncCuratorsForUser)(updatedUser.id, updatedUser.username);
        }
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "quick_set_user_role", `user:${userId}; role:${role}`);
        }
        await (0, views_1.showAdminUserProfile)(ctx, userId);
    });
    bot.action(/^admin:user:(\d+):block$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        const userId = Number(ctx.match[1]);
        const user = await (0, users_service_1.getUserById)(userId);
        if (!user) {
            await ctx.reply("Пользователь не найден.");
            return;
        }
        await (0, users_service_1.setUserBlocked)(userId, user.is_blocked === 0);
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "toggle_block_user", `user:${userId}; blocked:${user.is_blocked === 0}`);
        }
        await (0, views_1.showAdminUserProfile)(ctx, userId);
    });
    bot.action(/^admin:user:(\d+):assign-curator$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        const user = await (0, users_service_1.getUserById)(Number(ctx.match[1]));
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
        const user = await (0, users_service_1.getUserById)(Number(ctx.match[1]));
        if (!user) {
            await ctx.reply("Пользователь не найден.");
            return;
        }
        await (0, curators_service_1.unassignCuratorFromUser)(user.id);
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "unassign_curator", `user:${user.id}`);
        }
        await (0, views_1.showAdminUserProfile)(ctx, user.id);
    });
    bot.action("admin:curators", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminCurators)(ctx);
    });
    bot.action(/^admin:curator:view:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminCurator)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^admin:curator:delete:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        const curatorId = Number(ctx.match[1]);
        await (0, curators_service_1.deleteCurator)(curatorId);
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "delete_curator", `curator:${curatorId}`);
        }
        await (0, views_1.showAdminCurators)(ctx);
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
        await (0, views_1.showAdminTransfer)(ctx);
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
        await (0, views_1.showAdminProjectStats)(ctx);
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
        const stats = await (0, settings_service_1.recalculateProjectStats)();
        if (ctx.state.user) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "recalculate_project_stats", JSON.stringify(stats));
        }
        await (0, views_1.showAdminProjectStats)(ctx);
    });
    bot.action(/^admin:payment-request:(\d+):(approve|reject)$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx) || !ctx.state.user) {
            return;
        }
        const requestId = Number(ctx.match[1]);
        const decision = ctx.match[2];
        const result = decision === "approve"
            ? await (0, payment_requests_service_1.approvePaymentRequest)(requestId, ctx.state.user.id)
            : await (0, payment_requests_service_1.rejectPaymentRequest)(requestId, ctx.state.user.id);
        if (result.status === "missing") {
            await ctx.reply("Заявка на оплату не найдена.");
            return;
        }
        if (result.status === "processed") {
            await ctx.reply(`Заявка #${requestId} уже была обработана ранее.`);
            return;
        }
        if (decision === "approve" && result.request) {
            await (0, settings_service_1.recalculateProjectStats)();
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "approve_payment_request", `request:${requestId}; amount:${result.request.amount}`);
            await notifyClientAboutPaymentDecision(result.request.telegram_id, [
                "<b>✅ Пополнение подтверждено</b>",
                `На баланс зачислено ${result.request.amount.toFixed(2)} RUB.`,
                "Проверьте профиль в Honey Bunny.",
            ].join("\n"));
            await (0, project_profits_service_1.notifyWorkerChatAboutProfit)(result.request);
            await ctx.reply(`Заявка #${requestId} принята. Баланс клиента пополнен.`);
        }
        if (decision === "reject" && result.request) {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "reject_payment_request", `request:${requestId}; amount:${result.request.amount}`);
            await notifyClientAboutPaymentDecision(result.request.telegram_id, [
                "<b>❌ Пополнение отклонено</b>",
                "Администратор не подтвердил перевод.",
                "Проверьте чек и отправьте подтверждение ещё раз.",
            ].join("\n"));
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
        const decision = ctx.match[2];
        const result = decision === "approve" || decision === "paid"
            ? await (0, withdraw_requests_service_1.markWithdrawRequestPaid)(requestId, ctx.state.user.id)
            : await (0, withdraw_requests_service_1.rejectWithdrawRequest)(requestId, ctx.state.user.id);
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
        }
        else {
            await notifyWorkerAboutWithdrawDecision(result.request, "paid");
        }
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, decision === "paid" || decision === "approve"
            ? "mark_withdraw_request_paid"
            : "reject_withdraw_request", `request:${requestId}; amount:${result.request.amount}`);
        await ctx.reply(decision === "paid" || decision === "approve"
            ? `Заявка на вывод #${requestId} отмечена как выплаченная.`
            : `Заявка на вывод #${requestId} отклонена, сумма возвращена воркеру.`);
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
        const source = ctx.match[3];
        const result = action === "reject"
            ? await (0, profit_reports_service_1.rejectProfitReport)(requestId, ctx.state.user.id)
            : await (0, profit_reports_service_1.approveProfitReport)(requestId, ctx.state.user.id, source ?? "direct_transfer");
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
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "reject_profit_report", `request:${requestId}; amount:${result.request.amount}`);
            await ctx.reply(`Заявка о профите #${requestId} отклонена.`);
            await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
            return;
        }
        if ("paymentRequest" in result && result.paymentRequest) {
            await (0, settings_service_1.recalculateProjectStats)();
            await (0, project_profits_service_1.notifyWorkerChatAboutProfit)(result.paymentRequest);
        }
        await notifyWorkerAboutProfitReportDecision(result.request.telegram_id, "approved", result.request.amount, source);
        await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "approve_profit_report", `request:${requestId}; amount:${result.request.amount}; source:${source}`);
        await ctx.reply(`Заявка о профите #${requestId} подтверждена, добавлена в баланс AWAKE BOT и зачтена как ${source === "honeybunny" ? "HonneyBunny" : "прямой перевод"}.`);
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => undefined);
    });
    bot.action(/^admin:card-review:(\d+):(approve|reject)$/, async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx) || !ctx.state.user) {
            return;
        }
        const cardId = Number(ctx.match[1]);
        const decision = ctx.match[2];
        const result = decision === "approve" ? await (0, cards_service_1.approveCard)(cardId, ctx.state.user.id) : await (0, cards_service_1.rejectCard)(cardId, ctx.state.user.id);
        if (result.status === "missing") {
            await ctx.reply("Анкета не найдена.");
            return;
        }
        if (result.status === "processed") {
            await ctx.reply(`Анкета #${cardId} уже была обработана ранее.`);
            return;
        }
        if (result.card) {
            await (0, card_review_service_1.notifyWorkerAboutCardReviewDecision)(result.card, decision === "approve" ? "approved" : "rejected");
        }
        if (decision === "approve") {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "approve_card_review", `card:${cardId}`);
            await ctx.reply(`Анкета #${cardId} одобрена и опубликована в Honey Bunny.`);
        }
        else {
            await (0, logging_service_1.logAdminAction)(ctx.state.user.id, "reject_card_review", `card:${cardId}`);
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
        await (0, views_1.showAdminLogsMenu)(ctx);
    });
    bot.action("admin:logs:actions", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminActionLogs)(ctx);
    });
    bot.action("admin:logs:errors", async (ctx) => {
        await answerCallback(ctx);
        if (!isAdmin(ctx)) {
            return;
        }
        await (0, views_1.showAdminErrorLogs)(ctx);
    });
    bot.action("admin:close", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showTeambotHome)(ctx);
    });
    bot.action("common:close", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showTeambotHome)(ctx);
    });
}
