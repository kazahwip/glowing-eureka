"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupErrorHandling = setupErrorHandling;
const logging_service_1 = require("../services/logging.service");
function setupErrorHandling(bot, botName) {
    bot.catch(async (error, ctx) => {
        await (0, logging_service_1.logError)(botName, ctx.from?.id, error);
        try {
            await ctx.reply("Произошла ошибка. Попробуйте ещё раз позже.");
        }
        catch {
            process.stderr.write(`Не удалось отправить сообщение об ошибке в ${botName}\n`);
        }
    });
}
