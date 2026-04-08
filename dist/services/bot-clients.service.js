"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeambotTelegram = getTeambotTelegram;
exports.getServicebotTelegram = getServicebotTelegram;
const telegraf_1 = require("telegraf");
const env_1 = require("../config/env");
let teambotTelegram = null;
let servicebotTelegram = null;
function getTeambotTelegram() {
    if (!env_1.config.teambotToken) {
        throw new Error("Не задан TEAMBOT_TOKEN для отправки уведомлений через AWAKE BOT.");
    }
    if (!teambotTelegram) {
        teambotTelegram = new telegraf_1.Telegram(env_1.config.teambotToken);
    }
    return teambotTelegram;
}
function getServicebotTelegram() {
    if (!env_1.config.servicebotToken) {
        throw new Error("Не задан SERVICEBOT_TOKEN для отправки уведомлений через servicebot.");
    }
    if (!servicebotTelegram) {
        servicebotTelegram = new telegraf_1.Telegram(env_1.config.servicebotToken);
    }
    return servicebotTelegram;
}
