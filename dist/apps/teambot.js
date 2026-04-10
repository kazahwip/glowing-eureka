"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchTeambot = launchTeambot;
const telegraf_1 = require("telegraf");
const env_1 = require("../config/env");
const client_1 = require("../db/client");
const register_1 = require("../handlers/teambot/register");
const auth_1 = require("../middlewares/auth");
const error_1 = require("../middlewares/error");
const adminBroadcast_scene_1 = require("../scenes/teambot/adminBroadcast.scene");
const adminAddProfit_scene_1 = require("../scenes/teambot/adminAddProfit.scene");
const adminCuratorAdd_scene_1 = require("../scenes/teambot/adminCuratorAdd.scene");
const adminCuratorAssign_scene_1 = require("../scenes/teambot/adminCuratorAssign.scene");
const adminCuratorUnassign_scene_1 = require("../scenes/teambot/adminCuratorUnassign.scene");
const adminCardSearch_scene_1 = require("../scenes/teambot/adminCardSearch.scene");
const adminWithdrawBalance_scene_1 = require("../scenes/teambot/adminWithdrawBalance.scene");
const adminProjectStats_scene_1 = require("../scenes/teambot/adminProjectStats.scene");
const adminTransfer_scene_1 = require("../scenes/teambot/adminTransfer.scene");
const adminUserSearch_scene_1 = require("../scenes/teambot/adminUserSearch.scene");
const createCard_scene_1 = require("../scenes/teambot/createCard.scene");
const payoutDetails_scene_1 = require("../scenes/teambot/payoutDetails.scene");
const profitReport_scene_1 = require("../scenes/teambot/profitReport.scene");
const withdrawRequest_scene_1 = require("../scenes/teambot/withdrawRequest.scene");
const context_1 = require("../types/context");
let runningTeambotPromise = null;
async function launchTeambot() {
    if (runningTeambotPromise) {
        return runningTeambotPromise;
    }
    runningTeambotPromise = (async () => {
        if (!env_1.config.teambotToken) {
            throw new Error("Не задан TEAMBOT_TOKEN в .env");
        }
        await (0, client_1.getDb)();
        const bot = new telegraf_1.Telegraf(env_1.config.teambotToken);
        const stage = new telegraf_1.Scenes.Stage([
            createCard_scene_1.teamCreateCardScene,
            adminUserSearch_scene_1.adminUserSearchScene,
            adminCardSearch_scene_1.adminCardSearchScene,
            adminTransfer_scene_1.adminTransferScene,
            adminProjectStats_scene_1.adminProjectStatsScene,
            adminCuratorAdd_scene_1.adminCuratorAddScene,
            adminCuratorAssign_scene_1.adminCuratorAssignScene,
            adminCuratorUnassign_scene_1.adminCuratorUnassignScene,
            adminWithdrawBalance_scene_1.adminWithdrawBalanceScene,
            adminBroadcast_scene_1.adminBroadcastScene,
            adminAddProfit_scene_1.adminAddProfitScene,
            payoutDetails_scene_1.payoutDetailsScene,
            profitReport_scene_1.profitReportScene,
            withdrawRequest_scene_1.withdrawRequestScene,
        ]);
        bot.use((0, auth_1.attachBotKind)("teambot"));
        bot.use((0, telegraf_1.session)({ defaultSession: context_1.createDefaultSession }));
        bot.use(auth_1.attachCurrentUser);
        bot.use(auth_1.rejectBlockedUsers);
        bot.use(auth_1.requireWorkerChatMembership);
        bot.use(stage.middleware());
        (0, register_1.registerTeambotHandlers)(bot);
        (0, error_1.setupErrorHandling)(bot, "teambot");
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
