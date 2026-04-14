"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showServicebotHome = showServicebotHome;
exports.showCatalogScreen = showCatalogScreen;
exports.showClubScreen = showClubScreen;
exports.showServiceProfile = showServiceProfile;
exports.showProfilePlaceholder = showProfilePlaceholder;
exports.showProfileTopupScreen = showProfileTopupScreen;
exports.showFavoriteCardsScreen = showFavoriteCardsScreen;
exports.showCategorySelection = showCategorySelection;
exports.showCitySelection = showCitySelection;
exports.showCityCards = showCityCards;
exports.showCardDetails = showCardDetails;
exports.showModelCertificate = showModelCertificate;
exports.showModelSafetyPolicy = showModelSafetyPolicy;
exports.showModelReviews = showModelReviews;
exports.showModelSchedule = showModelSchedule;
exports.showPrebookingScreen = showPrebookingScreen;
exports.showPaymentScreen = showPaymentScreen;
exports.handlePaymentChoice = handlePaymentChoice;
exports.showCategoryCardsPreview = showCategoryCardsPreview;
exports.showReviewsPage = showReviewsPage;
exports.showSupportScreen = showSupportScreen;
exports.showInfoRoot = showInfoRoot;
exports.showInfoSection = showInfoSection;
exports.showWorkerHome = showWorkerHome;
exports.showWorkerClientsScreen = showWorkerClientsScreen;
exports.showWorkerInlineHome = showWorkerInlineHome;
const node_fs_1 = __importDefault(require("node:fs"));
const constants_1 = require("../../config/constants");
const servicebot_1 = require("../../keyboards/servicebot");
const bookings_service_1 = require("../../services/bookings.service");
const bot_clients_service_1 = require("../../services/bot-clients.service");
const cards_service_1 = require("../../services/cards.service");
const clients_service_1 = require("../../services/clients.service");
const favorites_service_1 = require("../../services/favorites.service");
const media_service_1 = require("../../services/media.service");
const settings_service_1 = require("../../services/settings.service");
const showcase_service_1 = require("../../services/showcase.service");
const users_service_1 = require("../../services/users.service");
const media_1 = require("../../utils/media");
const text_1 = require("../../utils/text");
function getPhotoExtra(markup) {
    return markup;
}
function getMessageExtra(markup) {
    return markup;
}
const CARD_PAGE_SIZE = 5;
function buildServiceCardListMarkup(cards, category, page, totalPages, showIds) {
    const inline_keyboard = cards.map((card) => [
        {
            text: `${showIds ? `#${card.id} ` : ""}${card.name}, ${card.age}`,
            callback_data: `service:card:${card.id}`,
        },
    ]);
    if (totalPages > 1) {
        inline_keyboard.push([
            { text: "<", callback_data: page > 1 ? `service:cards:page:${page - 1}` : "service:cards:noop" },
            { text: `${page} из ${totalPages}`, callback_data: "service:cards:noop" },
            { text: ">", callback_data: page < totalPages ? `service:cards:page:${page + 1}` : "service:cards:noop" },
        ]);
    }
    inline_keyboard.push([{ text: "Назад", callback_data: `service:category:${category}` }]);
    return { reply_markup: { inline_keyboard } };
}
async function clearServicebotReplyKeyboard(ctx) {
    try {
        const cleanupMessage = await ctx.reply("\u2063", {
            reply_markup: {
                remove_keyboard: true,
            },
        });
        await ctx.deleteMessage(cleanupMessage.message_id).catch(() => undefined);
    }
    catch {
        // ignore keyboard cleanup errors
    }
}
function getInfoKeyboard(key) {
    switch (key) {
        case "info_center":
            return (0, servicebot_1.infoCenterKeyboard)();
        case "safety":
            return (0, servicebot_1.safetyInfoKeyboard)();
        case "legal":
            return (0, servicebot_1.legalInfoKeyboard)();
        case "finance":
            return (0, servicebot_1.financeInfoKeyboard)();
        case "verification":
            return (0, servicebot_1.verificationInfoKeyboard)();
        case "emergency":
            return (0, servicebot_1.emergencyInfoKeyboard)();
        case "awards":
            return (0, servicebot_1.awardsInfoKeyboard)();
        case "agreement":
            return (0, servicebot_1.agreementKeyboard)();
        case "loyalty":
        case "recommendations":
        case "premium_support":
            return (0, servicebot_1.simpleInfoBackKeyboard)();
        default:
            return (0, servicebot_1.infoSectionBackKeyboard)();
    }
}
async function notifyOwnerAboutBooking(ctx, card, paymentMethod) {
    const ownerUserId = ctx.state.user?.referred_by_user_id ?? card.owner_user_id;
    if (!ctx.from || !ownerUserId) {
        return;
    }
    await (0, clients_service_1.linkClientToWorker)(ownerUserId, ctx.from.id, ctx.from.username);
    const owner = await (0, users_service_1.getUserById)(ownerUserId);
    if (!owner || !(0, users_service_1.isWorkerSignalEnabled)(owner, "bookings")) {
        return;
    }
    try {
        await (0, bot_clients_service_1.getTeambotTelegram)().sendMessage(owner.telegram_id, [
            "<b>💸 Новый предзаказ</b>",
            `Модель: ${(0, text_1.escapeHtml)(card.name)}`,
            `Клиент: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${(0, text_1.escapeHtml)(ctx.from.username)})` : ""}`,
            `Оплата: ${paymentMethod === "cash" ? "Наличные" : "Баланс бота"}`,
        ].join("\n"), { parse_mode: "HTML" });
    }
    catch {
        // ignore delivery errors
    }
}
async function showServicebotHome(ctx) {
    await clearServicebotReplyKeyboard(ctx);
    const filePath = (0, media_1.resolveAssetPath)("servicebot", "menu.jpg");
    if (node_fs_1.default.existsSync(filePath)) {
        await ctx.replyWithPhoto({ source: filePath }, {
            ...(0, servicebot_1.servicebotMainMenuKeyboard)(),
        });
        return;
    }
    await ctx.reply("\u2063", {
        ...(0, servicebot_1.servicebotMainMenuKeyboard)(),
    });
}
async function showCatalogScreen(ctx) {
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: ["<b>💘 VIP Модели</b>", "", "Выберите интересующий раздел:", "💋 Девушки", "🌶 Девушки с перчиком"].join("\n"),
        photoExtra: getPhotoExtra((0, servicebot_1.modelCategoryKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.modelCategoryKeyboard)()),
    });
}
async function showClubScreen(ctx) {
    const markup = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "💎 Вступить в клуб", callback_data: "service:info:loyalty" }],
                [{ text: "⬅️ Назад", callback_data: "service:home" }],
            ],
        },
    };
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: [
            "<b>🎩 VIP Клуб Honey Bunny</b>",
            "",
            "Эксклюзивный доступ к закрытому сообществу.",
            "",
            "<b>Преимущества членства:</b>",
            "• Доступ к VIP моделям",
            "• Приоритетное бронирование",
            "• Персональный куратор",
            "• Закрытые мероприятия",
            "• Полная конфиденциальность",
            "",
            "💎 <b>Стоимость:</b> 150,000 RUB / год",
        ].join("\n"),
        photoExtra: markup,
        messageExtra: markup,
    });
}
async function showServiceProfile(ctx) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: (0, text_1.buildServiceProfileText)(user),
        photoExtra: getPhotoExtra((0, servicebot_1.serviceProfileKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.serviceProfileKeyboard)()),
    });
}
async function showProfilePlaceholder(ctx, title, text) {
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: `<b>${(0, text_1.escapeHtml)(title)}</b>\n\n${(0, text_1.escapeHtml)(text)}`,
        photoExtra: getPhotoExtra((0, servicebot_1.serviceProfileKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.serviceProfileKeyboard)()),
    });
}
async function showProfileTopupScreen(ctx) {
    const transferDetails = await (0, settings_service_1.getTransferDetails)();
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: [
            "<b>💳 Пополнение баланса</b>",
            "",
            "Введите сумму пополнения в следующем сообщении.",
            "",
            "Актуальные реквизиты:",
            (0, text_1.escapeHtml)(transferDetails),
        ].join("\n"),
        photoExtra: getPhotoExtra((0, servicebot_1.serviceProfileKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.serviceProfileKeyboard)()),
    });
}
async function showFavoriteCardsScreen(ctx) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    const cards = await (0, favorites_service_1.listFavoriteCards)(user.id);
    const text = cards.length
        ? cards.map((card) => `❤️ ${card.name}, ${card.age} | ${card.city} | ${(0, text_1.formatMoney)(card.price_1h)}`).join("\n")
        : "Избранных анкет пока нет.";
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: `<b>❤️ Избранное</b>\n\n${(0, text_1.escapeHtml)(text)}`,
        photoExtra: getPhotoExtra((0, servicebot_1.serviceProfileKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.serviceProfileKeyboard)()),
    });
}
async function showCategorySelection(ctx) {
    ctx.session.searchDraft = { page: 1 };
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: ["<b>🔎 Выбор раздела</b>", "", "Шаг 1. Выберите интересующий раздел:", "", "💋 Девушки", "🌶 Девушки с перчиком"].join("\n"),
        photoExtra: getPhotoExtra((0, servicebot_1.modelCategoryKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.modelCategoryKeyboard)()),
    });
}
async function showCitySelection(ctx, category) {
    const nextCategory = category ?? ctx.session.searchDraft?.category;
    ctx.session.searchDraft = { category: nextCategory, page: 1 };
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: "💘 Выберите город:",
        photoExtra: getPhotoExtra((0, servicebot_1.cityKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.cityKeyboard)()),
    });
}
async function showCityCards(ctx, city) {
    const category = ctx.session.searchDraft?.category;
    const cards = await (0, cards_service_1.listCardsByCity)(city, category);
    const totalPages = Math.max(1, Math.ceil(cards.length / CARD_PAGE_SIZE));
    const currentPage = Math.min(Math.max(ctx.session.searchDraft?.page ?? 1, 1), totalPages);
    const pageCards = cards.slice((currentPage - 1) * CARD_PAGE_SIZE, currentPage * CARD_PAGE_SIZE);
    const showIds = Boolean(ctx.state.isAdmin);
    ctx.session.searchDraft = { ...ctx.session.searchDraft, city, page: currentPage };
    const categoryLabel = constants_1.CARD_CATEGORIES.find((item) => item.key === category)?.label ?? "Все";
    if (!cards.length) {
        await ctx.reply(`В разделе ${categoryLabel} для города ${city} пока нет активных анкет.`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⬅️ Назад к городам", callback_data: `service:category:${category ?? "girls"}` }],
                    [{ text: constants_1.HOME_BUTTON, callback_data: "service:home" }],
                ],
            },
        });
        return;
    }
    await ctx.reply(`<b>Шаг 3. Анкеты по городу: ${(0, text_1.escapeHtml)(city)}</b>\nРаздел: ${(0, text_1.escapeHtml)(categoryLabel)}\nСтраница: ${currentPage} из ${totalPages}`, {
        parse_mode: "HTML",
        ...buildServiceCardListMarkup(pageCards.map((card) => ({ id: card.id, name: card.name, age: card.age })), category ?? "girls", currentPage, totalPages, showIds),
    });
}
async function showCardDetails(ctx, cardId, photoIndex = 0) {
    const card = await (0, cards_service_1.getCardById)(cardId);
    const user = ctx.state.user;
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    let references = [];
    if (card.photos.length) {
        try {
            references = await (0, media_service_1.materializeCardPhotoReferences)(card.photos);
        }
        catch {
            references = [];
        }
    }
    const favoriteState = user ? await (0, favorites_service_1.isFavorite)(user.id, cardId) : false;
    const safePhotoIndex = references.length ? ((photoIndex % references.length) + references.length) % references.length : 0;
    const nextPhotoIndex = references.length > 1 ? (safePhotoIndex + 1) % references.length : 0;
    const caption = (0, showcase_service_1.buildModelCardText)(card);
    const keyboard = (0, servicebot_1.cardDetailKeyboard)(cardId, favoriteState, nextPhotoIndex);
    if (references.length) {
        const media = (0, media_service_1.mediaInputFromReference)(references[safePhotoIndex]);
        if (media) {
            await ctx.replyWithPhoto(media, {
                caption,
                parse_mode: "HTML",
                ...keyboard,
            });
            return;
        }
    }
    await ctx.reply(caption, {
        parse_mode: "HTML",
        ...keyboard,
    });
}
async function showModelCertificate(ctx, cardId) {
    const card = await (0, cards_service_1.getCardById)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    await ctx.reply((0, showcase_service_1.buildModelCertificateText)(card), {
        parse_mode: "HTML",
        ...(0, servicebot_1.modelInfoBackKeyboard)(cardId),
    });
}
async function showModelSafetyPolicy(ctx, cardId) {
    const card = await (0, cards_service_1.getCardById)(cardId);
    if (!card) {
        await ctx.reply("?????? ?? ???????.");
        return;
    }
    await ctx.reply((0, showcase_service_1.buildModelSafetyPolicyText)(), {
        parse_mode: "HTML",
        ...(0, servicebot_1.modelInfoBackKeyboard)(cardId),
    });
}
async function showModelReviews(ctx, cardId, page = 1) {
    const card = await (0, cards_service_1.getCardById)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    const reviewPage = (0, showcase_service_1.buildModelReviewsText)(card, page);
    await ctx.reply(reviewPage.text, {
        parse_mode: "HTML",
        ...(0, servicebot_1.modelReviewsKeyboard)(cardId, page, reviewPage.hasPrev, reviewPage.hasNext),
    });
}
async function showModelSchedule(ctx, cardId, mode) {
    const card = await (0, cards_service_1.getCardById)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    await ctx.reply((0, showcase_service_1.buildScheduleText)(card, mode), {
        parse_mode: "HTML",
        ...(0, servicebot_1.modelScheduleKeyboard)(cardId),
    });
}
async function showPrebookingScreen(ctx, cardId) {
    const card = await (0, cards_service_1.getCardById)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    await ctx.reply([
        "<b>📋 Предварительное бронирование</b>",
        "",
        `Модель: ${(0, text_1.escapeHtml)(card.name)}, ${card.age}`,
        `Город: ${(0, text_1.escapeHtml)(card.city)}`,
        "",
        "🎁 Для фиксации предзаказа используется оплата из баланса бота.",
        `💳 К оплате за слот 1 час: ${(0, text_1.formatMoney)(card.price_1h)}`,
        "",
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, servicebot_1.prebookingKeyboard)(cardId),
    });
}
async function showPaymentScreen(ctx, cardId) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    const card = await (0, cards_service_1.getCardById)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    const cashAvailable = (await (0, bookings_service_1.countCompletedBookings)(user.id)) > 0;
    await ctx.reply([
        "<b>💘 Выберите способ оплаты</b>",
        "",
        `Модель: ${(0, text_1.escapeHtml)(card.name)}, ${card.age}`,
        `Слот: 1 час — ${(0, text_1.formatMoney)(card.price_1h)}`,
        `Баланс бота: ${(0, text_1.formatMoney)(user.balance)}`,
        "",
        "💳 Баланс бота доступен сразу после подтвержденного пополнения.",
        cashAvailable
            ? "💵 Наличные уже доступны, потому что у вас есть успешная встреча."
            : "💵 Наличные откроются после 1 успешной встречи.",
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, servicebot_1.paymentKeyboard)(cardId),
    });
}
async function handlePaymentChoice(ctx, cardId, paymentMethod) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    const card = await (0, cards_service_1.getCardById)(cardId);
    if (!card) {
        await ctx.reply("Анкета не найдена.");
        return;
    }
    const completedBookings = await (0, bookings_service_1.countCompletedBookings)(user.id);
    if (paymentMethod === "cash" && completedBookings < 1) {
        await ctx.answerCbQuery().catch(() => undefined);
        await ctx.reply("💔 Этот способ оплаты будет доступен после 1 успешной встречи", {
            reply_markup: {
                inline_keyboard: [[{ text: "⬅️ Назад к оплате", callback_data: `service:payment:open:${cardId}` }]],
            },
        });
        return;
    }
    if (paymentMethod === "bot_balance") {
        const result = await (0, bookings_service_1.createPaidBooking)(user.id, cardId, "Предзаказ / 1 час", card.price_1h);
        if (result.status === "insufficient_balance") {
            await ctx.answerCbQuery("Недостаточно средств").catch(() => undefined);
            await ctx.reply([
                "<b>❌ Недостаточно средств</b>",
                "",
                `Для предзаказа нужно: ${(0, text_1.formatMoney)(card.price_1h)}`,
                `Сейчас на балансе: ${(0, text_1.formatMoney)(user.balance)}`,
                "",
                "Пополните баланс и отправьте чек на проверку администратору.",
            ].join("\n"), {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "💳 Пополнить баланс", callback_data: "service:profile:topup" }],
                        [{ text: "⬅️ Назад к модели", callback_data: `service:card:${cardId}` }],
                    ],
                },
            });
            return;
        }
        if (result.status === "missing_user") {
            await ctx.reply("Сначала выполните /start.");
            return;
        }
        await notifyOwnerAboutBooking(ctx, card, paymentMethod);
        await ctx.answerCbQuery("✅ Оплата списана").catch(() => undefined);
        await ctx.reply([
            "<b>✅ Предзаказ оформлен</b>",
            `Модель: ${(0, text_1.escapeHtml)(card.name)}`,
            `Списано с баланса: ${(0, text_1.formatMoney)(card.price_1h)}`,
            "Заявка передана воркеру и зафиксирована в системе.",
        ].join("\n"), {
            parse_mode: "HTML",
            ...(0, servicebot_1.modelInfoBackKeyboard)(cardId),
        });
        return;
    }
    await (0, bookings_service_1.createBooking)(user.id, cardId, "Предзаказ / наличные", paymentMethod);
    await notifyOwnerAboutBooking(ctx, card, paymentMethod);
    await ctx.answerCbQuery("✅ Предзаказ оформлен").catch(() => undefined);
    await ctx.reply([
        "<b>✅ Предзаказ оформлен</b>",
        `Модель: ${(0, text_1.escapeHtml)(card.name)}`,
        "Оплата: наличные",
        "Слот зафиксирован и отправлен воркеру на подтверждение.",
    ].join("\n"), {
        parse_mode: "HTML",
        ...(0, servicebot_1.modelInfoBackKeyboard)(cardId),
    });
}
async function showCategoryCardsPreview(ctx, category) {
    ctx.session.searchDraft = { category, page: 1 };
    const cards = await (0, cards_service_1.listRecentCards)(CARD_PAGE_SIZE, category);
    const showIds = Boolean(ctx.state.isAdmin);
    const categoryLabel = constants_1.CARD_CATEGORIES.find((item) => item.key === category)?.label ?? category;
    const replyMarkup = {
        inline_keyboard: [
            ...cards.map((card) => [{ text: `${showIds ? `#${card.id} ` : ""}${card.name}, ${card.age}`, callback_data: `service:card:${card.id}` }]),
            [{ text: "Выбрать город", callback_data: `service:category:${category}` }],
            [{ text: constants_1.HOME_BUTTON, callback_data: "service:home" }],
        ],
    };
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: cards.length
            ? `<b>${(0, text_1.escapeHtml)(categoryLabel)}</b>\n\nНиже показаны последние анкеты этого раздела. Чтобы сузить выбор, нажмите «Выбрать город».`
            : `<b>${(0, text_1.escapeHtml)(categoryLabel)}</b>\n\nПока нет анкет в этом разделе. Выберите город и проверьте позже.`,
        photoExtra: { reply_markup: replyMarkup },
        messageExtra: { reply_markup: replyMarkup },
    });
}
async function showReviewsPage(ctx, page = 1) {
    const { items, hasNext } = await (0, showcase_service_1.listReviewFeed)(page);
    const text = items.length ? items.join("\n\n") : "Отзывов пока нет.";
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: `<b>⭐ Отзывы</b>\n\n${text}`,
        photoExtra: getPhotoExtra((0, servicebot_1.reviewsKeyboard)(page, hasNext)),
        messageExtra: getMessageExtra((0, servicebot_1.reviewsKeyboard)(page, hasNext)),
    });
}
async function showSupportScreen(ctx) {
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: [
            "<b>💬 Поддержка</b>",
            "",
            "Если нужен оператор или помощь по заказу, создайте обращение.",
            "Заявка сохранится в базе, а администратор получит уведомление.",
            "",
            "Мы сопровождаем обращение до результата.",
        ].join("\n"),
        photoExtra: getPhotoExtra((0, servicebot_1.supportKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.supportKeyboard)()),
    });
}
async function showInfoRoot(ctx) {
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: `<b>${constants_1.INFO_SECTIONS.info_center.title}</b>\n\n${constants_1.INFO_SECTIONS.info_center.text}`,
        photoExtra: getPhotoExtra((0, servicebot_1.infoCenterKeyboard)()),
        messageExtra: getMessageExtra((0, servicebot_1.infoCenterKeyboard)()),
    });
}
async function showInfoSection(ctx, key) {
    const section = constants_1.INFO_SECTIONS[key];
    const keyboard = getInfoKeyboard(key);
    await (0, media_1.sendScreen)(ctx, {
        botKind: "servicebot",
        banner: "menu.jpg",
        text: `<b>${section.title}</b>\n\n${section.text}`,
        photoExtra: getPhotoExtra(keyboard),
        messageExtra: getMessageExtra(keyboard),
    });
}
async function showWorkerHome(ctx) {
    await ctx.reply(["<b>💼 Воркер-панель</b>", "", "Доступны рассылка по мамонтам, список мамонтов и добавление анкеты."].join("\n"), {
        parse_mode: "HTML",
        ...(0, servicebot_1.workerPanelKeyboard)(),
    });
}
async function showWorkerClientsScreen(ctx, query) {
    const user = ctx.state.user;
    if (!user) {
        await ctx.reply("Сначала выполните /start.");
        return;
    }
    const stats = await (0, clients_service_1.getWorkerClientsStats)(user.id);
    const clients = query ? await (0, clients_service_1.searchWorkerClients)(user.id, query) : await (0, clients_service_1.listWorkerClients)(user.id);
    const body = clients.length
        ? clients.map((client) => `${client.telegram_id}${client.username ? ` | @${client.username}` : ""}`).join("\n")
        : "Список мамонтов пока пуст.";
    await ctx.reply([
        "<b>🐘 Мои мамонты</b>",
        "",
        `Всего мамонтов: ${stats.total}`,
        query ? `Поиск: ${(0, text_1.escapeHtml)(query)}` : "Показаны последние записи.",
        "",
        (0, text_1.escapeHtml)(body),
    ].join("\n"), {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔎 Найти мамонта", callback_data: "service:worker:clients:search" }],
                [{ text: "⬅️ Назад", callback_data: "service:worker:home" }],
            ],
        },
    });
}
async function showWorkerInlineHome(ctx) {
    await ctx.reply("<b>💼 Воркер-панель</b>\n\nВыберите следующее действие через нижнее меню.", {
        parse_mode: "HTML",
        ...(0, servicebot_1.workerBackInlineKeyboard)(),
    });
}
