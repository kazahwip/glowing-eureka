import fs from "node:fs";
import { CARD_CATEGORIES, HOME_BUTTON, INFO_SECTIONS } from "../../config/constants";
import {
  agreementKeyboard,
  awardsInfoKeyboard,
  cardDetailKeyboard,
  cardListKeyboard,
  cityKeyboard,
  emergencyInfoKeyboard,
  financeInfoKeyboard,
  infoCenterKeyboard,
  infoSectionBackKeyboard,
  legalInfoKeyboard,
  modelCategoryKeyboard,
  modelInfoBackKeyboard,
  modelReviewsKeyboard,
  modelScheduleKeyboard,
  paymentKeyboard,
  prebookingKeyboard,
  reviewsKeyboard,
  safetyInfoKeyboard,
  serviceProfileKeyboard,
  servicebotMainMenuKeyboard,
  simpleInfoBackKeyboard,
  supportKeyboard,
  verificationInfoKeyboard,
  workerBackInlineKeyboard,
  workerPanelKeyboard,
} from "../../keyboards/servicebot";
import { countCompletedBookings, createBooking, createPaidBooking } from "../../services/bookings.service";
import { getTeambotTelegram } from "../../services/bot-clients.service";
import { getCardById, listCardsByCity, listRecentCards } from "../../services/cards.service";
import { getWorkerClientsStats, linkClientToWorker, listWorkerClients, searchWorkerClients } from "../../services/clients.service";
import { isFavorite, listFavoriteCards } from "../../services/favorites.service";
import { materializeCardPhotoReferences, mediaInputFromReference } from "../../services/media.service";
import { getTransferDetails } from "../../services/settings.service";
import {
  buildModelCardText,
  buildModelCertificateText,
  buildModelReviewsText,
  buildModelSafetyPolicyText,
  buildScheduleText,
  listReviewFeed,
} from "../../services/showcase.service";
import { getUserById, isWorkerSignalEnabled } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import type { CardCategory, PaymentMethod } from "../../types/entities";
import { resolveAssetPath, sendScreen } from "../../utils/media";
import { buildServiceProfileText, escapeHtml, formatMoney } from "../../utils/text";

type ServiceInfoKey = keyof typeof INFO_SECTIONS;

function getPhotoExtra(markup: { reply_markup: unknown }) {
  return markup as never;
}

function getMessageExtra(markup: { reply_markup: unknown }) {
  return markup as never;
}

const CARD_PAGE_SIZE = 5;

function buildServiceCardListMarkup(
  cards: Array<{ id: number; name: string; age: number }>,
  category: "girls" | "pepper",
  page: number,
  totalPages: number,
  showIds: boolean,
) {
  const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = cards.map((card) => [
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

async function clearServicebotReplyKeyboard(ctx: AppContext) {
  try {
    const cleanupMessage = await ctx.reply("\u2063", {
      reply_markup: {
        remove_keyboard: true,
      },
    });
    await ctx.deleteMessage(cleanupMessage.message_id).catch(() => undefined);
  } catch {
    // ignore keyboard cleanup errors
  }
}

function getInfoKeyboard(key: ServiceInfoKey) {
  switch (key) {
    case "info_center":
      return infoCenterKeyboard();
    case "safety":
      return safetyInfoKeyboard();
    case "legal":
      return legalInfoKeyboard();
    case "finance":
      return financeInfoKeyboard();
    case "verification":
      return verificationInfoKeyboard();
    case "emergency":
      return emergencyInfoKeyboard();
    case "awards":
      return awardsInfoKeyboard();
    case "agreement":
      return agreementKeyboard();
    case "loyalty":
    case "recommendations":
    case "premium_support":
      return simpleInfoBackKeyboard();
    default:
      return infoSectionBackKeyboard();
  }
}

async function notifyOwnerAboutBooking(
  ctx: AppContext,
  card: NonNullable<Awaited<ReturnType<typeof getCardById>>>,
  paymentMethod: PaymentMethod,
) {
  const ownerUserId = ctx.state.user?.referred_by_user_id ?? card.owner_user_id;
  if (!ctx.from || !ownerUserId) {
    return;
  }

  await linkClientToWorker(ownerUserId, ctx.from.id, ctx.from.username);
  const owner = await getUserById(ownerUserId);
  if (!owner || !isWorkerSignalEnabled(owner, "bookings")) {
    return;
  }

  try {
    await getTeambotTelegram().sendMessage(
      owner.telegram_id,
      [
        "<b>💸 Новый предзаказ</b>",
        `Модель: ${escapeHtml(card.name)}`,
        `Клиент: <code>${ctx.from.id}</code>${ctx.from.username ? ` (@${escapeHtml(ctx.from.username)})` : ""}`,
        `Оплата: ${paymentMethod === "cash" ? "Наличные" : "Баланс бота"}`,
      ].join("\n"),
      { parse_mode: "HTML" },
    );
  } catch {
    // ignore delivery errors
  }
}

export async function showServicebotHome(ctx: AppContext) {
  await clearServicebotReplyKeyboard(ctx);
  const filePath = resolveAssetPath("servicebot", "menu.jpg");
  if (fs.existsSync(filePath)) {
    await ctx.replyWithPhoto(
      { source: filePath },
      {
        ...servicebotMainMenuKeyboard(),
      },
    );
    return;
  }

  await ctx.reply("\u2063", {
    ...servicebotMainMenuKeyboard(),
  });
}

export async function showCatalogScreen(ctx: AppContext) {
  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: ["<b>💘 VIP Модели</b>", "", "Выберите интересующий раздел:", "💋 Девушки", "🌶 Девушки с перчиком"].join("\n"),
    photoExtra: getPhotoExtra(modelCategoryKeyboard()),
    messageExtra: getMessageExtra(modelCategoryKeyboard()),
  });
}

export async function showClubScreen(ctx: AppContext) {
  const markup = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💎 Вступить в клуб", callback_data: "service:info:loyalty" }],
        [{ text: "⬅️ Назад", callback_data: "service:home" }],
      ],
    },
  };

  await sendScreen(ctx, {
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
    photoExtra: markup as never,
    messageExtra: markup as never,
  });
}

export async function showServiceProfile(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: buildServiceProfileText(user),
    photoExtra: getPhotoExtra(serviceProfileKeyboard()),
    messageExtra: getMessageExtra(serviceProfileKeyboard()),
  });
}

export async function showProfilePlaceholder(ctx: AppContext, title: string, text: string) {
  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(text)}`,
    photoExtra: getPhotoExtra(serviceProfileKeyboard()),
    messageExtra: getMessageExtra(serviceProfileKeyboard()),
  });
}

export async function showProfileTopupScreen(ctx: AppContext) {
  const transferDetails = await getTransferDetails();
  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: [
      "<b>💳 Пополнение баланса</b>",
      "",
      "Введите сумму пополнения в следующем сообщении.",
      "",
      "Актуальные реквизиты:",
      escapeHtml(transferDetails),
    ].join("\n"),
    photoExtra: getPhotoExtra(serviceProfileKeyboard()),
    messageExtra: getMessageExtra(serviceProfileKeyboard()),
  });
}

export async function showFavoriteCardsScreen(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  const cards = await listFavoriteCards(user.id);
  const text = cards.length
    ? cards.map((card) => `❤️ ${card.name}, ${card.age} | ${card.city} | ${formatMoney(card.price_1h)}`).join("\n")
    : "Избранных анкет пока нет.";

  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: `<b>❤️ Избранное</b>\n\n${escapeHtml(text)}`,
    photoExtra: getPhotoExtra(serviceProfileKeyboard()),
    messageExtra: getMessageExtra(serviceProfileKeyboard()),
  });
}

export async function showCategorySelection(ctx: AppContext) {
  ctx.session.searchDraft = { page: 1 };
  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: ["<b>🔎 Выбор раздела</b>", "", "Шаг 1. Выберите интересующий раздел:", "", "💋 Девушки", "🌶 Девушки с перчиком"].join(
      "\n",
    ),
    photoExtra: getPhotoExtra(modelCategoryKeyboard()),
    messageExtra: getMessageExtra(modelCategoryKeyboard()),
  });
}

export async function showCitySelection(ctx: AppContext, category?: CardCategory) {
  const nextCategory = category ?? ctx.session.searchDraft?.category;
  ctx.session.searchDraft = { category: nextCategory, page: 1 };

  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: "💘 Выберите город:",
    photoExtra: getPhotoExtra(cityKeyboard()),
    messageExtra: getMessageExtra(cityKeyboard()),
  });
}

export async function showCityCards(ctx: AppContext, city: string) {
  const category = ctx.session.searchDraft?.category;
  const cards = await listCardsByCity(city, category);
  const totalPages = Math.max(1, Math.ceil(cards.length / CARD_PAGE_SIZE));
  const currentPage = Math.min(Math.max(ctx.session.searchDraft?.page ?? 1, 1), totalPages);
  const pageCards = cards.slice((currentPage - 1) * CARD_PAGE_SIZE, currentPage * CARD_PAGE_SIZE);
  const showIds = Boolean(ctx.state.isAdmin);
  ctx.session.searchDraft = { ...ctx.session.searchDraft, city, page: currentPage };
  const categoryLabel = CARD_CATEGORIES.find((item) => item.key === category)?.label ?? "Все";

  if (!cards.length) {
    await ctx.reply(`В разделе ${categoryLabel} для города ${city} пока нет активных анкет.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Назад к городам", callback_data: `service:category:${category ?? "girls"}` }],
          [{ text: HOME_BUTTON, callback_data: "service:home" }],
        ],
      },
    });
    return;
  }

  await ctx.reply(
    `<b>Шаг 3. Анкеты по городу: ${escapeHtml(city)}</b>\nРаздел: ${escapeHtml(categoryLabel)}\nСтраница: ${currentPage} из ${totalPages}`,
    {
      parse_mode: "HTML",
      ...buildServiceCardListMarkup(
        pageCards.map((card) => ({ id: card.id, name: card.name, age: card.age })),
        category ?? "girls",
        currentPage,
        totalPages,
        showIds,
      ),
    },
  );
}

export async function showCardDetails(ctx: AppContext, cardId: number, photoIndex = 0) {
  const card = await getCardById(cardId);
  const user = ctx.state.user;
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  let references: string[] = [];
  if (card.photos.length) {
    try {
      references = await materializeCardPhotoReferences(card.photos);
    } catch {
      references = [];
    }
  }

  const favoriteState = user ? await isFavorite(user.id, cardId) : false;
  const safePhotoIndex = references.length ? ((photoIndex % references.length) + references.length) % references.length : 0;
  const nextPhotoIndex = references.length > 1 ? (safePhotoIndex + 1) % references.length : 0;
  const caption = buildModelCardText(card);
  const keyboard = cardDetailKeyboard(cardId, favoriteState, nextPhotoIndex);

  if (references.length) {
    const media = mediaInputFromReference(references[safePhotoIndex]);
    if (media) {
      await ctx.replyWithPhoto(media as never, {
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

export async function showModelCertificate(ctx: AppContext, cardId: number) {
  const card = await getCardById(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  await ctx.reply(buildModelCertificateText(card), {
    parse_mode: "HTML",
    ...modelInfoBackKeyboard(cardId),
  });
}

export async function showModelSafetyPolicy(ctx: AppContext, cardId: number) {
  const card = await getCardById(cardId);
  if (!card) {
    await ctx.reply("?????? ?? ???????.");
    return;
  }

  await ctx.reply(buildModelSafetyPolicyText(), {
    parse_mode: "HTML",
    ...modelInfoBackKeyboard(cardId),
  });
}

export async function showModelReviews(ctx: AppContext, cardId: number, page = 1) {
  const card = await getCardById(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  const reviewPage = buildModelReviewsText(card, page);
  await ctx.reply(reviewPage.text, {
    parse_mode: "HTML",
    ...modelReviewsKeyboard(cardId, page, reviewPage.hasPrev, reviewPage.hasNext),
  });
}

export async function showModelSchedule(ctx: AppContext, cardId: number, mode: "today" | "week") {
  const card = await getCardById(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  await ctx.reply(buildScheduleText(card, mode), {
    parse_mode: "HTML",
    ...modelScheduleKeyboard(cardId),
  });
}

export async function showPrebookingScreen(ctx: AppContext, cardId: number) {
  const card = await getCardById(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  await ctx.reply(
    [
      "<b>📋 Предварительное бронирование</b>",
      "",
      `Модель: ${escapeHtml(card.name)}, ${card.age}`,
      `Город: ${escapeHtml(card.city)}`,
      "",
      "🎁 Для фиксации предзаказа используется оплата из баланса бота.",
      `💳 К оплате за слот 1 час: ${formatMoney(card.price_1h)}`,
      "",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...prebookingKeyboard(cardId),
    },
  );
}

export async function showPaymentScreen(ctx: AppContext, cardId: number) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  const card = await getCardById(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  const cashAvailable = (await countCompletedBookings(user.id)) > 0;
  await ctx.reply(
    [
      "<b>💘 Выберите способ оплаты</b>",
      "",
      `Модель: ${escapeHtml(card.name)}, ${card.age}`,
      `Слот: 1 час — ${formatMoney(card.price_1h)}`,
      `Баланс бота: ${formatMoney(user.balance)}`,
      "",
      "💳 Баланс бота доступен сразу после подтвержденного пополнения.",
      cashAvailable
        ? "💵 Наличные уже доступны, потому что у вас есть успешная встреча."
        : "💵 Наличные откроются после 1 успешной встречи.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...paymentKeyboard(cardId),
    },
  );
}

export async function handlePaymentChoice(ctx: AppContext, cardId: number, paymentMethod: PaymentMethod) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  const card = await getCardById(cardId);
  if (!card) {
    await ctx.reply("Анкета не найдена.");
    return;
  }

  const completedBookings = await countCompletedBookings(user.id);
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
    const result = await createPaidBooking(user.id, cardId, "Предзаказ / 1 час", card.price_1h);

    if (result.status === "insufficient_balance") {
      await ctx.answerCbQuery("Недостаточно средств").catch(() => undefined);
      await ctx.reply(
        [
          "<b>❌ Недостаточно средств</b>",
          "",
          `Для предзаказа нужно: ${formatMoney(card.price_1h)}`,
          `Сейчас на балансе: ${formatMoney(user.balance)}`,
          "",
          "Пополните баланс и отправьте чек на проверку администратору.",
        ].join("\n"),
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💳 Пополнить баланс", callback_data: "service:profile:topup" }],
              [{ text: "⬅️ Назад к модели", callback_data: `service:card:${cardId}` }],
            ],
          },
        },
      );
      return;
    }

    if (result.status === "missing_user") {
      await ctx.reply("Сначала выполните /start.");
      return;
    }

    await notifyOwnerAboutBooking(ctx, card, paymentMethod);
    await ctx.answerCbQuery("✅ Оплата списана").catch(() => undefined);
    await ctx.reply(
      [
        "<b>✅ Предзаказ оформлен</b>",
        `Модель: ${escapeHtml(card.name)}`,
        `Списано с баланса: ${formatMoney(card.price_1h)}`,
        "Заявка передана воркеру и зафиксирована в системе.",
      ].join("\n"),
      {
        parse_mode: "HTML",
        ...modelInfoBackKeyboard(cardId),
      },
    );
    return;
  }

  await createBooking(user.id, cardId, "Предзаказ / наличные", paymentMethod);
  await notifyOwnerAboutBooking(ctx, card, paymentMethod);
  await ctx.answerCbQuery("✅ Предзаказ оформлен").catch(() => undefined);
  await ctx.reply(
    [
      "<b>✅ Предзаказ оформлен</b>",
      `Модель: ${escapeHtml(card.name)}`,
      "Оплата: наличные",
      "Слот зафиксирован и отправлен воркеру на подтверждение.",
    ].join("\n"),
    {
      parse_mode: "HTML",
      ...modelInfoBackKeyboard(cardId),
    },
  );
}

export async function showCategoryCardsPreview(ctx: AppContext, category: CardCategory) {
  ctx.session.searchDraft = { category, page: 1 };
  const cards = await listRecentCards(CARD_PAGE_SIZE, category);
  const showIds = Boolean(ctx.state.isAdmin);
  const categoryLabel = CARD_CATEGORIES.find((item) => item.key === category)?.label ?? category;
  const replyMarkup = {
    inline_keyboard: [
      ...cards.map((card) => [{ text: `${showIds ? `#${card.id} ` : ""}${card.name}, ${card.age}`, callback_data: `service:card:${card.id}` }]),
      [{ text: "Выбрать город", callback_data: `service:category:${category}` }],
      [{ text: HOME_BUTTON, callback_data: "service:home" }],
    ],
  };

  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: cards.length
      ? `<b>${escapeHtml(categoryLabel)}</b>\n\nНиже показаны последние анкеты этого раздела. Чтобы сузить выбор, нажмите «Выбрать город».`
      : `<b>${escapeHtml(categoryLabel)}</b>\n\nПока нет анкет в этом разделе. Выберите город и проверьте позже.`,
    photoExtra: { reply_markup: replyMarkup } as never,
    messageExtra: { reply_markup: replyMarkup } as never,
  });
}

export async function showReviewsPage(ctx: AppContext, page = 1) {
  const { items, hasNext } = await listReviewFeed(page);
  const text = items.length ? items.join("\n\n") : "Отзывов пока нет.";

  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: `<b>⭐ Отзывы</b>\n\n${text}`,
    photoExtra: getPhotoExtra(reviewsKeyboard(page, hasNext)),
    messageExtra: getMessageExtra(reviewsKeyboard(page, hasNext)),
  });
}

export async function showSupportScreen(ctx: AppContext) {
  await sendScreen(ctx, {
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
    photoExtra: getPhotoExtra(supportKeyboard()),
    messageExtra: getMessageExtra(supportKeyboard()),
  });
}

export async function showInfoRoot(ctx: AppContext) {
  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: `<b>${INFO_SECTIONS.info_center.title}</b>\n\n${INFO_SECTIONS.info_center.text}`,
    photoExtra: getPhotoExtra(infoCenterKeyboard()),
    messageExtra: getMessageExtra(infoCenterKeyboard()),
  });
}

export async function showInfoSection(ctx: AppContext, key: ServiceInfoKey) {
  const section = INFO_SECTIONS[key];
  const keyboard = getInfoKeyboard(key);

  await sendScreen(ctx, {
    botKind: "servicebot",
    banner: "menu.jpg",
    text: `<b>${section.title}</b>\n\n${section.text}`,
    photoExtra: getPhotoExtra(keyboard),
    messageExtra: getMessageExtra(keyboard),
  });
}

export async function showWorkerHome(ctx: AppContext) {
  await ctx.reply(
    ["<b>💼 Воркер-панель</b>", "", "Доступны рассылка по мамонтам, список мамонтов и добавление анкеты."].join("\n"),
    {
      parse_mode: "HTML",
      ...workerPanelKeyboard(),
    },
  );
}

export async function showWorkerClientsScreen(ctx: AppContext, query?: string) {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply("Сначала выполните /start.");
    return;
  }

  const stats = await getWorkerClientsStats(user.id);
  const clients = query ? await searchWorkerClients(user.id, query) : await listWorkerClients(user.id);
  const body = clients.length
    ? clients.map((client) => `${client.telegram_id}${client.username ? ` | @${client.username}` : ""}`).join("\n")
    : "Список мамонтов пока пуст.";

  await ctx.reply(
    [
      "<b>🐘 Мои мамонты</b>",
      "",
      `Всего мамонтов: ${stats.total}`,
      query ? `Поиск: ${escapeHtml(query)}` : "Показаны последние записи.",
      "",
      escapeHtml(body),
    ].join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔎 Найти мамонта", callback_data: "service:worker:clients:search" }],
          [{ text: "⬅️ Назад", callback_data: "service:worker:home" }],
        ],
      },
    },
  );
}

export async function showWorkerInlineHome(ctx: AppContext) {
  await ctx.reply("<b>💼 Воркер-панель</b>\n\nВыберите следующее действие через нижнее меню.", {
    parse_mode: "HTML",
    ...workerBackInlineKeyboard(),
  });
}
