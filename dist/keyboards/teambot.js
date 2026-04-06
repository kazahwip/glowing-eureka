"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teambotMainMenuKeyboard = teambotMainMenuKeyboard;
exports.teambotMainMenuInlineKeyboard = teambotMainMenuInlineKeyboard;
exports.teamWorkKeyboard = teamWorkKeyboard;
exports.teambotBackKeyboard = teambotBackKeyboard;
const telegraf_1 = require("telegraf");
const constants_1 = require("../config/constants");
function teambotMainMenuKeyboard() {
    return telegraf_1.Markup.keyboard([
        [constants_1.TEAMBOT_MAIN_MENU[0], constants_1.TEAMBOT_MAIN_MENU[2]],
        [constants_1.TEAMBOT_MAIN_MENU[1], constants_1.TEAMBOT_MAIN_MENU[3]],
        [constants_1.TEAMBOT_MAIN_MENU[4]],
    ]).resize();
}
function teambotMainMenuInlineKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([
        [
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[0], "team:menu:work"),
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[2], "team:menu:profile"),
        ],
        [
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[1], "team:menu:transfer"),
            telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[3], "team:menu:curators"),
        ],
        [telegraf_1.Markup.button.callback(constants_1.TEAMBOT_MAIN_MENU[4], "team:menu:project")],
    ]);
}
function teamWorkKeyboard() {
    return telegraf_1.Markup.keyboard([
        [constants_1.TEAM_WORK_MENU[0], constants_1.TEAM_WORK_MENU[1]],
        [constants_1.TEAM_WORK_MENU[2], constants_1.TEAM_WORK_MENU[3]],
    ]).resize();
}
function teambotBackKeyboard() {
    return telegraf_1.Markup.keyboard([[constants_1.BACK_BUTTON]]).resize();
}
