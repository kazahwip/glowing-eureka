import type { Telegraf } from "telegraf";
import type { AppContext } from "../types/context";
import { logError } from "../services/logging.service";

export function setupErrorHandling(bot: Telegraf<AppContext>, botName: "teambot" | "servicebot") {
  bot.catch(async (error, ctx) => {
    await logError(botName, ctx.from?.id, error);

    try {
      await ctx.reply("Произошла ошибка. Попробуйте ещё раз позже.");
    } catch {
      process.stderr.write(`Не удалось отправить сообщение об ошибке в ${botName}\n`);
    }
  });
}
