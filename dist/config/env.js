"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production"]).default("development"),
    TEAMBOT_TOKEN: zod_1.z.string().default(""),
    SERVICEBOT_TOKEN: zod_1.z.string().default(""),
    WEBAPP_BASE_URL: zod_1.z.string().default(""),
    WEBAPP_PORT: zod_1.z.coerce.number().default(3000),
    WEBAPP_SECRET_MODE: zod_1.z.enum(["telegram_init_data"]).default("telegram_init_data"),
    ADMIN_TELEGRAM_IDS: zod_1.z.string().default(""),
    SUPPORT_NOTIFY_IDS: zod_1.z.string().default(""),
    DATABASE_PATH: zod_1.z.string().default("./data/awake.sqlite"),
    TEAMBOT_ASSETS_DIR: zod_1.z.string().default("./assets/teambot"),
    SERVICEBOT_ASSETS_DIR: zod_1.z.string().default("./assets/servicebot"),
    PROJECT_START_DATE: zod_1.z.string().default("2026-04-06"),
    PROJECT_PAYOUT_PERCENT: zod_1.z.coerce.number().default(75),
    DEFAULT_TRANSFER_DETAILS: zod_1.z.string().default("2200701789834873 Т-банк"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Ошибка загрузки env: ${parsed.error.message}`);
}
const toIdList = (value) => value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
const env = parsed.data;
exports.config = {
    nodeEnv: env.NODE_ENV,
    teambotToken: env.TEAMBOT_TOKEN,
    servicebotToken: env.SERVICEBOT_TOKEN,
    webappBaseUrl: env.WEBAPP_BASE_URL.trim(),
    webappPort: env.WEBAPP_PORT,
    webappSecretMode: env.WEBAPP_SECRET_MODE,
    webappEnabled: Boolean(env.WEBAPP_BASE_URL.trim()),
    adminTelegramIds: toIdList(env.ADMIN_TELEGRAM_IDS),
    supportNotifyIds: toIdList(env.SUPPORT_NOTIFY_IDS),
    databasePath: node_path_1.default.resolve(env.DATABASE_PATH),
    teambotAssetsDir: node_path_1.default.resolve(env.TEAMBOT_ASSETS_DIR),
    servicebotAssetsDir: node_path_1.default.resolve(env.SERVICEBOT_ASSETS_DIR),
    projectStartDate: env.PROJECT_START_DATE,
    defaultPayoutPercent: env.PROJECT_PAYOUT_PERCENT,
    defaultTransferDetails: env.DEFAULT_TRANSFER_DETAILS,
};
