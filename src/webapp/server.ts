import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { Input } from "telegraf";
import { config } from "../config/env";
import { AVAILABLE_CITIES, CARD_CATEGORIES, INFO_SECTIONS, REVIEWS_CHANNEL_URL, SUPPORT_BOT_URL } from "../config/constants";
import { adminPaymentRequestKeyboard } from "../keyboards/admin";
import { createBooking, createPaidBooking, countCompletedBookings } from "../services/bookings.service";
import { getTeambotTelegram, getServicebotTelegram } from "../services/bot-clients.service";
import { getCardById, listCardsPaginated, listRecentCards } from "../services/cards.service";
import { createClientEvent } from "../services/client-events.service";
import { linkClientToWorker } from "../services/clients.service";
import { isFavorite, listFavoriteCards, toggleFavorite } from "../services/favorites.service";
import { materializeCardPhotoReferences, resolveLocalMediaPath } from "../services/media.service";
import { attachWebappPaymentReceipt, createWebappPaymentRequest, getPaymentRequestMediaInput } from "../services/payment-requests.service";
import { assignReferralOwner, parseReferralPayload } from "../services/referrals.service";
import { createReview } from "../services/reviews.service";
import { getTransferDetails } from "../services/settings.service";
import {
  buildModelCardText,
  buildModelCertificateText,
  buildModelReviewsText,
  buildModelSafetyPolicyText,
  buildScheduleText,
  listReviewFeed,
} from "../services/showcase.service";
import { createSupportTicket } from "../services/support.service";
import { sendServicebotAuditEvent } from "../services/servicebot-audit.service";
import {
  activateUserFriendCode,
  ensureUserFriendCode,
  getUserById,
  registerServicebotUser,
} from "../services/users.service";
import type { CardCategory, User } from "../types/entities";
import { buildMediaUrl } from "../utils/webapp";

type TelegramWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
};

type WebappRequest = Request & {
  currentUser?: User;
  telegramUser?: TelegramWebAppUser;
  isPreview?: boolean;
};

export type RunningWebappServer = {
  stop: () => Promise<void>;
};

let runningWebappServerPromise: Promise<RunningWebappServer> | null = null;

function verifyInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !config.servicebotToken) {
    return null;
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);

  const secret = crypto.createHmac("sha256", "WebAppData").update(config.servicebotToken).digest();
  const signature = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  if (signature !== hash) {
    return null;
  }

  const userValue = params.get("user");
  if (!userValue) {
    return null;
  }

  try {
    return {
      user: JSON.parse(userValue) as TelegramWebAppUser,
      startParam: params.get("start_param"),
    };
  } catch {
    return null;
  }
}

function getInitData(req: Request) {
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

function isLocalPreviewRequest(req: Request) {
  if (config.nodeEnv === "production") {
    return false;
  }

  const host = req.hostname?.toLowerCase() ?? "";
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function notifyAdminsAboutPaymentRequest(
  currentUser: User,
  telegramUser: TelegramWebAppUser,
  requestId: number,
  amount: number,
  receiptMedia: ReturnType<typeof getPaymentRequestMediaInput>,
  comment?: string,
) {
  const caption = [
    "<b>💳 Новая заявка на проверку оплаты</b>",
    `Заявка: #${requestId}`,
    `Клиент: <code>${telegramUser.id}</code>${telegramUser.username ? ` (@${telegramUser.username})` : ""}`,
    `Сумма: ${amount.toFixed(2)} RUB`,
    comment ? `Комментарий: ${comment}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  const telegram = getTeambotTelegram();
  for (const adminTelegramId of config.adminTelegramIds) {
    try {
      if (receiptMedia) {
        await telegram.sendPhoto(adminTelegramId, receiptMedia as never, {
          caption,
          parse_mode: "HTML",
          ...adminPaymentRequestKeyboard(requestId),
        });
      } else {
        await telegram.sendMessage(adminTelegramId, caption, {
          parse_mode: "HTML",
          ...adminPaymentRequestKeyboard(requestId),
        });
      }
    } catch {
      continue;
    }
  }
}

async function notifySupport(message: string) {
  const telegram = getServicebotTelegram();
  for (const telegramId of config.supportNotifyIds.length ? config.supportNotifyIds : config.adminTelegramIds) {
    try {
      await telegram.sendMessage(telegramId, message, { parse_mode: "HTML" });
    } catch {
      continue;
    }
  }
}

async function saveReceiptImage(imageBase64: string) {
  const match = imageBase64.match(/^data:(.+);base64,(.+)$/);
  const mimeType = match?.[1] ?? "image/jpeg";
  const base64 = match?.[2] ?? imageBase64;
  const extension = mimeType.includes("png") ? ".png" : mimeType.includes("webp") ? ".webp" : ".jpg";
  const relativePath = path.join("payments", "webapp", `${Date.now()}-${randomUUID()}${extension}`).replaceAll("\\", "/");
  const absolutePath = path.resolve(process.cwd(), "data", "media", relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(base64, "base64"));

  return `local:${relativePath}`;
}

function buildCardDto(card: Awaited<ReturnType<typeof getCardById>>, favorite: boolean, photoUrls: string[]) {
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
    html: buildModelCardText(card),
    photoUrls,
  };
}

async function auditWebappAction(req: WebappRequest, action: string, details?: string) {
  const user = req.currentUser;
  if (!user) {
    return;
  }

  await sendServicebotAuditEvent({
    telegramId: user.telegram_id,
    username: user.username,
    action,
    details,
  });
}

async function withCurrentUser(req: WebappRequest, _res: Response, next: NextFunction) {
  const initData = getInitData(req);
  const verified = verifyInitData(initData);
  if (!verified) {
    if (!isLocalPreviewRequest(req)) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    const previewUser = await registerServicebotUser({
      telegramId: 900000001,
      username: "browser_preview",
      firstName: "Browser Preview",
    });

    if (!previewUser) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    req.currentUser = previewUser;
    req.telegramUser = {
      id: previewUser.telegram_id,
      username: previewUser.username ?? undefined,
      first_name: previewUser.first_name ?? undefined,
    };
    req.isPreview = true;
    next();
    return;
  }

  const currentUser = await registerServicebotUser({
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
  req.isPreview = false;

  const payload = parseReferralPayload(verified.startParam);
  if (payload && !currentUser.referred_by_user_id) {
    req.currentUser = (await assignReferralOwner(currentUser, payload)) ?? currentUser;
  }

  next();
}

function createApp() {
  const app = express();
  const publicDir = path.resolve(process.cwd(), "dist", "public");
  const mediaDir = path.resolve(process.cwd(), "data", "media");

  app.use(express.json({ limit: "20mb" }));
  app.use(express.static(publicDir, { index: false }));
  app.use("/assets", express.static(path.join(publicDir, "assets")));
  app.use("/media", express.static(mediaDir));
  app.get("/webapp", async (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });

  app.use("/api/webapp", withCurrentUser);

  app.get("/api/webapp/bootstrap", async (req: WebappRequest, res) => {
    const currentUser = req.currentUser!;
    await auditWebappAction(req, "webapp_bootstrap", String(req.query.screen ?? "catalog"));
    if (currentUser.referred_by_user_id) {
      await createClientEvent(currentUser, "navigation", "Mini App открыт");
    }

    if (["worker", "admin", "curator"].includes(currentUser.role)) {
      await ensureUserFriendCode(currentUser.id);
    }

    const favorites = await listFavoriteCards(currentUser.id);
    const completedBookings = await countCompletedBookings(currentUser.id);
    const refreshedUser = (await getUserById(currentUser.id)) ?? currentUser;

    res.json({
      ok: true,
      previewMode: Boolean(req.isPreview),
      initialScreen: String(req.query.screen ?? "catalog"),
      user: {
        id: refreshedUser.id,
        telegramId: refreshedUser.telegram_id,
        username: refreshedUser.username,
        firstName: refreshedUser.first_name,
        balance: refreshedUser.balance,
        createdAt: refreshedUser.created_at,
        requireFriendCode: req.isPreview ? false : !refreshedUser.referred_by_user_id,
        completedBookings,
      },
      menu: {
        reviewChannelUrl: REVIEWS_CHANNEL_URL,
        supportBotUrl: SUPPORT_BOT_URL,
      },
      favoritesCount: favorites.length,
    });
  });

  app.post("/api/webapp/friend-code/activate", async (req: WebappRequest, res) => {
    const currentUser = req.currentUser!;
    const code = String(req.body?.code ?? "").trim();
    const result = await activateUserFriendCode(currentUser.id, code);

    if (result.status !== "activated" || !result.user || !result.worker) {
      res.status(400).json({ ok: false, status: result.status });
      return;
    }

    await linkClientToWorker(result.worker.id, result.user.telegram_id, result.user.username ?? undefined);
    await auditWebappAction(req, "activated_friend_code", result.worker.friend_code ?? code.toUpperCase());
    await createClientEvent(result.user, "referrals", "Friend code активирован", result.worker.friend_code ?? code.toUpperCase());
    res.json({
      ok: true,
      worker: {
        id: result.worker.id,
        username: result.worker.username,
        firstName: result.worker.first_name,
      },
    });
  });

  app.get("/api/webapp/profile", async (req: WebappRequest, res) => {
    const currentUser = (await getUserById(req.currentUser!.id)) ?? req.currentUser!;
    const favorites = await listFavoriteCards(currentUser.id);
    await auditWebappAction(req, "opened_profile_webapp");
    await createClientEvent(currentUser, "navigation", "Открыт раздел профиля");

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

  app.get("/api/webapp/catalog/summary", async (_req: WebappRequest, res) => {
    const [girls, pepper] = await Promise.all([listRecentCards(5, "girls"), listRecentCards(5, "pepper")]);
    res.json({
      ok: true,
      categories: CARD_CATEGORIES,
      cities: AVAILABLE_CITIES,
      recent: {
        girls,
        pepper,
      },
    });
  });

  app.get("/api/webapp/cards", async (req: WebappRequest, res) => {
    const category = (typeof req.query.category === "string" ? req.query.category : undefined) as CardCategory | undefined;
    const city = typeof req.query.city === "string" ? req.query.city : undefined;
    const page = Number(req.query.page ?? 1);
    const result = await listCardsPaginated({ category, city, page, limit: 5 });
    await createClientEvent(
      req.currentUser!,
      "search",
      city ? "Выбран город" : "Открыт список анкет",
      [category, city, `страница ${result.page}`].filter(Boolean).join(" | "),
    );
    await auditWebappAction(req, "opened_card_list_webapp", [category, city, `page=${result.page}`].filter(Boolean).join("; "));

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

  app.get("/api/webapp/cards/:id", async (req: WebappRequest, res) => {
    const card = await getCardById(Number(req.params.id));
    if (!card) {
      res.status(404).json({ ok: false });
      return;
    }

    const [references, favorite] = await Promise.all([
      materializeCardPhotoReferences(card.photos),
      isFavorite(req.currentUser!.id, card.id),
    ]);
    const photoUrls = references.map((reference) => buildMediaUrl(reference)).filter(Boolean);
    await createClientEvent(req.currentUser!, "search", "Открыта карточка модели", `${card.name}, ${card.age} | ${card.city}`);
    await auditWebappAction(req, "opened_card_webapp", `card_id=${card.id}; ${card.name}, ${card.city}`);

    res.json({ ok: true, card: buildCardDto(card, favorite, photoUrls as string[]) });
  });

  app.get("/api/webapp/cards/:id/reviews", async (req: WebappRequest, res) => {
    const card = await getCardById(Number(req.params.id));
    if (!card) {
      res.status(404).json({ ok: false });
      return;
    }

    const page = Number(req.query.page ?? 1);
    const reviewPage = buildModelReviewsText(card, page);
    res.json({ ok: true, ...reviewPage, page });
  });

  app.get("/api/webapp/cards/:id/schedule", async (req: WebappRequest, res) => {
    const card = await getCardById(Number(req.params.id));
    if (!card) {
      res.status(404).json({ ok: false });
      return;
    }

    const mode = req.query.mode === "week" ? "week" : "today";
    res.json({ ok: true, mode, html: buildScheduleText(card, mode) });
  });

  app.get("/api/webapp/cards/:id/certificate", async (req: WebappRequest, res) => {
    const card = await getCardById(Number(req.params.id));
    if (!card) {
      res.status(404).json({ ok: false });
      return;
    }

    res.json({ ok: true, html: buildModelCertificateText(card) });
  });

  app.get("/api/webapp/cards/:id/safety", async (_req: WebappRequest, res) => {
    res.json({ ok: true, html: buildModelSafetyPolicyText() });
  });

  app.post("/api/webapp/cards/:id/favorite/toggle", async (req: WebappRequest, res) => {
    const nextState = await toggleFavorite(req.currentUser!.id, Number(req.params.id));
    await createClientEvent(req.currentUser!, "search", nextState ? "Анкета добавлена в избранное" : "Анкета удалена из избранного");
    await auditWebappAction(req, nextState ? "favorited_card_webapp" : "unfavorited_card_webapp", `card_id=${Number(req.params.id)}`);
    res.json({ ok: true, favorite: nextState });
  });

  app.post("/api/webapp/cards/:id/prebook", async (req: WebappRequest, res) => {
    const currentUser = (await getUserById(req.currentUser!.id)) ?? req.currentUser!;
    const paymentMethod = req.body?.paymentMethod === "cash" ? "cash" : "bot_balance";
    const card = await getCardById(Number(req.params.id));
    if (!card) {
      res.status(404).json({ ok: false });
      return;
    }

    if (paymentMethod === "cash") {
      const completed = await countCompletedBookings(currentUser.id);
      if (completed < 1) {
        res.status(409).json({ ok: false, code: "cash_locked" });
        return;
      }
      await createBooking(currentUser.id, card.id, "WebApp / 1 час", paymentMethod);
    } else {
      const result = await createPaidBooking(currentUser.id, card.id, "WebApp / 1 час", card.price_1h);
      if (result.status !== "completed") {
        res.status(409).json({ ok: false, code: result.status });
        return;
      }
    }

    await createClientEvent(currentUser, "bookings", "Создано бронирование", `${card.name} | ${paymentMethod}`);
    await auditWebappAction(req, "created_booking_webapp", `card_id=${card.id}; payment=${paymentMethod}`);
    res.json({ ok: true });
  });

  app.post("/api/webapp/topup/create", async (req: WebappRequest, res) => {
    const amount = Number(req.body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ ok: false, code: "invalid_amount" });
      return;
    }

    const request = await createWebappPaymentRequest(req.currentUser!.id, amount, req.currentUser!.referred_by_user_id ?? null);
    await createClientEvent(req.currentUser!, "payments", "Начато пополнение баланса", `${amount.toFixed(2)} RUB`);
    await auditWebappAction(req, "started_topup_webapp", `${amount.toFixed(2)} RUB`);
    res.json({
      ok: true,
      requestId: request?.id,
      amount,
      transferDetails: await getTransferDetails(),
    });
  });

  app.post("/api/webapp/topup/:id/receipt", async (req: WebappRequest, res) => {
    const requestId = Number(req.params.id);
    const imageBase64 = String(req.body?.imageBase64 ?? "");
    const comment = typeof req.body?.comment === "string" ? req.body.comment : undefined;
    if (!imageBase64) {
      res.status(400).json({ ok: false, code: "missing_receipt" });
      return;
    }

    const reference = await saveReceiptImage(imageBase64);
    const request = await attachWebappPaymentReceipt(requestId, reference, comment);
    if (!request || request.user_id !== req.currentUser!.id) {
      res.status(404).json({ ok: false, code: "request_not_found" });
      return;
    }

    await createClientEvent(req.currentUser!, "payments", "Чек пополнения отправлен", `${request.amount.toFixed(2)} RUB`);
    await auditWebappAction(req, "uploaded_topup_receipt_webapp", `request_id=${request.id}; amount=${request.amount.toFixed(2)} RUB`);
    if (!req.isPreview) {
      await notifyAdminsAboutPaymentRequest(
        req.currentUser!,
        req.telegramUser!,
        request.id,
        request.amount,
        getPaymentRequestMediaInput(request),
        comment,
      );
    }
    res.json({ ok: true });
  });

  app.get("/api/webapp/reviews", async (req: WebappRequest, res) => {
    const page = Number(req.query.page ?? 1);
    const reviews = await listReviewFeed(page, 5);
    res.json({ ok: true, page, ...reviews });
  });

  app.post("/api/webapp/reviews", async (req: WebappRequest, res) => {
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      res.status(400).json({ ok: false, code: "empty_review" });
      return;
    }

    await createReview(req.currentUser!.id, text);
    await createClientEvent(req.currentUser!, "navigation", "Отправлен отзыв");
    await auditWebappAction(req, "submitted_review_webapp");
    res.json({ ok: true });
  });

  app.post("/api/webapp/support", async (req: WebappRequest, res) => {
    const message = String(req.body?.message ?? "").trim();
    if (!message) {
      res.status(400).json({ ok: false, code: "empty_message" });
      return;
    }

    const ticket = await createSupportTicket(req.currentUser!.id, message);
    await createClientEvent(req.currentUser!, "navigation", "Создано обращение в поддержку");
    await auditWebappAction(req, "created_support_ticket_webapp", `ticket_id=${ticket?.id ?? "n/a"}`);
    await notifySupport(
      [
        "<b>Новое обращение в поддержку</b>",
        `Пользователь: <code>${req.currentUser!.telegram_id}</code>`,
        `Тикет: #${ticket?.id ?? "n/a"}`,
        `Сообщение: ${message}`,
      ].join("\n"),
    );
    res.json({ ok: true, ticketId: ticket?.id ?? null });
  });

  app.get("/api/webapp/info/:section", (req: WebappRequest, res) => {
    const section = INFO_SECTIONS[req.params.section as keyof typeof INFO_SECTIONS];
    if (!section) {
      res.status(404).json({ ok: false });
      return;
    }

    void auditWebappAction(req, "opened_info_section_webapp", String(req.params.section));
    res.json({ ok: true, section });
  });

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error.message === "UNAUTHORIZED") {
      res.status(401).json({ ok: false, code: "unauthorized" });
      return;
    }

    res.status(500).json({ ok: false, code: "internal_error" });
  });

  return app;
}

export async function launchWebappServer(): Promise<RunningWebappServer> {
  if (runningWebappServerPromise) {
    return runningWebappServerPromise;
  }

  runningWebappServerPromise = (async () => {
    const app = createApp();
    const server = app.listen(config.webappPort);
    return {
      stop: async () => {
        await new Promise<void>((resolve, reject) => {
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
