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
function parseInlineCardQuery(query) {
    const normalized = query.trim();
    const match = normalized.match(/^#?(\d+)$/);
    return match ? Number(match[1]) : null;
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
function registerServicebotHandlers(bot) {
    bot.on("inline_query", async (ctx) => {
        await (0, servicebot_audit_service_1.sendServicebotAuditEvent)({
            telegramId: ctx.inlineQuery.from.id,
            username: ctx.inlineQuery.from.username,
            action: "inline_query",
            details: ctx.inlineQuery.query.trim() || "empty",
        });
        const cardId = parseInlineCardQuery(ctx.inlineQuery.query);
        if (!cardId) {
            await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
            return;
        }
        const card = await (0, cards_service_1.getCardById)(cardId);
        if (!card) {
            await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
            return;
        }
        const keyboard = (0, servicebot_1.cardDetailKeyboard)(card.id, false, 0);
        await ctx.answerInlineQuery([
            {
                type: "article",
                id: `card:${card.id}`,
                title: `${card.name}, ${card.age}`,
                description: `${card.city} ? ${card.price_1h} RUB / 1 ???`,
                input_message_content: {
                    message_text: (0, showcase_service_1.buildModelCardText)(card),
                    parse_mode: "HTML",
                },
                reply_markup: keyboard.reply_markup,
            },
        ], { cache_time: 0, is_personal: true });
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
        ctx.session.paymentRequestDraft = { amount: constants_1.CASH_SECURITY_DEPOSIT_AMOUNT };
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
