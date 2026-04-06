import { Telegram } from "telegraf";
import { config } from "../config/env";

let teambotTelegram: Telegram | null = null;
let servicebotTelegram: Telegram | null = null;

export function getTeambotTelegram() {
  if (!config.teambotToken) {
    throw new Error("Не задан TEAMBOT_TOKEN для отправки уведомлений через teambot.");
  }

  if (!teambotTelegram) {
    teambotTelegram = new Telegram(config.teambotToken);
  }

  return teambotTelegram;
}

export function getServicebotTelegram() {
  if (!config.servicebotToken) {
    throw new Error("Не задан SERVICEBOT_TOKEN для отправки уведомлений через servicebot.");
  }

  if (!servicebotTelegram) {
    servicebotTelegram = new Telegram(config.servicebotToken);
  }

  return servicebotTelegram;
}
