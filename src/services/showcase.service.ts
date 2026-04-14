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

const displayReviewAuthors = [
  "Anatoly S.",
  "Fedor V.",
  "Vladimir N.",
  "Nikolay B.",
  "Aleksandr K.",
  "Oleg D.",
  "Timur A.",
  "Grigoriy L.",
  "Boris N.",
  "Kirill D.",
  "Mikhail L.",
  "Pavel R.",
];
const legacyReviewTemplates = [
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

const reviewTemplates = [
  "На выходных забронировал встречу с {name}, всё прошло идеально. Очень приятная в общении и лёгкая по атмосфере, время пролетело незаметно.",
  "Приехал к {name} без завышенных ожиданий, а в итоге получил одну из самых комфортных встреч 1 на 1. Спокойно, тепло и без лишней суеты.",
  "С {name} всё было по договорённости и без накладок. Очень доброжелательная, внимательная к деталям и умеет поддержать разговор.",
  "Личная встреча с {name} прошла на отличном уровне. Чувствуется уверенность, спокойствие и умение создать комфорт с первых минут.",
  "У {name} приятная подача и очень лёгкое общение. Вживую произвела даже лучшее впечатление, чем ожидал.",
  "Провёл время с {name} максимально комфортно. Она тактичная, деликатная и умеет держать правильную атмосферу 1 на 1.",
  "Свидание с {name} получилось ровным, спокойным и очень приятным. Без спешки, без неудобства, всё прошло легко.",
  "{name} полностью соответствует фото и ожиданиям. В общении мягкая, внимательная и очень располагает к себе.",
  "Встреча с {name} оставила только хорошие эмоции. Чувствуется уровень, уверенность и умение сделать общение живым и комфортным.",
  "Если нужен приятный формат встречи 1 на 1, {name} точно хороший выбор. Всё аккуратно, спокойно и с правильным настроением.",
  "С {name} было легко с первой минуты. Очень приятная энергетика, хороший диалог и ощущение, что всё идёт естественно.",
  "Провёл время с {name} без лишней суеты и напряжения. Очень комфортная личная встреча, после которой остались только хорошие впечатления.",
];

const neutralReviewTemplates = [
  "Встреча прошла спокойно и очень комфортно. Всё было без суеты, с приятной атмосферой и нормальным общением.",
  "Одна из самых удачных личных встреч за последнее время. Всё аккуратно, вовремя и без неприятных сюрпризов.",
  "Ожидания полностью совпали с реальностью. Лёгкое общение, хорошая подача и приятное впечатление после встречи.",
  "Формат 1 на 1 прошёл именно так, как хотелось: без напряжения, с хорошим диалогом и комфортной атмосферой.",
  "Всё было по договорённости и без накладок. Очень приятная встреча, после которой остались только хорошие эмоции.",
  "С первых минут было легко и спокойно. Хорошее общение, уверенная подача и очень комфортная атмосфера.",
  "Личная встреча прошла на хорошем уровне. Всё аккуратно, деликатно и с вниманием к деталям.",
  "Время пролетело незаметно. Очень приятная энергетика, живой разговор и ощущение полного комфорта.",
  "Отличный вариант для спокойной личной встречи. Всё прошло ровно, без лишней спешки и неудобств.",
  "Вживую впечатление оказалось даже лучше ожиданий. Комфортная атмосфера, приятное общение и хороший уровень.",
  "Остался доволен форматом встречи. Всё естественно, спокойно и без ощущения чего-то наигранного.",
  "Хорошая личная встреча 1 на 1. Без лишних слов, просто комфортно, приятно и с правильной атмосферой.",
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getAgeStatFactor(age: number) {
  const normalized = clamp((age - 18) / 12, 0, 1);
  return 0.38 + normalized * 0.62;
}

function scaleStat(value: number, factor: number, minimum: number) {
  return Math.max(minimum, Math.round(value * factor));
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
  const ageFactor = getAgeStatFactor(card.age);
  const verificationNumber = getRandomInt(random, 41000, 89999);
  const issuedAt = new Date();
  issuedAt.setDate(issuedAt.getDate() - getRandomInt(random, 6, 28));
  const nextCheckAt = new Date(issuedAt);
  nextCheckAt.setDate(nextCheckAt.getDate() + getRandomInt(random, 21, 36));
  const ratingValue = clamp(getRandomInt(random, 45, 47) + Math.round(ageFactor * 3), 45, 50);
  const completedMeetings = scaleStat(getRandomInt(random, 58, 214), ageFactor, 24);
  const reviewsCount = Math.min(completedMeetings, scaleStat(getRandomInt(random, 18, 132), ageFactor, 8));

  return {
    verificationId: `LUX-${verificationNumber}`,
    rating: (ratingValue / 10).toFixed(1),
    reviewsCount,
    completedProjects: completedMeetings,
    positivePercent: clamp(getRandomInt(random, 92, 95) + Math.round(ageFactor * 4), 92, 99),
    regularClients: scaleStat(getRandomInt(random, 12, 34), 0.45 + ageFactor * 0.55, 4),
    issuedAt: formatRuDate(issuedAt),
    nextCheckAt: formatRuDate(nextCheckAt),
    signature: `HB${verificationNumber}${getRandomInt(random, 100000, 999999)}`,
    hotOfferDiscount: getRandomInt(random, 11, 25),
    hotOfferSlot: todaySlots[getRandomInt(random, 1, 3)],
    hotOfferMinutesLeft: getRandomInt(random, 19, 58),
    popularity: clamp(getRandomInt(random, 5, 7) + Math.round(ageFactor * 3), 5, 10),
    liveViewers: clamp(getRandomInt(random, 1, 2) + Math.round(ageFactor * 2), 1, 4),
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
    let author = displayReviewAuthors[getRandomInt(random, 0, displayReviewAuthors.length - 1)];
    while (usedAuthors.has(author)) {
      author = displayReviewAuthors[getRandomInt(random, 0, displayReviewAuthors.length - 1)];
    }
    usedAuthors.add(author);

    const template = neutralReviewTemplates[getRandomInt(random, 0, neutralReviewTemplates.length - 1)];
    const daysAgo = getRandomInt(random, 1, 7) + index;
    const createdAt = Date.now() - daysAgo * 24 * 60 * 60 * 1000 - getRandomInt(random, 0, 6) * 60 * 60 * 1000;
    items.push({
      author,
      whenLabel: formatDaysAgo(daysAgo),
      text: template,
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
    `📊 Встреч проведено: ${stats.completedProjects}+`,
    `💬 Положительных отзывов: ${stats.positivePercent}%`,
    `🔥 Постоянных клиентов: ${stats.regularClients}`,
    "",
    "<b>?? ???????:</b>",
    "? ?????? ???????????? ?????????????? ????????? ?? 5,000 RUB.",
    "? ???????? ????????????? ?????????? ?? ????????????? ?????????? ???????.",
    "? ????? ????????? ??????? ?????? ???????? ?????? ?????????????.",
    "",
    "<b>? ????????:</b>",
    "? ???????????????? ?????? ??????? ???????? ?? ???????.",
    "? ??? ?????????????? ??????? ???????? ???????????? ????? ???????? ????? ?????????.",
    "",
    "<b>🏆 СТОИМОСТЬ ВСТРЕЧИ:</b>",
    `⏰ 1 час: ${formatPreciseMoney(card.price_1h)}`,
    `🏙 3 часа: ${formatPreciseMoney(card.price_3h)}`,
    `🌃 Смена: ${formatPreciseMoney(card.price_full_day)}`,
    "",
    "✅ Для оформления нажмите на кнопку «Оформить»",
  ].join("\n");
}


export function buildModelSafetyPolicyText() {
  return [
    "<b>?? ???????? ???????????? ? ??????? ??????????</b>",
    "",
    "????????? ????????????!",
    "",
    "????????? Honey Bunny ??????? ??? ??????????? ? ??????????? ??????? ????? ????????????????? ??????????????.",
    "?? ??????? ???????? ??????????? ?????, ???????????? ???????????? ? ?????? ???????????.",
    "",
    "<b>??????? ??????? ??????????:</b>",
    "? ????????????? ??????????? ????????? ??????????? ????? ??????? ? ?????????? ??????.",
    "? ???????? ????????????? ???????? ??? ??????????? ??????? ?? ????????????? ?????????? ???????.",
    "? ?????? ???????? ????????, ? ?????????????? ?????????????? ?????? ???????? ?? ??????? ????? ?????????.",
    "? ?????? ?????? ???????????? ?? ????????????? ????? ???????????? ???????? ??? ?????? ?????????.",
    "",
    "<b>?????????? ???????:</b>",
    "????? ??????? ??????? ???????????? ?????????? ????????? ????????? ??????????? ??????? ???????????? ??? ?????????? ?????????????.",
    "????????? ??????? ????? ????????????? ?? ????? ?????? ???????? ?????? ???????.",
    "",
    "<b>???????? ????????????:</b>",
    "???? ??????? ?? ????????????? ???????? ????????????, ???????????? ????? ???????? ??????? ? ?????????? ? ????????? ??? ???????? ???????? ? ???????? ??????? ?? ???????? ?????????.",
    "",
    "?????? ?????? Honey Bunny ???????? ?????????????.",
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
