import { Markup } from "telegraf";
import { BACK_BUTTON } from "../config/constants";

export function backKeyboard() {
  return Markup.keyboard([[BACK_BUTTON]]).resize();
}

export function closeInlineKeyboard() {
  return Markup.inlineKeyboard([Markup.button.callback("✖️ Закрыть", "common:close")]);
}

export function backInlineKeyboard(callbackData: string) {
  return Markup.inlineKeyboard([Markup.button.callback(BACK_BUTTON, callbackData)]);
}
