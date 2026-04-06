"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backKeyboard = backKeyboard;
exports.closeInlineKeyboard = closeInlineKeyboard;
exports.backInlineKeyboard = backInlineKeyboard;
const telegraf_1 = require("telegraf");
const constants_1 = require("../config/constants");
function backKeyboard() {
    return telegraf_1.Markup.keyboard([[constants_1.BACK_BUTTON]]).resize();
}
function closeInlineKeyboard() {
    return telegraf_1.Markup.inlineKeyboard([telegraf_1.Markup.button.callback("✖️ Закрыть", "common:close")]);
}
function backInlineKeyboard(callbackData) {
    return telegraf_1.Markup.inlineKeyboard([telegraf_1.Markup.button.callback(constants_1.BACK_BUTTON, callbackData)]);
}
