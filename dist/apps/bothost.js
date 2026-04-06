"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("../config/env");
const servicebot_1 = require("./servicebot");
const teambot_1 = require("./teambot");
const instance = process.env.BOT_INSTANCE?.trim().toLowerCase();
async function stopAll(bots) {
    await Promise.allSettled(bots.map((bot) => bot.stop()));
}
async function bootstrap() {
    if (instance === "teambot") {
        const teambot = await (0, teambot_1.launchTeambot)();
        const shutdown = async () => {
            await stopAll([teambot]);
            process.exit(0);
        };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
        return;
    }
    if (instance === "servicebot") {
        const servicebot = await (0, servicebot_1.launchServicebot)();
        const shutdown = async () => {
            await stopAll([servicebot]);
            process.exit(0);
        };
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
        return;
    }
    if (!env_1.config.teambotToken || !env_1.config.servicebotToken) {
        throw new Error("Для общего запуска на Bothost нужны оба токена: TEAMBOT_TOKEN и SERVICEBOT_TOKEN.");
    }
    const bots = await Promise.all([(0, teambot_1.launchTeambot)(), (0, servicebot_1.launchServicebot)()]);
    const shutdown = async () => {
        await stopAll(bots);
        process.exit(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
}
bootstrap().catch((error) => {
    process.stderr.write(`Ошибка запуска bothost launcher: ${String(error)}\n`);
    process.exitCode = 1;
});
