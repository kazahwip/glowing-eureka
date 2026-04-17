import { config } from "../config/env";
import { launchServicebot, type RunningServicebot } from "./servicebot";
import { launchTeambot, type RunningTeambot } from "./teambot";
import { launchWebappServer, type RunningWebappServer } from "../webapp/server";

type RunningBot = RunningTeambot | RunningServicebot | RunningWebappServer;

const instance = process.env.BOT_INSTANCE?.trim().toLowerCase();

async function stopAll(bots: RunningBot[]) {
  await Promise.allSettled(bots.map((bot) => bot.stop()));
}

async function bootstrap() {
  if (instance === "teambot") {
    const teambot = await launchTeambot();

    const shutdown = async () => {
      await stopAll([teambot]);
      process.exit(0);
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    return;
  }

  if (instance === "servicebot") {
    const servicebot = await launchServicebot();

    const shutdown = async () => {
      await stopAll([servicebot]);
      process.exit(0);
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    return;
  }

  if (!config.teambotToken || !config.servicebotToken) {
    throw new Error(
      "Для общего запуска на Bothost нужны оба токена: TEAMBOT_TOKEN и SERVICEBOT_TOKEN.",
    );
  }

  const bots = await Promise.all([launchTeambot(), launchServicebot()]);
  const running: RunningBot[] = [...bots];

  if (config.webappEnabled) {
    const webapp = await launchWebappServer();
    running.push(webapp);
  }

  const shutdown = async () => {
    await stopAll(running);
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  process.stderr.write(`Ошибка запуска bothost launcher: ${String(error)}\n`);
  process.exitCode = 1;
});
