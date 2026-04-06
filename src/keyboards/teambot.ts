import { Markup } from "telegraf";
import { BACK_BUTTON, TEAMBOT_MAIN_MENU, TEAM_WORK_MENU } from "../config/constants";

export function teambotMainMenuKeyboard() {
  return Markup.keyboard([
    [TEAMBOT_MAIN_MENU[0], TEAMBOT_MAIN_MENU[2]],
    [TEAMBOT_MAIN_MENU[1], TEAMBOT_MAIN_MENU[3]],
    [TEAMBOT_MAIN_MENU[4]],
  ]).resize();
}

export function teambotMainMenuInlineKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[0], "team:menu:work"),
      Markup.button.callback(TEAMBOT_MAIN_MENU[2], "team:menu:profile"),
    ],
    [
      Markup.button.callback(TEAMBOT_MAIN_MENU[1], "team:menu:transfer"),
      Markup.button.callback(TEAMBOT_MAIN_MENU[3], "team:menu:curators"),
    ],
    [Markup.button.callback(TEAMBOT_MAIN_MENU[4], "team:menu:project")],
  ]);
}

export function teamWorkKeyboard() {
  return Markup.keyboard([
    [TEAM_WORK_MENU[0], TEAM_WORK_MENU[1]],
    [TEAM_WORK_MENU[2], TEAM_WORK_MENU[3]],
  ]).resize();
}

export function teambotBackKeyboard() {
  return Markup.keyboard([[BACK_BUTTON]]).resize();
}

