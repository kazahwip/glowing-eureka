import { config } from "../config/env";
import type { CardCategory, CardWithPhotos, Curator, ProjectStats, User } from "../types/entities";
import { daysBetween, formatDate } from "./date";

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number) {
  return `${moneyFormatter.format(amount)} RUB`;
}

export function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function formatUserLabel(user: Pick<User, "first_name" | "username" | "telegram_id">) {
  if (user.username) {
    return `@${user.username}`;
  }

  return user.first_name || String(user.telegram_id);
}

export function getRoleTitle(role: User["role"]) {
  switch (role) {
    case "admin":
      return "🛡 Администратор";
    case "curator":
      return "🧑‍💼 Куратор";
    case "worker":
      return "💼 Воркер";
    default:
      return "🐘 Мамонт";
  }
}

export function getCardCategoryTitle(category: CardCategory) {
  return category === "pepper" ? "Девушки с перчиком" : "Девушки";
}

export function getLevelTitle(totalProfit: number) {
  if (totalProfit >= 500_000) {
    return "Платиновый";
  }

  if (totalProfit >= 100_000) {
    return "Продвинутый";
  }

  return "Начальный";
}

export function buildTeamProfileText(user: User, totalProfits = 0) {
  return [
    "<b>👤 Профиль сотрудника</b>",
    "",
    `🆔 Telegram ID: <code>${user.telegram_id}</code>`,
    `🏅 Уровень: ${getLevelTitle(user.total_profit)}`,
    `📈 Количество профитов: ${totalProfits}`,
    `💸 Сумма профитов: ${formatMoney(user.total_profit)}`,
    `📊 Средний профит: ${formatMoney(user.avg_profit)}`,
    `🏆 Рекордный профит: ${formatMoney(user.best_profit)}`,
    `💼 Баланс AWAKE BOT: ${formatMoney(user.withdrawable_balance)}`,
    `\uD83E\uDDEE \u0414\u043E\u043B\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u044B: ${user.role === "admin" ? "100%" : "25%"}`,
    `📌 Статус: ${getRoleTitle(user.role)}`,
    `🗓 В команде: ${daysBetween(user.created_at)} дн.`,
  ].join("\n");
}

export function buildProjectInfoText(stats: ProjectStats) {
  return [
    "<b>ℹ️ О проекте</b>",
    "",
    `🎂 День рождения команды: ${formatDate(config.projectStartDate)}`,
    `📈 Подтверждено профитов: ${stats.totalProfits}`,
    `💸 Сумма профитов: ${formatMoney(stats.totalProfitAmount)}`,
    "",
    "<b>💳 Выплаты</b>",
    `Профит: ${stats.payoutPercent}%`,
    "Состояние сервисов: Ворк",
  ].join("\n");
}

export function buildCuratorText(curator?: Curator | null) {
  if (!curator) {
    return [
      "<b>🧑‍💼 Система кураторов</b>",
      "",
      "У вас пока нет назначенного куратора.",
      "Кураторы будут добавлены позже.",
    ].join("\n");
  }

  return [
    "<b>🧑‍💼 Система кураторов</b>",
    "",
    `Куратор: <b>${escapeHtml(curator.name)}</b>`,
    curator.description ? `Описание: ${escapeHtml(curator.description)}` : "Описание пока не заполнено.",
  ].join("\n");
}

export function buildCardText(card: CardWithPhotos) {
  const lines = [
    `<b>${escapeHtml(card.name)}</b>, ${card.age}`,
    "",
    `Раздел: ${escapeHtml(getCardCategoryTitle(card.category))}`,
    `Город: ${escapeHtml(card.city)}`,
  ];

  if (card.description) {
    lines.push(`Описание: ${escapeHtml(card.description)}`);
  }

  lines.push(
    "",
    `1 час: ${formatMoney(card.price_1h)}`,
    `3 часа: ${formatMoney(card.price_3h)}`,
    `Весь день: ${formatMoney(card.price_full_day)}`,
  );

  return lines.join("\n");
}

export function buildServiceProfileText(user: User) {
  return [
    "<b>👤 Мой профиль</b>",
    "",
    `🆔 Telegram ID: <code>${user.telegram_id}</code>`,
    `💼 Баланс: ${formatMoney(user.balance)}`,
    `🗓 Дата регистрации: ${formatDate(user.created_at)}`,
  ].join("\n");
}
