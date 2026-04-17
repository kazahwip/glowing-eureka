import type { Telegraf } from "telegraf";
import { BACK_BUTTON, SERVICEBOT_MAIN_MENU, WORKER_PANEL_MENU } from "../../config/constants";
import { getCardById } from "../../services/cards.service";
import { linkClientToWorker } from "../../services/clients.service";
import { toggleFavorite } from "../../services/favorites.service";
import { cardDetailKeyboard } from "../../keyboards/servicebot";
import { sendServicebotAuditEvent } from "../../services/servicebot-audit.service";
import { assignReferralOwner, notifyWorkerAboutClientAction, parseReferralPayload } from "../../services/referrals.service";
import { buildModelCardText } from "../../services/showcase.service";
import { grantWorkerAccess, registerServicebotUser } from "../../services/users.service";
import type { AppContext } from "../../types/context";
import type { WorkerSignalCategory } from "../../types/entities";
import {
  handlePaymentChoice,
  showCardDetails,
  showCategoryCardsPreview,
  showCategorySelection,
  showCatalogScreen,
  showCityCards,
  showCitySelection,
  showClubScreen,
  showFavoriteCardsScreen,
  showInfoRoot,
  showInfoSection,
  showModelCertificate,
  showModelSafetyPolicy,
  showModelReviews,
  showModelSchedule,
  showPaymentScreen,
  showPrebookingScreen,
  showProfilePlaceholder,
  showReviewsPage,
  showServiceProfile,
  showServicebotHome,
  showSupportScreen,
  showWorkerClientsScreen,
  showWorkerHome,
} from "./views";

async function answerCallback(ctx: AppContext) {
  if ("callbackQuery" in ctx.update) {
    await ctx.answerCbQuery().catch(() => undefined);
  }
}

function hasWorkerAccess(ctx: AppContext) {
  const user = ctx.state.user;
  if (!user) {
    return false;
  }

  return user.has_worker_access === 1 || ["worker", "admin", "curator"].includes(user.role);
}

function getStartPayload(ctx: AppContext) {
  if (!ctx.message || !("text" in ctx.message)) {
    return null;
  }

  const [, ...parts] = ctx.message.text.trim().split(/\s+/);
  return parts.join(" ").trim() || null;
}

function getCategoryLabel(category: "girls" | "pepper") {
  return category === "pepper" ? "Девушки с перчиком" : "Девушки";
}

function parseInlineCardQuery(query: string) {
  const normalized = query.trim();
  const match = normalized.match(/^#?(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function trackRefAction(ctx: AppContext, category: WorkerSignalCategory, action: string, details?: string) {
  const user = ctx.state.user;
  if (!user?.referred_by_user_id || !ctx.from) {
    return;
  }

  await linkClientToWorker(user.referred_by_user_id, ctx.from.id, ctx.from.username);
  await notifyWorkerAboutClientAction(user.referred_by_user_id, {
    clientTelegramId: ctx.from.id,
    clientUsername: ctx.from.username,
    category,
    action,
    details,
  });
}

async function trackAuditAction(ctx: AppContext, action: string, details?: string) {
  if (!ctx.from) {
    return;
  }

  await sendServicebotAuditEvent({
    telegramId: ctx.from.id,
    username: ctx.from.username,
    action,
    details,
  });
}

async function handleStartReferral(ctx: AppContext) {
  const user = ctx.state.user;
  const payload = parseReferralPayload(getStartPayload(ctx));
  if (!user || !payload || !ctx.from) {
    return;
  }

  const previousReferrerId = user.referred_by_user_id;
  const updatedUser = await assignReferralOwner(user, payload);
  ctx.state.user = updatedUser ?? undefined;

  if (!updatedUser?.referred_by_user_id || updatedUser.referred_by_user_id !== payload) {
    return;
  }

  const action =
    previousReferrerId === payload ? "Мамонт повторно открыл реферальную ссылку" : "Новый мамонт перешёл по реферальной ссылке";

  await notifyWorkerAboutClientAction(payload, {
    clientTelegramId: ctx.from.id,
    clientUsername: ctx.from.username,
    category: "referrals",
    action,
  });
}

export function registerServicebotHandlers(bot: Telegraf<AppContext>) {
  bot.on("inline_query", async (ctx) => {
    await sendServicebotAuditEvent({
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

    const card = await getCardById(cardId);
    if (!card) {
      await ctx.answerInlineQuery([], { cache_time: 0, is_personal: true });
      return;
    }

    const keyboard = cardDetailKeyboard(card.id, false, 0);
    await ctx.answerInlineQuery(
      [
        {
          type: "article",
          id: `card:${card.id}`,
          title: `${card.name}, ${card.age}`,
          description: `${card.city} ? ${card.price_1h} RUB / 1 ???`,
          input_message_content: {
            message_text: buildModelCardText(card),
            parse_mode: "HTML",
          },
          reply_markup: keyboard.reply_markup,
        },
      ],
      { cache_time: 0, is_personal: true },
    );
  });
  bot.start(async (ctx) => {
    if (!ctx.from) {
      return;
    }

    const user = await registerServicebotUser({
      telegramId: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
    });

    ctx.state.user = user ?? undefined;
    await handleStartReferral(ctx);
    await trackAuditAction(ctx, "/start");
    await showServicebotHome(ctx);
  });

  bot.command("awake", async (ctx) => {
    if (!ctx.from) {
      return;
    }

    await grantWorkerAccess(ctx.from.id);
    ctx.state.user = await registerServicebotUser({
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

    await showWorkerHome(ctx);
  });

  bot.hears(SERVICEBOT_MAIN_MENU[0], showCatalogScreen);
  bot.hears(SERVICEBOT_MAIN_MENU[1], showClubScreen);
  bot.hears(SERVICEBOT_MAIN_MENU[2], async (ctx) => showReviewsPage(ctx, 1));
  bot.hears(SERVICEBOT_MAIN_MENU[3], showServiceProfile);
  bot.hears(SERVICEBOT_MAIN_MENU[4], showCategorySelection);
  bot.hears(SERVICEBOT_MAIN_MENU[5], showSupportScreen);
  bot.hears(SERVICEBOT_MAIN_MENU[6], showInfoRoot);

  bot.hears(WORKER_PANEL_MENU[0], async (ctx) => {
    if (!hasWorkerAccess(ctx)) {
      await ctx.reply("Воркер-панель недоступна.");
      return;
    }

    await ctx.scene.enter("worker-broadcast");
  });

  bot.hears(WORKER_PANEL_MENU[1], async (ctx) => {
    if (!hasWorkerAccess(ctx)) {
      await ctx.reply("Воркер-панель недоступна.");
      return;
    }

    await showWorkerClientsScreen(ctx);
  });

  bot.hears(WORKER_PANEL_MENU[2], async (ctx) => {
    if (!hasWorkerAccess(ctx)) {
      await ctx.reply("Воркер-панель недоступна.");
      return;
    }

    await ctx.scene.enter("worker-add-card");
  });

  bot.hears(BACK_BUTTON, showServicebotHome);

  bot.action("service:home", async (ctx) => {
    await answerCallback(ctx);
    await trackAuditAction(ctx, "opened_home");
    await showServicebotHome(ctx);
  });

  bot.action("service:catalog", async (ctx) => {
    await answerCallback(ctx);
    await trackRefAction(ctx, "navigation", "Открыл вкладку VIP модели");
    await trackAuditAction(ctx, "opened_catalog");
    await showCatalogScreen(ctx);
  });

  bot.action("service:club", async (ctx) => {
    await answerCallback(ctx);
    await trackRefAction(ctx, "navigation", "Открыл вкладку VIP клуб");
    await trackAuditAction(ctx, "opened_club");
    await showClubScreen(ctx);
  });

  bot.action("service:profile", async (ctx) => {
    await answerCallback(ctx);
    await trackRefAction(ctx, "navigation", "Открыл вкладку Мой профиль");
    await trackAuditAction(ctx, "opened_profile");
    await showServiceProfile(ctx);
  });

  bot.action("service:search", async (ctx) => {
    await answerCallback(ctx);
    await trackRefAction(ctx, "navigation", "Открыл вкладку Найти девушку");
    await trackAuditAction(ctx, "opened_search");
    await showCategorySelection(ctx);
  });

  bot.action("service:cities:noop", async (ctx) => {
    await answerCallback(ctx);
  });

  bot.action("service:cards:noop", async (ctx) => {
    await answerCallback(ctx);
  });

  bot.action(/^service:category:(girls|pepper)$/, async (ctx) => {
    await answerCallback(ctx);
    const category = ctx.match[1] as "girls" | "pepper";
    await trackRefAction(ctx, "search", "Выбрал раздел анкет", getCategoryLabel(category));
    await trackAuditAction(ctx, "selected_category", category);
    await showCitySelection(ctx, category);
  });

  bot.action(/^service:city:(.+)$/, async (ctx) => {
    await answerCallback(ctx);
    const city = ctx.match[1];
    ctx.session.searchDraft = { ...ctx.session.searchDraft, city, page: 1 };
    await trackRefAction(ctx, "search", "Выбрал город", city);
    await trackAuditAction(ctx, "selected_city", city);
    await showCityCards(ctx, city);
  });

  bot.action(/^service:cards:page:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    const city = ctx.session.searchDraft?.city;
    if (!city) {
      await showCategorySelection(ctx);
      return;
    }

    ctx.session.searchDraft = { ...ctx.session.searchDraft, city, page: Number(ctx.match[1]) };
    await showCityCards(ctx, city);
  });

  bot.action("service:search-back", async (ctx) => {
    await answerCallback(ctx);
    const city = ctx.session.searchDraft?.city;
    if (city) {
      await showCityCards(ctx, city);
      return;
    }

    const category = ctx.session.searchDraft?.category;
    if (category) {
      await showCategoryCardsPreview(ctx, category);
      return;
    }

    await showCategorySelection(ctx);
  });

  bot.action(/^service:card:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    const cardId = Number(ctx.match[1]);
    const card = await getCardById(cardId);
    if (card) {
      await trackRefAction(ctx, "search", "Открыл анкету модели", `${card.name}, ${card.age} | ${card.city}`);
      await trackAuditAction(ctx, "opened_card", `card_id=${card.id}; ${card.name}, ${card.age}; ${card.city}`);
    }
    await showCardDetails(ctx, cardId);
  });

  bot.action(/^service:card:photo:(\d+):(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await showCardDetails(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
  });

  bot.action(/^service:favorite:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    const user = ctx.state.user;
    if (!user) {
      await ctx.reply("Сначала выполните /start.");
      return;
    }

    await toggleFavorite(user.id, Number(ctx.match[1]));
    await trackAuditAction(ctx, "toggled_favorite", `card_id=${Number(ctx.match[1])}`);
    await showCardDetails(ctx, Number(ctx.match[1]));
  });

  bot.action(/^service:certificate:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await showModelCertificate(ctx, Number(ctx.match[1]));
  });

  bot.action(/^service:safety-policy:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await showModelSafetyPolicy(ctx, Number(ctx.match[1]));
  });

  bot.action(/^service:model-reviews:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await showModelReviews(ctx, Number(ctx.match[1]), 1);
  });

  bot.action(/^service:model-reviews:(\d+):(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await showModelReviews(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
  });

  bot.action(/^service:schedule:(today|week):(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await showModelSchedule(ctx, Number(ctx.match[2]), ctx.match[1] as "today" | "week");
  });

  bot.action(/^service:booking:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await trackAuditAction(ctx, "opened_prebooking", `card_id=${Number(ctx.match[1])}`);
    await showPrebookingScreen(ctx, Number(ctx.match[1]));
  });

  bot.action(/^service:payment:open:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    const card = await getCardById(Number(ctx.match[1]));
    if (card) {
      await trackRefAction(ctx, "payments", "Перешёл к оплате", `${card.name}, ${card.age} | ${card.city}`);
      await trackAuditAction(ctx, "opened_payment", `card_id=${card.id}; ${card.name}, ${card.city}`);
    }
    await showPaymentScreen(ctx, Number(ctx.match[1]));
  });

  bot.action(/^service:payment:(cash|bot_balance):(\d+)$/, async (ctx) => {
    await handlePaymentChoice(ctx, Number(ctx.match[2]), ctx.match[1] as "cash" | "bot_balance");
  });

  bot.action("service:profile:topup", async (ctx) => {
    await answerCallback(ctx);
    await trackRefAction(ctx, "payments", "Собирается пополнять баланс");
    await trackAuditAction(ctx, "started_topup");
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
    await showProfilePlaceholder(ctx, "🎁 Промокод", "Раздел промокодов подготовлен для следующей интеграции.");
  });

  bot.action("service:profile:loyalty", async (ctx) => {
    await answerCallback(ctx);
    await showInfoSection(ctx, "loyalty");
  });

  bot.action("service:profile:recommendations", async (ctx) => {
    await answerCallback(ctx);
    await showInfoSection(ctx, "recommendations");
  });

  bot.action("service:profile:favorites", async (ctx) => {
    await answerCallback(ctx);
    await showFavoriteCardsScreen(ctx);
  });

  bot.action(/^service:reviews:page:(\d+)$/, async (ctx) => {
    await answerCallback(ctx);
    await showReviewsPage(ctx, Number(ctx.match[1]));
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
    await showSupportScreen(ctx);
  });

  bot.action("service:info:root", async (ctx) => {
    await answerCallback(ctx);
    await trackRefAction(ctx, "navigation", "Открыл вкладку Информация");
    await trackAuditAction(ctx, "opened_info");
    await showInfoRoot(ctx);
  });

  bot.action(
    /^service:info:(safety|tech|legal|finance|data|verification|emergency|awards|loyalty|recommendations|premium_support|agreement)$/,
    async (ctx) => {
      await answerCallback(ctx);
      await showInfoSection(
        ctx,
        ctx.match[1] as
          | "safety"
          | "tech"
          | "legal"
          | "finance"
          | "data"
          | "verification"
          | "emergency"
          | "awards"
          | "loyalty"
          | "recommendations"
          | "premium_support"
          | "agreement",
      );
    },
  );

  bot.action("service:worker:home", async (ctx) => {
    await answerCallback(ctx);
    if (!hasWorkerAccess(ctx)) {
      await ctx.reply("Воркер-панель недоступна.");
      return;
    }

    await showWorkerHome(ctx);
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
