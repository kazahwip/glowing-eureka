"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerServicebotHandlers = registerServicebotHandlers;
const constants_1 = require("../../config/constants");
const cards_service_1 = require("../../services/cards.service");
const clients_service_1 = require("../../services/clients.service");
const favorites_service_1 = require("../../services/favorites.service");
const servicebot_1 = require("../../keyboards/servicebot");
const servicebot_audit_service_1 = require("../../services/servicebot-audit.service");
const referrals_service_1 = require("../../services/referrals.service");
const showcase_service_1 = require("../../services/showcase.service");
const users_service_1 = require("../../services/users.service");
const text_1 = require("../../utils/text");
const webapp_1 = require("../../utils/webapp");
const views_1 = require("./views");
async function answerCallback(ctx) {
    if ("callbackQuery" in ctx.update) {
        await ctx.answerCbQuery().catch(() => undefined);
    }
}
function hasWorkerAccess(ctx) {
    const user = ctx.state.user;
    if (!user) {
        return false;
    }
    return user.has_worker_access === 1 || ["worker", "admin", "curator"].includes(user.role);
}
function getStartPayload(ctx) {
    if (!ctx.message || !("text" in ctx.message)) {
        return null;
    }
    const [, ...parts] = ctx.message.text.trim().split(/\s+/);
    return parts.join(" ").trim() || null;
}
function getCategoryLabel(category) {
    return category === "pepper" ? "Девушки с перчиком" : "Девушки";
}
const INLINE_START_TARGETS = {
    ic: "card",
    ib: "booking",
    is: "schedule",
    ir: "reviews",
    ip: "policy",
};
function parseInlineStartPayload(payload) {
    const match = payload?.trim().match(/^(ic|ib|is|ir|ip)_(\d+)_(\d+)$/);
    if (!match) {
        return null;
    }
    return {
        target: INLINE_START_TARGETS[match[1]],
        workerUserId: Number(match[2]),
        cardId: Number(match[3]),
    };
}
let servicebotUsernameCache = null;
async function getServicebotUsername(ctx) {
    if (servicebotUsernameCache) {
        return servicebotUsernameCache;
    }
    const me = await ctx.telegram.getMe();
    servicebotUsernameCache = me.username ?? null;
    return servicebotUsernameCache;
}
async function trackRefAction(ctx, category, action, details) {
    const user = ctx.state.user;
    if (!user?.referred_by_user_id || !ctx.from) {
        return;
    }
    await (0, clients_service_1.linkClientToWorker)(user.referred_by_user_id, ctx.from.id, ctx.from.username);
    await (0, referrals_service_1.notifyWorkerAboutClientAction)(user.referred_by_user_id, {
        clientTelegramId: ctx.from.id,
        clientUsername: ctx.from.username,
        category,
        action,
        details,
    });
}
async function trackAuditAction(ctx, action, details) {
    if (!ctx.from) {
        return;
    }
    await (0, servicebot_audit_service_1.sendServicebotAuditEvent)({
        telegramId: ctx.from.id,
        username: ctx.from.username,
        action,
        details,
    });
}
function getInlinePhotoPayload(card) {
    const reference = card.photos[0]?.telegram_file_id;
    if (!reference) {
        return null;
    }
    if (reference.startsWith("local:")) {
        const photoUrl = (0, webapp_1.buildMediaUrl)(reference);
        return photoUrl ? { photo_url: photoUrl, thumbnail_url: photoUrl } : null;
    }
    return { photo_file_id: reference };
}
function buildInlineModelCardCaption(card) {
    return [
        `💘 <b>${(0, text_1.escapeHtml)(card.name)}</b> (${card.age}) (${(0, text_1.escapeHtml)(card.city)})`,
        "",
        "✅ Верифицированная модель",
        "",
        "<b>🔐 УСЛОВИЯ:</b>",
        "• Депозит для брони: 1 000 ₽.",
        "• В подарок клиент получает приватный канал модели.",
        "",
        "<b>🏆 СТОИМОСТЬ ВСТРЕЧИ:</b>",
        `⏰ 1 час: ${(0, text_1.formatMoney)(card.price_1h)}`,
        `🏙 3 часа: ${(0, text_1.formatMoney)(card.price_3h)}`,
        `🌃 Смена: ${(0, text_1.formatMoney)(card.price_full_day)}`,
        "",
        "✅ Для оформления нажмите «Забронировать»",
    ].join("\n");
}
async function handleStartReferral(ctx) {
    const user = ctx.state.user;
    const payload = (0, referrals_service_1.parseReferralPayload)(getStartPayload(ctx));
    if (!user || !payload || !ctx.from) {
        return;
    }
    const previousReferrerId = user.referred_by_user_id;
    const updatedUser = await (0, referrals_service_1.assignReferralOwner)(user, payload);
    ctx.state.user = updatedUser ?? undefined;
    if (!updatedUser?.referred_by_user_id || updatedUser.referred_by_user_id !== payload) {
        return;
    }
    const action = previousReferrerId === payload ? "Мамонт повторно открыл реферальную ссылку" : "Новый мамонт перешёл по реферальной ссылке";
    await (0, referrals_service_1.notifyWorkerAboutClientAction)(payload, {
        clientTelegramId: ctx.from.id,
        clientUsername: ctx.from.username,
        category: "referrals",
        action,
    });
}
async function handleInlineStart(ctx) {
    const user = ctx.state.user;
    const payload = parseInlineStartPayload(getStartPayload(ctx));
    if (!user || !payload || !ctx.from) {
        return false;
    }
    const card = await (0, cards_service_1.getCardById)(payload.cardId);
    if (!card) {
        await (0, referrals_service_1.notifyWorkerAboutClientAction)(payload.workerUserId, {
            clientTelegramId: ctx.from.id,
            clientUsername: ctx.from.username,
            category: "referrals",
            action: "Клиент открыл inline-карточку, но анкета не найдена",
            details: `ID анкеты: ${payload.cardId}`,
        });
        await ctx.reply("Анкета не найдена.");
        return true;
    }
    const worker = await (0, users_service_1.getUserById)(payload.workerUserId);
    if (!worker || (worker.has_worker_access !== 1 && !["worker", "admin", "curator"].includes(worker.role))) {
        await ctx.reply("Ссылка на анкету недоступна.");
        return true;
    }
    ctx.session.inlineWorkerUserId = payload.workerUserId;
    const previousReferrerId = user.referred_by_user_id;
    const updatedUser = await (0, referrals_service_1.assignReferralOwner)(user, payload.workerUserId);
    ctx.state.user = updatedUser ?? undefined;
    await (0, clients_service_1.linkClientToWorker)((updatedUser?.referred_by_user_id ?? previousReferrerId ?? payload.workerUserId), ctx.from.id, ctx.from.username);
    const targetLabels = {
        card: "открыл анкету",
        booking: "перешел к бронированию",
        schedule: "открыл расписание",
        reviews: "открыл отзывы",
        policy: "открыл политику безопасности",
    };
    await (0, referrals_service_1.notifyWorkerAboutClientAction)(payload.workerUserId, {
        clientTelegramId: ctx.from.id,
        clientUsername: ctx.from.username,
        category: payload.target === "booking" ? "bookings" : "referrals",
        action: `Клиент ${targetLabels[payload.target]} из inline-карточки`,
        details: `${card.name}, ${card.age} | ${card.city} | ID ${card.id}`,
    });
    await trackAuditAction(ctx, "opened_inline_card_link", `card_id=${card.id}; worker_user_id=${payload.workerUserId}; target=${payload.target}`);
    if (payload.target === "booking") {
        await (0, views_1.showPrebookingScreen)(ctx, card.id);
    }
    else if (payload.target === "schedule") {
        await (0, views_1.showModelSchedule)(ctx, card.id, "today");
    }
    else if (payload.target === "reviews") {
        await (0, views_1.showModelReviews)(ctx, card.id, 1);
    }
    else if (payload.target === "policy") {
        await (0, views_1.showModelSafetyPolicy)(ctx, card.id);
    }
    else {
        await (0, views_1.showCardDetails)(ctx, card.id);
    }
    return true;
}
function registerServicebotHandlers(bot) {
    bot.on("inline_query", async (ctx) => {
        await (0, servicebot_audit_service_1.sendServicebotAuditEvent)({
            telegramId: ctx.inlineQuery.from.id,
            username: ctx.inlineQuery.from.username,
            action: "inline_query",
            details: ctx.inlineQuery.query.trim() || "empty",
        });
        const worker = await (0, users_service_1.getUserByTelegramId)(ctx.inlineQuery.from.id);
        if (!worker || (worker.has_worker_access !== 1 && !["worker", "admin", "curator"].includes(worker.role))) {
            await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
            return;
        }
        const botUsername = await getServicebotUsername(ctx);
        if (!botUsername) {
            await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
            return;
        }
        const cards = await (0, cards_service_1.listInlineShareCards)(ctx.inlineQuery.query);
        await ctx.answerInlineQuery(cards.map((card) => {
            const keyboard = (0, servicebot_1.inlineSharedCardKeyboard)(botUsername, worker.id, card.id);
            const photoPayload = getInlinePhotoPayload(card);
            return photoPayload
                ? {
                    type: "photo",
                    id: `card:${card.id}:worker:${worker.id}`,
                    title: `${card.name}, ${card.age}`,
                    description: `${card.city} · ID ${card.id}`,
                    caption: buildInlineModelCardCaption(card),
                    parse_mode: "HTML",
                    reply_markup: keyboard.reply_markup,
                    ...photoPayload,
                }
                : {
                    type: "article",
                    id: `card:${card.id}:worker:${worker.id}`,
                    title: `${card.name}, ${card.age}`,
                    description: `${card.city} · ID ${card.id}`,
                    input_message_content: {
                        message_text: (0, showcase_service_1.buildModelCardText)(card),
                        parse_mode: "HTML",
                    },
                    reply_markup: keyboard.reply_markup,
                };
        }), { cache_time: 0, is_personal: true });
    });
    bot.start(async (ctx) => {
        if (!ctx.from) {
            return;
        }
        const user = await (0, users_service_1.registerServicebotUser)({
            telegramId: ctx.from.id,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
        });
        ctx.state.user = user ?? undefined;
        if (await handleInlineStart(ctx)) {
            return;
        }
        await handleStartReferral(ctx);
        await trackAuditAction(ctx, "/start");
        await (0, views_1.showServicebotHome)(ctx);
    });
    bot.command("awake", async (ctx) => {
        if (!ctx.from) {
            return;
        }
        await (0, users_service_1.grantWorkerAccess)(ctx.from.id);
        ctx.state.user = await (0, users_service_1.registerServicebotUser)({
            telegramId: ctx.from.id,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
        });
        await ctx.reply("Доступ воркера активирован. Используйте /worker.");
    });
    bot.command("worker", async (ctx) => {
        if (!hasWorkerAccess(ctx)) {
            await ctx.reply("Воркер-панель пока недоступна. Используйте /awake или зарегистрируйтесь в AWAKE BOT.");
            return;
        }
        await (0, views_1.showWorkerHome)(ctx);
    });
    bot.hears(constants_1.SERVICEBOT_MAIN_MENU[0], views_1.showCatalogScreen);
    bot.hears(constants_1.SERVICEBOT_MAIN_MENU[1], views_1.showClubScreen);
    bot.hears(constants_1.SERVICEBOT_MAIN_MENU[2], async (ctx) => (0, views_1.showReviewsPage)(ctx, 1));
    bot.hears(constants_1.SERVICEBOT_MAIN_MENU[3], views_1.showServiceProfile);
    bot.hears(constants_1.SERVICEBOT_MAIN_MENU[4], views_1.showCategorySelection);
    bot.hears(constants_1.SERVICEBOT_MAIN_MENU[5], views_1.showSupportScreen);
    bot.hears(constants_1.SERVICEBOT_MAIN_MENU[6], views_1.showInfoRoot);
    bot.hears(constants_1.WORKER_PANEL_MENU[0], async (ctx) => {
        if (!hasWorkerAccess(ctx)) {
            await ctx.reply("Воркер-панель недоступна.");
            return;
        }
        await ctx.scene.enter("worker-broadcast");
    });
    bot.hears(constants_1.WORKER_PANEL_MENU[1], async (ctx) => {
        if (!hasWorkerAccess(ctx)) {
            await ctx.reply("Воркер-панель недоступна.");
            return;
        }
        await (0, views_1.showWorkerClientsScreen)(ctx);
    });
    bot.hears(constants_1.WORKER_PANEL_MENU[2], async (ctx) => {
        if (!hasWorkerAccess(ctx)) {
            await ctx.reply("Воркер-панель недоступна.");
            return;
        }
        await ctx.scene.enter("worker-add-card");
    });
    bot.hears(constants_1.BACK_BUTTON, views_1.showServicebotHome);
    bot.action("service:home", async (ctx) => {
        await answerCallback(ctx);
        await trackAuditAction(ctx, "opened_home");
        await (0, views_1.showServicebotHome)(ctx);
    });
    bot.action("service:catalog", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "navigation", "Открыл вкладку VIP модели");
        await trackAuditAction(ctx, "opened_catalog");
        await (0, views_1.showCatalogScreen)(ctx);
    });
    bot.action("service:club", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "navigation", "Открыл вкладку VIP клуб");
        await trackAuditAction(ctx, "opened_club");
        await (0, views_1.showClubScreen)(ctx);
    });
    bot.action("service:profile", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "navigation", "Открыл вкладку Мой профиль");
        await trackAuditAction(ctx, "opened_profile");
        await (0, views_1.showServiceProfile)(ctx);
    });
    bot.action("service:search", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "navigation", "Открыл вкладку Найти девушку");
        await trackAuditAction(ctx, "opened_search");
        await (0, views_1.showCategorySelection)(ctx);
    });
    bot.action("service:cities:noop", async (ctx) => {
        await answerCallback(ctx);
    });
    bot.action("service:cards:noop", async (ctx) => {
        await answerCallback(ctx);
    });
    bot.action(/^service:category:(girls|pepper)$/, async (ctx) => {
        await answerCallback(ctx);
        const category = ctx.match[1];
        await trackRefAction(ctx, "search", "Выбрал раздел анкет", getCategoryLabel(category));
        await trackAuditAction(ctx, "selected_category", category);
        await (0, views_1.showCitySelection)(ctx, category);
    });
    bot.action(/^service:city:(.+)$/, async (ctx) => {
        await answerCallback(ctx);
        const city = ctx.match[1];
        ctx.session.searchDraft = { ...ctx.session.searchDraft, city, page: 1 };
        await trackRefAction(ctx, "search", "Выбрал город", city);
        await trackAuditAction(ctx, "selected_city", city);
        await (0, views_1.showCityCards)(ctx, city);
    });
    bot.action(/^service:cards:page:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        const city = ctx.session.searchDraft?.city;
        if (!city) {
            await (0, views_1.showCategorySelection)(ctx);
            return;
        }
        ctx.session.searchDraft = { ...ctx.session.searchDraft, city, page: Number(ctx.match[1]) };
        await (0, views_1.showCityCards)(ctx, city);
    });
    bot.action("service:search-back", async (ctx) => {
        await answerCallback(ctx);
        const city = ctx.session.searchDraft?.city;
        if (city) {
            await (0, views_1.showCityCards)(ctx, city);
            return;
        }
        const category = ctx.session.searchDraft?.category;
        if (category) {
            await (0, views_1.showCategoryCardsPreview)(ctx, category);
            return;
        }
        await (0, views_1.showCategorySelection)(ctx);
    });
    bot.action(/^service:card:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        const cardId = Number(ctx.match[1]);
        const card = await (0, cards_service_1.getCardById)(cardId);
        if (card) {
            await trackRefAction(ctx, "search", "Открыл анкету модели", `${card.name}, ${card.age} | ${card.city}`);
            await trackAuditAction(ctx, "opened_card", `card_id=${card.id}; ${card.name}, ${card.age}; ${card.city}`);
        }
        await (0, views_1.showCardDetails)(ctx, cardId);
    });
    bot.action(/^service:card:photo:(\d+):(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showCardDetails)(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
    });
    bot.action(/^service:favorite:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        const user = ctx.state.user;
        if (!user) {
            await ctx.reply("Сначала выполните /start.");
            return;
        }
        await (0, favorites_service_1.toggleFavorite)(user.id, Number(ctx.match[1]));
        await trackAuditAction(ctx, "toggled_favorite", `card_id=${Number(ctx.match[1])}`);
        await (0, views_1.showCardDetails)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^service:certificate:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showModelCertificate)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^service:safety-policy:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showModelSafetyPolicy)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^service:model-reviews:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showModelReviews)(ctx, Number(ctx.match[1]), 1);
    });
    bot.action(/^service:model-reviews:(\d+):(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showModelReviews)(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
    });
    bot.action(/^service:schedule:(today|week):(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showModelSchedule)(ctx, Number(ctx.match[2]), ctx.match[1]);
    });
    bot.action(/^service:booking:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await trackAuditAction(ctx, "opened_prebooking", `card_id=${Number(ctx.match[1])}`);
        await (0, views_1.showPrebookingScreen)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^service:payment:open:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        const card = await (0, cards_service_1.getCardById)(Number(ctx.match[1]));
        if (card) {
            await trackRefAction(ctx, "payments", "Перешёл к оплате", `${card.name}, ${card.age} | ${card.city}`);
            await trackAuditAction(ctx, "opened_payment", `card_id=${card.id}; ${card.name}, ${card.city}`);
        }
        await (0, views_1.showPaymentScreen)(ctx, Number(ctx.match[1]));
    });
    bot.action(/^service:payment:(cash|bot_balance):(\d+)$/, async (ctx) => {
        await trackAuditAction(ctx, "selected_payment_method", `card_id=${Number(ctx.match[2])}; payment=${ctx.match[1]}`);
        await (0, views_1.handlePaymentChoice)(ctx, Number(ctx.match[2]), ctx.match[1]);
    });
    bot.action("service:profile:topup", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "payments", "Собирается пополнять баланс");
        await trackAuditAction(ctx, "started_topup");
        await ctx.scene.enter("service-payment-confirmation");
    });
    bot.action("service:profile:topup:deposit", async (ctx) => {
        await answerCallback(ctx);
        ctx.session.paymentRequestDraft = { amount: constants_1.CASH_SECURITY_DEPOSIT_AMOUNT, workerUserId: ctx.session.inlineWorkerUserId };
        await trackRefAction(ctx, "payments", "Собирается пополнять депозит", `${constants_1.CASH_SECURITY_DEPOSIT_AMOUNT} RUB`);
        await trackAuditAction(ctx, "started_deposit_topup", `${constants_1.CASH_SECURITY_DEPOSIT_AMOUNT} RUB`);
        await ctx.scene.enter("service-payment-confirmation");
    });
    bot.action("service:profile:topup:confirm", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "payments", "Собирается пополнять баланс");
        await trackAuditAction(ctx, "started_topup");
        await ctx.scene.enter("service-payment-confirmation");
    });
    bot.action("service:profile:promo", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showProfilePlaceholder)(ctx, "🎁 Промокод", "Раздел промокодов подготовлен для следующей интеграции.");
    });
    bot.action("service:profile:loyalty", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showInfoSection)(ctx, "loyalty");
    });
    bot.action("service:profile:recommendations", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showInfoSection)(ctx, "recommendations");
    });
    bot.action("service:profile:favorites", async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showFavoriteCardsScreen)(ctx);
    });
    bot.action(/^service:reviews:page:(\d+)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showReviewsPage)(ctx, Number(ctx.match[1]));
    });
    bot.action("service:reviews:noop", async (ctx) => {
        await answerCallback(ctx);
    });
    bot.action("service:reviews:add", async (ctx) => {
        await answerCallback(ctx);
        await trackAuditAction(ctx, "opened_review_form");
        await ctx.scene.enter("service-review");
    });
    bot.action("service:support:create", async (ctx) => {
        await answerCallback(ctx);
        await trackAuditAction(ctx, "opened_support_form");
        await ctx.scene.enter("service-support");
    });
    bot.action("service:support:open", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "navigation", "Открыл вкладку Поддержка");
        await trackAuditAction(ctx, "opened_support");
        await (0, views_1.showSupportScreen)(ctx);
    });
    bot.action("service:info:root", async (ctx) => {
        await answerCallback(ctx);
        await trackRefAction(ctx, "navigation", "Открыл вкладку Информация");
        await trackAuditAction(ctx, "opened_info");
        await (0, views_1.showInfoRoot)(ctx);
    });
    bot.action(/^service:info:(safety|tech|legal|finance|data|verification|emergency|awards|loyalty|recommendations|premium_support|agreement)$/, async (ctx) => {
        await answerCallback(ctx);
        await (0, views_1.showInfoSection)(ctx, ctx.match[1]);
    });
    bot.action("service:worker:home", async (ctx) => {
        await answerCallback(ctx);
        if (!hasWorkerAccess(ctx)) {
            await ctx.reply("Воркер-панель недоступна.");
            return;
        }
        await (0, views_1.showWorkerHome)(ctx);
    });
    bot.action("service:worker:clients:search", async (ctx) => {
        await answerCallback(ctx);
        if (!hasWorkerAccess(ctx)) {
            await ctx.reply("Воркер-панель недоступна.");
            return;
        }
        await ctx.scene.enter("worker-clients-search");
    });
}
