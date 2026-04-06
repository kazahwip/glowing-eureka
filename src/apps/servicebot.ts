import { Scenes, Telegraf, session } from "telegraf";
import { config } from "../config/env";
import { getDb } from "../db/client";
import { registerServicebotHandlers } from "../handlers/servicebot/register";
import { attachBotKind, attachCurrentUser, rejectBlockedUsers } from "../middlewares/auth";
import { setupErrorHandling } from "../middlewares/error";
import { ensureDemoCatalogSeed } from "../services/demo-catalog.service";
import { setServicebotUsername } from "../services/settings.service";
import { paymentConfirmationScene } from "../scenes/servicebot/paymentConfirmation.scene";
import { reviewScene } from "../scenes/servicebot/review.scene";
import { supportScene } from "../scenes/servicebot/support.scene";
import { workerAddCardScene } from "../scenes/servicebot/workerAddCard.scene";
import { workerBroadcastScene } from "../scenes/servicebot/workerBroadcast.scene";
import { workerClientSearchScene } from "../scenes/servicebot/workerClientSearch.scene";
import { createDefaultSession, type AppContext } from "../types/context";

export type RunningServicebot = {
  stop: () => Promise<void>;
};

let runningServicebotPromise: Promise<RunningServicebot> | null = null;

export async function launchServicebot(): Promise<RunningServicebot> {
  if (runningServicebotPromise) {
    return runningServicebotPromise;
  }

  runningServicebotPromise = (async () => {
    if (!config.servicebotToken) {
      throw new Error("Не задан SERVICEBOT_TOKEN в .env");
    }

    await getDb();
    await ensureDemoCatalogSeed();

    const bot = new Telegraf<AppContext>(config.servicebotToken);
    const stage = new Scenes.Stage<AppContext>([
      supportScene,
      reviewScene,
      paymentConfirmationScene,
      workerAddCardScene,
      workerBroadcastScene,
      workerClientSearchScene,
    ]);

    bot.use(attachBotKind("servicebot"));
    bot.use(session({ defaultSession: createDefaultSession }));
    bot.use(attachCurrentUser);
    bot.use(rejectBlockedUsers);
    bot.use(stage.middleware());

    registerServicebotHandlers(bot);
    setupErrorHandling(bot, "servicebot");

    const me = await bot.telegram.getMe();
    await setServicebotUsername(me.username ?? "");

    await bot.telegram.deleteMyCommands();

    await bot.launch();
    process.stdout.write("servicebot запущен.\n");

    return {
      stop: async () => {
        await bot.stop();
      },
    };
  })().catch((error) => {
    runningServicebotPromise = null;
    throw error;
  });

  return runningServicebotPromise;
}

async function bootstrap() {
  const servicebot = await launchServicebot();

  const shutdown = async () => {
    await servicebot.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (require.main === module) {
  bootstrap().catch((error) => {
    process.stderr.write(`Ошибка запуска servicebot: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
