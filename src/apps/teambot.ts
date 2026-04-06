import { Scenes, Telegraf, session } from "telegraf";
import { config } from "../config/env";
import { getDb } from "../db/client";
import { registerTeambotHandlers } from "../handlers/teambot/register";
import { attachBotKind, attachCurrentUser, rejectBlockedUsers } from "../middlewares/auth";
import { setupErrorHandling } from "../middlewares/error";
import { adminBroadcastScene } from "../scenes/teambot/adminBroadcast.scene";
import { adminCuratorAddScene } from "../scenes/teambot/adminCuratorAdd.scene";
import { adminCuratorAssignScene } from "../scenes/teambot/adminCuratorAssign.scene";
import { adminCuratorUnassignScene } from "../scenes/teambot/adminCuratorUnassign.scene";
import { adminProjectStatsScene } from "../scenes/teambot/adminProjectStats.scene";
import { adminTransferScene } from "../scenes/teambot/adminTransfer.scene";
import { adminUserSearchScene } from "../scenes/teambot/adminUserSearch.scene";
import { teamCreateCardScene } from "../scenes/teambot/createCard.scene";
import { createDefaultSession, type AppContext } from "../types/context";

async function bootstrap() {
  if (!config.teambotToken) {
    throw new Error("Не задан TEAMBOT_TOKEN в .env");
  }

  await getDb();

  const bot = new Telegraf<AppContext>(config.teambotToken);
  const stage = new Scenes.Stage<AppContext>([
    teamCreateCardScene,
    adminUserSearchScene,
    adminTransferScene,
    adminProjectStatsScene,
    adminCuratorAddScene,
    adminCuratorAssignScene,
    adminCuratorUnassignScene,
    adminBroadcastScene,
  ]);

  bot.use(attachBotKind("teambot"));
  bot.use(session({ defaultSession: createDefaultSession }));
  bot.use(attachCurrentUser);
  bot.use(rejectBlockedUsers);
  bot.use(stage.middleware());

  registerTeambotHandlers(bot);
  setupErrorHandling(bot, "teambot");

  await bot.telegram.setMyCommands([
    { command: "start", description: "Открыть главное меню" },
    { command: "kassa", description: "Касса проекта" },
    { command: "admin", description: "Открыть админ-панель" },
  ]);

  await bot.launch();
  process.stdout.write("teambot запущен.\n");

  const shutdown = async () => {
    await bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  process.stderr.write(`Ошибка запуска teambot: ${String(error)}\n`);
  process.exitCode = 1;
});

