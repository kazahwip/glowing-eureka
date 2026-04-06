"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchServicebot = launchServicebot;
const telegraf_1 = require("telegraf");
const env_1 = require("../config/env");
const client_1 = require("../db/client");
const register_1 = require("../handlers/servicebot/register");
const auth_1 = require("../middlewares/auth");
const error_1 = require("../middlewares/error");
const demo_catalog_service_1 = require("../services/demo-catalog.service");
const settings_service_1 = require("../services/settings.service");
const paymentConfirmation_scene_1 = require("../scenes/servicebot/paymentConfirmation.scene");
const review_scene_1 = require("../scenes/servicebot/review.scene");
const support_scene_1 = require("../scenes/servicebot/support.scene");
const workerAddCard_scene_1 = require("../scenes/servicebot/workerAddCard.scene");
const workerBroadcast_scene_1 = require("../scenes/servicebot/workerBroadcast.scene");
const workerClientSearch_scene_1 = require("../scenes/servicebot/workerClientSearch.scene");
const context_1 = require("../types/context");
let runningServicebotPromise = null;
async function launchServicebot() {
    if (runningServicebotPromise) {
        return runningServicebotPromise;
    }
    runningServicebotPromise = (async () => {
        if (!env_1.config.servicebotToken) {
            throw new Error("Не задан SERVICEBOT_TOKEN в .env");
        }
        await (0, client_1.getDb)();
        await (0, demo_catalog_service_1.ensureDemoCatalogSeed)();
        const bot = new telegraf_1.Telegraf(env_1.config.servicebotToken);
        const stage = new telegraf_1.Scenes.Stage([
            support_scene_1.supportScene,
            review_scene_1.reviewScene,
            paymentConfirmation_scene_1.paymentConfirmationScene,
            workerAddCard_scene_1.workerAddCardScene,
            workerBroadcast_scene_1.workerBroadcastScene,
            workerClientSearch_scene_1.workerClientSearchScene,
        ]);
        bot.use((0, auth_1.attachBotKind)("servicebot"));
        bot.use((0, telegraf_1.session)({ defaultSession: context_1.createDefaultSession }));
        bot.use(auth_1.attachCurrentUser);
        bot.use(auth_1.rejectBlockedUsers);
        bot.use(stage.middleware());
        (0, register_1.registerServicebotHandlers)(bot);
        (0, error_1.setupErrorHandling)(bot, "servicebot");
        const me = await bot.telegram.getMe();
        await (0, settings_service_1.setServicebotUsername)(me.username ?? "");
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
