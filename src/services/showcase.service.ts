import { getDb } from "../db/client";
import type { Card, CardWithPhotos } from "../types/entities";
import { escapeHtml } from "../utils/text";

type ShowcaseCard = Pick<Card, "id" | "name" | "age" | "city" | "category" | "description" | "price_1h" | "price_3h" | "price_full_day">;
type ScheduleMode = "today" | "week";

interface ModelStats {
  verificationId: string;
  rating: string;
  reviewsCount: number;
  completedProjects: number;
  positivePercent: number;
  regularClients: number;
  issuedAt: string;
  nextCheckAt: string;
  signature: string;
  hotOfferDiscount: number;
  hotOfferSlot: string;
  hotOfferMinutesLeft: number;
  popularity: number;
  liveViewers: number;
}

interface ModelReview {
  author: string;
  whenLabel: string;
  text: string;
  createdAt: number;
}

interface ReviewFeedItem {
  createdAt: number;
  html: string;
}

const reviewAuthors = [
  "Валерий П.",
  "Николай Б.",
  "Сергей Т.",
  "Игорь Л.",
  "Максим К.",
  "Антон С.",
  "Егор Д.",
  "Роман В.",
  "Павел Н.",
  "Дмитрий Р.",
  "Анна М.",
  "Мария Ф.",
];

const reviewTemplates = [
  "На выездной работе с {name} всё прошло идеально, она элегантная и очень собранная. Просто космос.",
  "{name} приехала без задержек и превзошла ожидания. Очень тёплая в общении и уверенная в работе. Рекомендую.",
  "Заказывал {name}, всё было по договорённости. Профессиональна и доброжелательна, время прошло очень легко.",
  "С {name} было максимально комфортно. Настоящий профи своего дела, впечатления остались только сильные.",
  "Провели вечернее мероприятие с {name} очень элегантно и со вкусом. Она деликатная и внимательная к деталям.",
  "После проекта с {name} остались отличные впечатления. Очень мягкая в общении, но при этом уверенная и собранная.",
  "Брали {name} на презентацию бренда, всё выглядело достойно. Отличный контакт с гостями и спокойная подача.",
  "{name} полностью соответствовала фото и референсам. Аккуратная работа, хороший ритм и приятная коммуникация.",
  "На съёмке с {name} всё прошло без суеты. Внимательная, стильная и очень комфортная в работе.",
];

const todaySlots = [
  "10:00 - 12:00 (2 часа)",
  "12:00 - 14:00 (2 часа)",
  "14:00 - 17:00 (3 часа)",
  "18:00 - 21:00 (3 часа)",
  "20:00 - 23:00 (вечер)",
  "22:00 - 02:00 (ночной слот)",
];

const weekDayLabels = ["ПОНЕДЕЛЬНИК", "ВТОРНИК", "СРЕДА", "ЧЕТВЕРГ", "ПЯТНИЦА", "СУББОТА", "ВОСКРЕСЕНЬЕ"];

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seedValue: string) {
  let seed = hashString(seedValue) || 1;

  return () => {
    seed += 0x6d2b79f5;
    let next = seed;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function getRandomInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function formatPreciseMoney(amount: number) {
  return `${amount.toFixed(2)} RUB`;
}

function formatRuDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function buildStats(card: ShowcaseCard): ModelStats {
  const random = createRandom(`stats:${card.id}:${card.name}:${card.city}`);
  const verificationNumber = getRandomInt(random, 41000, 89999);
  const issuedAt = new Date();
  issuedAt.setDate(issuedAt.getDate() - getRandomInt(random, 6, 28));
  const nextCheckAt = new Date(issuedAt);
  nextCheckAt.setDate(nextCheckAt.getDate() + getRandomInt(random, 21, 36));

  return {
    verificationId: `LUX-${verificationNumber}`,
    rating: (getRandomInt(random, 47, 50) / 10).toFixed(1),
    reviewsCount: getRandomInt(random, 182, 587),
    completedProjects: getRandomInt(random, 58, 214),
    positivePercent: getRandomInt(random, 94, 99),
    regularClients: getRandomInt(random, 12, 34),
    issuedAt: formatRuDate(issuedAt),
    nextCheckAt: formatRuDate(nextCheckAt),
    signature: `HB${verificationNumber}${getRandomInt(random, 100000, 999999)}`,
    hotOfferDiscount: getRandomInt(random, 11, 25),
    hotOfferSlot: todaySlots[getRandomInt(random, 1, 3)],
    hotOfferMinutesLeft: getRandomInt(random, 19, 58),
    popularity: getRandomInt(random, 7, 10),
    liveViewers: getRandomInt(random, 1, 4),
  };
}

function formatDaysAgo(daysAgo: number) {
  if (daysAgo <= 1) {
    return "вчера";
  }

  if (daysAgo < 5) {
    return `${daysAgo} дня назад`;
  }

  return `${daysAgo} дней назад`;
}

function buildModelReviews(card: ShowcaseCard) {
  const random = createRandom(`reviews:${card.id}:${card.name}`);
  const usedAuthors = new Set<string>();
  const items: ModelReview[] = [];

  for (let index = 0; index < 6; index += 1) {
    let author = reviewAuthors[getRandomInt(random, 0, reviewAuthors.length - 1)];
    while (usedAuthors.has(author)) {
      author = reviewAuthors[getRandomInt(random, 0, reviewAuthors.length - 1)];
    }
    usedAuthors.add(author);

    const template = reviewTemplates[getRandomInt(random, 0, reviewTemplates.length - 1)];
    const daysAgo = getRandomInt(random, 1, 7) + index;
    const createdAt = Date.now() - daysAgo * 24 * 60 * 60 * 1000 - getRandomInt(random, 0, 6) * 60 * 60 * 1000;
    items.push({
      author,
      whenLabel: formatDaysAgo(daysAgo),
      text: template.replaceAll("{name}", card.name),
      createdAt,
    });
  }

  return items.sort((left, right) => right.createdAt - left.createdAt);
}

function buildTodaySchedule(card: ShowcaseCard) {
  const stats = buildStats(card);
  const random = createRandom(`today:${card.id}:${card.name}`);
  const available = new Set<number>();

  while (available.size < 4) {
    available.add(getRandomInt(random, 0, todaySlots.length - 1));
  }

  const busySlot = todaySlots.find((_, index) => !available.has(index)) ?? todaySlots[4];
  const freeSlots = [...available].sort((left, right) => left - right).map((index) => todaySlots[index]);

  return [
    `<b>📅 РАСПИСАНИЕ ${escapeHtml(card.name.toUpperCase())} НА СЕГОДНЯ</b>`,
    "",
    "<b>🟢 СВОБОДНО:</b>",
    ...freeSlots.map((slot) => `• ${escapeHtml(slot)}`),
    "",
    "<b>🔴 ЗАНЯТО:</b>",
    `• ${escapeHtml(busySlot)}`,
    "",
    "<b>⚡ ГОРЯЧЕЕ ПРЕДЛОЖЕНИЕ:</b>",
    `Слот ${escapeHtml(stats.hotOfferSlot)} со скидкой ${stats.hotOfferDiscount}%!`,
    `(осталось ${stats.hotOfferMinutesLeft} минут)`,
    "",
    `🔥 Популярность сегодня: ${stats.popularity}/10`,
    `👀 Сейчас смотрят: ${stats.liveViewers} клиента`,
  ].join("\n");
}

function buildWeekSchedule(card: ShowcaseCard) {
  const random = createRandom(`week:${card.id}:${card.name}`);
  const lines: string[] = [`<b>📅 РАСПИСАНИЕ ${escapeHtml(card.name.toUpperCase())} НА НЕДЕЛЮ</b>`, ""];

  weekDayLabels.forEach((label, index) => {
    lines.push(`📍 <b>${label}:</b>`);

    const isDayOff = index >= 4 && getRandomInt(random, 0, 3) === 0;
    if (isDayOff) {
      lines.push("❌ Выходной день", "");
      return;
    }

    const slotsCount = getRandomInt(random, 2, 4);
    const used = new Set<number>();
    while (used.size < slotsCount) {
      used.add(getRandomInt(random, 0, todaySlots.length - 1));
    }

    [...used]
      .sort((left, right) => left - right)
      .forEach((slotIndex) => {
        const discount = getRandomInt(random, 9, 22);
        lines.push(`• ${escapeHtml(todaySlots[slotIndex])} -${discount}%`);
      });

    lines.push("");
  });

  return lines.join("\n");
}

export function buildModelCardText(card: CardWithPhotos) {
  const stats = buildStats(card);

  return [
    `💘 <b>${escapeHtml(card.name)}</b> (${card.age}) (${escapeHtml(card.city)})`,
    "",
    "✅ Верифицированная модель",
    `🆔 ID проверки: ${stats.verificationId}`,
    "",
    "<b>⭐ СТАТИСТИКА:</b>",
    `🌟 Рейтинг: ${stats.rating}/5.0 (${stats.reviewsCount} отзывов)`,
    `📊 Проектов проведено: ${stats.completedProjects}+`,
    `💬 Положительных отзывов: ${stats.positivePercent}%`,
    `🔥 Постоянных клиентов: ${stats.regularClients}`,
    "",
    "<b>🏆 СТОИМОСТЬ УЧАСТИЯ:</b>",
    `⏰ 1 час: ${formatPreciseMoney(card.price_1h)}`,
    `🏙 3 часа: ${formatPreciseMoney(card.price_3h)}`,
    `🌃 Смена: ${formatPreciseMoney(card.price_full_day)}`,
    "",
    "✅ Для оформления нажмите на кнопку «Оформить»",
  ].join("\n");
}

export function buildModelCertificateText(card: CardWithPhotos) {
  const stats = buildStats(card);

  return [
    `<b>🏅 СЕРТИФИКАТ СООТВЕТСТВИЯ ${stats.verificationId}</b>`,
    "",
    `Модель: ${escapeHtml(card.name)}`,
    `Возраст: ${card.age} лет`,
    `Город: ${escapeHtml(card.city)}`,
    "",
    "✅ Фото соответствует действительности",
    "✅ Личность подтверждена документами",
    "✅ Медицинские справки актуальны",
    "✅ Профессиональная фотосессия",
    "",
    `🗓 Выдан: ${stats.issuedAt}`,
    `🔄 Следующая проверка: ${stats.nextCheckAt}`,
    `🔐 Цифровая подпись: ${stats.signature}`,
  ].join("\n");
}

export function buildModelReviewsText(card: CardWithPhotos, page = 1, limit = 3) {
  const stats = buildStats(card);
  const reviews = buildModelReviews(card);
  const offset = Math.max(0, (page - 1) * limit);
  const pageItems = reviews.slice(offset, offset + limit);
  const lines = [
    `<b>⭐ ОТЗЫВЫ О ${escapeHtml(card.name.toUpperCase())}</b>`,
    "",
    `📊 Рейтинг: ${stats.rating}/5.0`,
    `💬 Отзывов: ${stats.reviewsCount}`,
    `📈 Положительные: ${stats.positivePercent}%`,
    "",
  ];

  pageItems.forEach((review, index) => {
    lines.push(
      `<b>${offset + index + 1}. ${escapeHtml(review.author)}</b>`,
      `⭐ 5/5 • ${escapeHtml(review.whenLabel)}`,
      `"${escapeHtml(review.text)}"`,
      "",
    );
  });

  return {
    text: lines.join("\n").trim(),
    hasPrev: page > 1,
    hasNext: offset + limit < reviews.length,
  };
}

export function buildScheduleText(card: CardWithPhotos, mode: ScheduleMode) {
  return mode === "week" ? buildWeekSchedule(card) : buildTodaySchedule(card);
}

export function buildPrebookingText() {
  return [
    "<b>📋 ПРЕДВАРИТЕЛЬНОЕ БРОНИРОВАНИЕ</b>",
    "",
    "🌇 Завтра со скидкой 15%",
    "📅 Неделя вперёд со скидкой 20%",
    "🌙 Вечерние слоты дешевле на 25%",
    "🌅 Утренние слоты: скидка 20%",
    "",
    "⚡ Бронируйте заранее и экономьте!",
  ].join("\n");
}

export function buildPaymentText(cashAvailable: boolean) {
  return [
    "<b>💘 Выберите способ оплаты:</b>",
    "",
    cashAvailable ? "💵 Наличные доступны для повторного оформления." : "💵 Наличные откроются после 1 успешной встречи.",
    "💳 Баланс бота доступен сейчас.",
  ].join("\n");
}

function buildGeneratedFeedItem(card: ShowcaseCard, review: ModelReview) {
  const stats = buildStats(card);
  return {
    createdAt: review.createdAt,
    html: [
      `<b>⭐ ${escapeHtml(card.name)} · ${escapeHtml(card.city)}</b>`,
      `Рейтинг: ${stats.rating}/5.0`,
      `Положительные отзывы: ${stats.positivePercent}%`,
      "",
      `<b>${escapeHtml(review.author)}</b> • ${escapeHtml(review.whenLabel)}`,
      escapeHtml(review.text),
    ].join("\n"),
  };
}

export async function listReviewFeed(page = 1, limit = 5) {
  const db = await getDb();
  const cards = await db.all<Card[]>("SELECT * FROM cards WHERE is_active = 1 ORDER BY created_at DESC LIMIT 80");
  const storedReviews = await db.all<Array<{ text: string; created_at: string; username: string | null; first_name: string | null }>>(
    `SELECT reviews.text, reviews.created_at, users.username, users.first_name
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     ORDER BY reviews.created_at DESC
     LIMIT 40`,
  );

  const generatedItems = cards.flatMap((card) =>
    buildModelReviews(card)
      .slice(0, 2)
      .map((review) => buildGeneratedFeedItem(card, review)),
  );

  const storedItems: ReviewFeedItem[] = storedReviews.map((item) => ({
    createdAt: Date.parse(item.created_at),
    html: [
      "<b>⭐ Отзыв клиента (Измененные в целях соблюдения политики Telegram)</b>",
      `${escapeHtml(item.username ? `@${item.username}` : item.first_name || "Гость сервиса")}`,
      "",
      escapeHtml(item.text),
    ].join("\n"),
  }));

  const items = [...storedItems, ...generatedItems].sort((left, right) => right.createdAt - left.createdAt);
  const offset = (page - 1) * limit;
  const slice = items.slice(offset, offset + limit + 1);

  return {
    items: slice.slice(0, limit).map((item) => item.html),
    hasNext: slice.length > limit,
  };
}
