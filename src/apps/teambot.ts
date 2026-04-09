import { Scenes, Telegraf, session } from "telegraf";
import { config } from "../config/env";
import { getDb } from "../db/client";
import { registerTeambotHandlers } from "../handlers/teambot/register";
import { attachBotKind, attachCurrentUser, rejectBlockedUsers, requireWorkerChatMembership } from "../middlewares/auth";
import { setupErrorHandling } from "../middlewares/error";
import { adminBroadcastScene } from "../scenes/teambot/adminBroadcast.scene";
import { adminAddProfitScene } from "../scenes/teambot/adminAddProfit.scene";
import { adminCuratorAddScene } from "../scenes/teambot/adminCuratorAdd.scene";
import { adminCuratorAssignScene } from "../scenes/teambot/adminCuratorAssign.scene";
import { adminCuratorUnassignScene } from "../scenes/teambot/adminCuratorUnassign.scene";
import { adminCardSearchScene } from "../scenes/teambot/adminCardSearch.scene";
import { adminProjectStatsScene } from "../scenes/teambot/adminProjectStats.scene";
import { adminTransferScene } from "../scenes/teambot/adminTransfer.scene";
import { adminUserSearchScene } from "../scenes/teambot/adminUserSearch.scene";
import { teamCreateCardScene } from "../scenes/teambot/createCard.scene";
import { payoutDetailsScene } from "../scenes/teambot/payoutDetails.scene";
import { profitReportScene } from "../scenes/teambot/profitReport.scene";
import { withdrawRequestScene } from "../scenes/teambot/withdrawRequest.scene";
import { createDefaultSession, type AppContext } from "../types/context";

export type RunningTeambot = {
  stop: () => Promise<void>;
};

let runningTeambotPromise: Promise<RunningTeambot> | null = null;

export async function launchTeambot(): Promise<RunningTeambot> {
  if (runningTeambotPromise) {
    return runningTeambotPromise;
  }

  runningTeambotPromise = (async () => {
    if (!config.teambotToken) {
      throw new Error("Не задан TEAMBOT_TOKEN в .env");
    }

    await getDb();

    const bot = new Telegraf<AppContext>(config.teambotToken);
    const stage = new Scenes.Stage<AppContext>([
      teamCreateCardScene,
      adminUserSearchScene,
      adminCardSearchScene,
      adminTransferScene,
      adminProjectStatsScene,
      adminCuratorAddScene,
      adminCuratorAssignScene,
      adminCuratorUnassignScene,
      adminBroadcastScene,
      adminAddProfitScene,
      payoutDetailsScene,
      profitReportScene,
      withdrawRequestScene,
    ]);

    bot.use(attachBotKind("teambot"));
    bot.use(session({ defaultSession: createDefaultSession }));
    bot.use(attachCurrentUser);
    bot.use(rejectBlockedUsers);
    bot.use(requireWorkerChatMembership);
    bot.use(stage.middleware());

    registerTeambotHandlers(bot);
    setupErrorHandling(bot, "teambot");

    await bot.telegram.setMyCommands([
      { command: "start", description: "Открыть главное меню" },
      { command: "kassa", description: "Касса проекта" },
      { command: "curators", description: "Список кураторов" },
      { command: "admin", description: "Открыть админ-панель" },
    ]);

    await bot.launch();
    process.stdout.write("AWAKE BOT запущен.\n");

    return {
      stop: async () => {
        await bot.stop();
      },
    };
  })().catch((error) => {
    runningTeambotPromise = null;
    throw error;
  });

  return runningTeambotPromise;
}

async function bootstrap() {
  const teambot = await launchTeambot();

  const shutdown = async () => {
    await teambot.stop();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

if (require.main === module) {
  bootstrap().catch((error) => {
    process.stderr.write(`Ошибка запуска AWAKE BOT: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
