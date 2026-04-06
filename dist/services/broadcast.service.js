"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBroadcast = runBroadcast;
async function runBroadcast(bot, payload) {
    let sent = 0;
    let failed = 0;
    for (const telegramId of payload.telegramIds) {
        try {
            if (payload.photoFileId) {
                await bot.sendPhoto(telegramId, payload.photoFileId, {
                    caption: payload.text,
                    parse_mode: "HTML",
                });
            }
            else {
                await bot.sendMessage(telegramId, payload.text, {
                    parse_mode: "HTML",
                });
            }
            sent += 1;
        }
        catch {
            failed += 1;
        }
    }
    return { sent, failed };
}
