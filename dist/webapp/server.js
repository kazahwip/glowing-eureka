"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchWebappServer = launchWebappServer;
const node_crypto_1 = __importDefault(require("node:crypto"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_2 = require("node:crypto");
const express_1 = __importDefault(require("express"));
const env_1 = require("../config/env");
const constants_1 = require("../config/constants");
const admin_1 = require("../keyboards/admin");
const bookings_service_1 = require("../services/bookings.service");
const bot_clients_service_1 = require("../services/bot-clients.service");
const cards_service_1 = require("../services/cards.service");
const client_events_service_1 = require("../services/client-events.service");
const clients_service_1 = require("../services/clients.service");
const favorites_service_1 = require("../services/favorites.service");
const media_service_1 = require("../services/media.service");
const payment_requests_service_1 = require("../services/payment-requests.service");
const referrals_service_1 = require("../services/referrals.service");
const reviews_service_1 = require("../services/reviews.service");
const settings_service_1 = require("../services/settings.service");
const showcase_service_1 = require("../services/showcase.service");
const support_service_1 = require("../services/support.service");
const users_service_1 = require("../services/users.service");
const webapp_1 = require("../utils/webapp");
let runningWebappServerPromise = null;
function verifyInitData(initData) {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash || !env_1.config.servicebotToken) {
        return null;
    }
    const pairs = [...params.entries()]
        .filter(([key]) => key !== "hash")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`);
    const secret = node_crypto_1.default.createHmac("sha256", "WebAppData").update(env_1.config.servicebotToken).digest();
    const signature = node_crypto_1.default.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
    if (signature !== hash) {
        return null;
    }
    const userValue = params.get("user");
    if (!userValue) {
        return null;
    }
    try {
        return {
            user: JSON.parse(userValue),
            startParam: params.get("start_param"),
        };
    }
    catch {
        return null;
    }
}
function getInitData(req) {
    const headerValue = req.header("x-telegram-init-data");
    if (headerValue) {
        return headerValue;
    }
    const authHeader = req.header("authorization");
    if (authHeader?.startsWith("tma ")) {
        return authHeader.slice(4).trim();
    }
    return "";
}
async function notifyAdminsAboutPaymentRequest(currentUser, telegramUser, requestId, amount, receiptMedia, comment) {
    const caption = [
        "<b>💳 Новая заявка на проверку оплаты</b>",
        `Заявка: #${requestId}`,
        `Клиент: <code>${telegramUser.id}</code>${telegramUser.username ? ` (@${telegramUser.username})` : ""}`,
        `Сумма: ${amount.toFixed(2)} RUB`,
        comment ? `Комментарий: ${comment}` : undefined,
    ]
        .filter(Boolean)
        .join("\n");
    const telegram = (0, bot_clients_service_1.getTeambotTelegram)();
    for (const adminTelegramId of env_1.config.adminTelegramIds) {
        try {
            if (receiptMedia) {
                await telegram.sendPhoto(adminTelegramId, receiptMedia, {
                    caption,
                    parse_mode: "HTML",
                    ...(0, admin_1.adminPaymentRequestKeyboard)(requestId),
                });
            }
            else {
                await telegram.sendMessage(adminTelegramId, caption, {
                    parse_mode: "HTML",
                    ...(0, admin_1.adminPaymentRequestKeyboard)(requestId),
                });
            }
        }
        catch {
            continue;
        }
    }
}
async function notifySupport(message) {
    const telegram = (0, bot_clients_service_1.getServicebotTelegram)();
    for (const telegramId of env_1.config.supportNotifyIds.length ? env_1.config.supportNotifyIds : env_1.config.adminTelegramIds) {
        try {
            await telegram.sendMessage(telegramId, message, { parse_mode: "HTML" });
        }
        catch {
            continue;
        }
    }
}
async function saveReceiptImage(imageBase64) {
    const match = imageBase64.match(/^data:(.+);base64,(.+)$/);
    const mimeType = match?.[1] ?? "image/jpeg";
    const base64 = match?.[2] ?? imageBase64;
    const extension = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
    const relativePath = node_path_1.default.join("payments", "webapp", `${Date.now()}-${(0, node_crypto_2.randomUUID)()}${extension}`).replaceAll("\\", "/");
    const absolutePath = node_path_1.default.resolve(process.cwd(), "data", "media", relativePath);
    await promises_1.default.mkdir(node_path_1.default.dirname(absolutePath), { recursive: true });
    await promises_1.default.writeFile(absolutePath, Buffer.from(base64, "base64"));
    return `local:${relativePath}`;
}
function buildCardDto(card, favorite, photoUrls) {
    if (!card) {
        return null;
    }
    return {
        id: card.id,
        name: card.name,
        age: card.age,
        city: card.city,
        category: card.category,
        description: card.description,
        price1h: card.price_1h,
        price3h: card.price_3h,
        priceFullDay: card.price_full_day,
        favorite,
        html: (0, showcase_service_1.buildModelCardText)(card),
        photoUrls,
    };
}
async function withCurrentUser(req, _res, next) {
    const initData = getInitData(req);
    const verified = verifyInitData(initData);
    if (!verified) {
        next(new Error("UNAUTHORIZED"));
        return;
    }
    const currentUser = await (0, users_service_1.registerServicebotUser)({
        telegramId: verified.user.id,
        username: verified.user.username,
        firstName: verified.user.first_name,
    });
    if (!currentUser) {
        next(new Error("UNAUTHORIZED"));
        return;
    }
    req.currentUser = currentUser;
    req.telegramUser = verified.user;
    const payload = (0, referrals_service_1.parseReferralPayload)(verified.startParam);
    if (payload && !currentUser.referred_by_user_id) {
        req.currentUser = (await (0, referrals_service_1.assignReferralOwner)(currentUser, payload)) ?? currentUser;
    }
    next();
}
function createApp() {
    const app = (0, express_1.default)();
    const publicDir = node_path_1.default.resolve(process.cwd(), "dist", "public");
    const mediaDir = node_path_1.default.resolve(process.cwd(), "data", "media");
    app.use(express_1.default.json({ limit: "20mb" }));
    app.use("/assets", express_1.default.static(node_path_1.default.join(publicDir, "assets")));
    app.use("/media", express_1.default.static(mediaDir));
    app.get("/webapp", async (_req, res) => {
        res.sendFile(node_path_1.default.join(publicDir, "index.html"));
    });
    app.use("/api/webapp", withCurrentUser);
    app.get("/api/webapp/bootstrap", async (req, res) => {
        const currentUser = req.currentUser;
        if (currentUser.referred_by_user_id) {
            await (0, client_events_service_1.createClientEvent)(currentUser, "navigation", "Mini App открыт");
        }
        if (["worker", "admin", "curator"].includes(currentUser.role)) {
            await (0, users_service_1.ensureUserFriendCode)(currentUser.id);
        }
        const favorites = await (0, favorites_service_1.listFavoriteCards)(currentUser.id);
        const completedBookings = await (0, bookings_service_1.countCompletedBookings)(currentUser.id);
        const refreshedUser = (await (0, users_service_1.getUserById)(currentUser.id)) ?? currentUser;
        res.json({
            ok: true,
            initialScreen: String(req.query.screen ?? "catalog"),
            user: {
                id: refreshedUser.id,
                telegramId: refreshedUser.telegram_id,
                username: refreshedUser.username,
                firstName: refreshedUser.first_name,
                balance: refreshedUser.balance,
                createdAt: refreshedUser.created_at,
                requireFriendCode: !refreshedUser.referred_by_user_id,
                completedBookings,
            },
            menu: {
                reviewChannelUrl: constants_1.REVIEWS_CHANNEL_URL,
                supportBotUrl: constants_1.SUPPORT_BOT_URL,
            },
            favoritesCount: favorites.length,
        });
    });
    app.post("/api/webapp/friend-code/activate", async (req, res) => {
        const currentUser = req.currentUser;
        const code = String(req.body?.code ?? "").trim();
        const result = await (0, users_service_1.activateUserFriendCode)(currentUser.id, code);
        if (result.status !== "activated" || !result.user || !result.worker) {
            res.status(400).json({ ok: false, status: result.status });
            return;
        }
        await (0, clients_service_1.linkClientToWorker)(result.worker.id, result.user.telegram_id, result.user.username ?? undefined);
        await (0, client_events_service_1.createClientEvent)(result.user, "referrals", "Friend code активирован", result.worker.friend_code ?? code.toUpperCase());
        res.json({
            ok: true,
            worker: {
                id: result.worker.id,
                username: result.worker.username,
                firstName: result.worker.first_name,
            },
        });
    });
    app.get("/api/webapp/profile", async (req, res) => {
        const currentUser = (await (0, users_service_1.getUserById)(req.currentUser.id)) ?? req.currentUser;
        const favorites = await (0, favorites_service_1.listFavoriteCards)(currentUser.id);
        await (0, client_events_service_1.createClientEvent)(currentUser, "navigation", "Открыт раздел профиля");
        res.json({
            ok: true,
            user: currentUser,
            favorites: favorites.map((card) => ({
                id: card.id,
                name: card.name,
                age: card.age,
                city: card.city,
                price1h: card.price_1h,
            })),
        });
    });
    app.get("/api/webapp/catalog/summary", async (_req, res) => {
        const [girls, pepper] = await Promise.all([(0, cards_service_1.listRecentCards)(5, "girls"), (0, cards_service_1.listRecentCards)(5, "pepper")]);
        res.json({
            ok: true,
            categories: constants_1.CARD_CATEGORIES,
            cities: constants_1.AVAILABLE_CITIES,
            recent: {
                girls,
                pepper,
            },
        });
    });
    app.get("/api/webapp/cards", async (req, res) => {
        const category = (typeof req.query.category === "string" ? req.query.category : undefined);
        const city = typeof req.query.city === "string" ? req.query.city : undefined;
        const page = Number(req.query.page ?? 1);
        const result = await (0, cards_service_1.listCardsPaginated)({ category, city, page, limit: 5 });
        await (0, client_events_service_1.createClientEvent)(req.currentUser, "search", city ? "Выбран город" : "Открыт список анкет", [category, city, `страница ${result.page}`].filter(Boolean).join(" | "));
        res.json({
            ok: true,
            page: result.page,
            total: result.total,
            totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
            items: result.items.map((card) => ({
                id: card.id,
                name: card.name,
                age: card.age,
                city: card.city,
                category: card.category,
                price1h: card.price_1h,
            })),
        });
    });
    app.get("/api/webapp/cards/:id", async (req, res) => {
        const card = await (0, cards_service_1.getCardById)(Number(req.params.id));
        if (!card) {
            res.status(404).json({ ok: false });
            return;
        }
        const [references, favorite] = await Promise.all([
            (0, media_service_1.materializeCardPhotoReferences)(card.photos),
            (0, favorites_service_1.isFavorite)(req.currentUser.id, card.id),
        ]);
        const photoUrls = references.map((reference) => (0, webapp_1.buildMediaUrl)(reference)).filter(Boolean);
        await (0, client_events_service_1.createClientEvent)(req.currentUser, "search", "Открыта карточка модели", `${card.name}, ${card.age} | ${card.city}`);
        res.json({ ok: true, card: buildCardDto(card, favorite, photoUrls) });
    });
    app.get("/api/webapp/cards/:id/reviews", async (req, res) => {
        const card = await (0, cards_service_1.getCardById)(Number(req.params.id));
        if (!card) {
            res.status(404).json({ ok: false });
            return;
        }
        const page = Number(req.query.page ?? 1);
        const reviewPage = (0, showcase_service_1.buildModelReviewsText)(card, page);
        res.json({ ok: true, ...reviewPage, page });
    });
    app.get("/api/webapp/cards/:id/schedule", async (req, res) => {
        const card = await (0, cards_service_1.getCardById)(Number(req.params.id));
        if (!card) {
            res.status(404).json({ ok: false });
            return;
        }
        const mode = req.query.mode === "week" ? "week" : "today";
        res.json({ ok: true, mode, html: (0, showcase_service_1.buildScheduleText)(card, mode) });
    });
    app.get("/api/webapp/cards/:id/certificate", async (req, res) => {
        const card = await (0, cards_service_1.getCardById)(Number(req.params.id));
        if (!card) {
            res.status(404).json({ ok: false });
            return;
        }
        res.json({ ok: true, html: (0, showcase_service_1.buildModelCertificateText)(card) });
    });
    app.get("/api/webapp/cards/:id/safety", async (_req, res) => {
        res.json({ ok: true, html: (0, showcase_service_1.buildModelSafetyPolicyText)() });
    });
    app.post("/api/webapp/cards/:id/favorite/toggle", async (req, res) => {
        const nextState = await (0, favorites_service_1.toggleFavorite)(req.currentUser.id, Number(req.params.id));
        await (0, client_events_service_1.createClientEvent)(req.currentUser, "search", nextState ? "Анкета добавлена в избранное" : "Анкета удалена из избранного");
        res.json({ ok: true, favorite: nextState });
    });
    app.post("/api/webapp/cards/:id/prebook", async (req, res) => {
        const currentUser = (await (0, users_service_1.getUserById)(req.currentUser.id)) ?? req.currentUser;
        const paymentMethod = req.body?.paymentMethod === "cash" ? "cash" : "bot_balance";
        const card = await (0, cards_service_1.getCardById)(Number(req.params.id));
        if (!card) {
            res.status(404).json({ ok: false });
            return;
        }
        if (paymentMethod === "cash") {
            const completed = await (0, bookings_service_1.countCompletedBookings)(currentUser.id);
            if (completed < 1) {
                res.status(409).json({ ok: false, code: "cash_locked" });
                return;
            }
            await (0, bookings_service_1.createBooking)(currentUser.id, card.id, "WebApp / 1 час", paymentMethod);
        }
        else {
            const result = await (0, bookings_service_1.createPaidBooking)(currentUser.id, card.id, "WebApp / 1 час", card.price_1h);
            if (result.status !== "completed") {
                res.status(409).json({ ok: false, code: result.status });
                return;
            }
        }
        await (0, client_events_service_1.createClientEvent)(currentUser, "bookings", "Создано бронирование", `${card.name} | ${paymentMethod}`);
        res.json({ ok: true });
    });
    app.post("/api/webapp/topup/create", async (req, res) => {
        const amount = Number(req.body?.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) {
            res.status(400).json({ ok: false, code: "invalid_amount" });
            return;
        }
        const request = await (0, payment_requests_service_1.createWebappPaymentRequest)(req.currentUser.id, amount, req.currentUser.referred_by_user_id ?? null);
        await (0, client_events_service_1.createClientEvent)(req.currentUser, "payments", "Начато пополнение баланса", `${amount.toFixed(2)} RUB`);
        res.json({
            ok: true,
            requestId: request?.id,
            amount,
            transferDetails: await (0, settings_service_1.getTransferDetails)(),
        });
    });
    app.post("/api/webapp/topup/:id/receipt", async (req, res) => {
        const requestId = Number(req.params.id);
        const imageBase64 = String(req.body?.imageBase64 ?? "");
        const comment = typeof req.body?.comment === "string" ? req.body.comment : undefined;
        if (!imageBase64) {
            res.status(400).json({ ok: false, code: "missing_receipt" });
            return;
        }
        const reference = await saveReceiptImage(imageBase64);
        const request = await (0, payment_requests_service_1.attachWebappPaymentReceipt)(requestId, reference, comment);
        if (!request || request.user_id !== req.currentUser.id) {
            res.status(404).json({ ok: false, code: "request_not_found" });
            return;
        }
        await (0, client_events_service_1.createClientEvent)(req.currentUser, "payments", "Чек пополнения отправлен", `${request.amount.toFixed(2)} RUB`);
        await notifyAdminsAboutPaymentRequest(req.currentUser, req.telegramUser, request.id, request.amount, (0, payment_requests_service_1.getPaymentRequestMediaInput)(request), comment);
        res.json({ ok: true });
    });
    app.get("/api/webapp/reviews", async (req, res) => {
        const page = Number(req.query.page ?? 1);
        const reviews = await (0, showcase_service_1.listReviewFeed)(page, 5);
        res.json({ ok: true, page, ...reviews });
    });
    app.post("/api/webapp/reviews", async (req, res) => {
        const text = String(req.body?.text ?? "").trim();
        if (!text) {
            res.status(400).json({ ok: false, code: "empty_review" });
            return;
        }
        await (0, reviews_service_1.createReview)(req.currentUser.id, text);
        await (0, client_events_service_1.createClientEvent)(req.currentUser, "navigation", "Отправлен отзыв");
        res.json({ ok: true });
    });
    app.post("/api/webapp/support", async (req, res) => {
        const message = String(req.body?.message ?? "").trim();
        if (!message) {
            res.status(400).json({ ok: false, code: "empty_message" });
            return;
        }
        const ticket = await (0, support_service_1.createSupportTicket)(req.currentUser.id, message);
        await (0, client_events_service_1.createClientEvent)(req.currentUser, "navigation", "Создано обращение в поддержку");
        await notifySupport([
            "<b>Новое обращение в поддержку</b>",
            `Пользователь: <code>${req.currentUser.telegram_id}</code>`,
            `Тикет: #${ticket?.id ?? "n/a"}`,
            `Сообщение: ${message}`,
        ].join("\n"));
        res.json({ ok: true, ticketId: ticket?.id ?? null });
    });
    app.get("/api/webapp/info/:section", (req, res) => {
        const section = constants_1.INFO_SECTIONS[req.params.section];
        if (!section) {
            res.status(404).json({ ok: false });
            return;
        }
        res.json({ ok: true, section });
    });
    app.use((error, _req, res, _next) => {
        if (error.message === "UNAUTHORIZED") {
            res.status(401).json({ ok: false, code: "unauthorized" });
            return;
        }
        res.status(500).json({ ok: false, code: "internal_error" });
    });
    return app;
}
async function launchWebappServer() {
    if (runningWebappServerPromise) {
        return runningWebappServerPromise;
    }
    runningWebappServerPromise = (async () => {
        const app = createApp();
        const server = app.listen(env_1.config.webappPort);
        return {
            stop: async () => {
                await new Promise((resolve, reject) => {
                    server.close((error) => (error ? reject(error) : resolve()));
                });
            },
        };
    })().catch((error) => {
        runningWebappServerPromise = null;
        throw error;
    });
    return runningWebappServerPromise;
}
