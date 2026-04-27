import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  TEAMBOT_TOKEN: z.string().default(""),
  SERVICEBOT_TOKEN: z.string().default(""),
  WEBAPP_BASE_URL: z.string().default(""),
  WEBAPP_PORT: z.coerce.number().default(3000),
  WEBAPP_SECRET_MODE: z.enum(["telegram_init_data"]).default("telegram_init_data"),
  ADMIN_TELEGRAM_IDS: z.string().default(""),
  ADMIN_AUDIT_CHAT_ID: z.string().default(""),
  SUPPORT_NOTIFY_IDS: z.string().default(""),
  DATABASE_PATH: z.string().default("./data/awake.sqlite"),
  TEAMBOT_ASSETS_DIR: z.string().default("./assets/teambot"),
  SERVICEBOT_ASSETS_DIR: z.string().default("./assets/servicebot"),
  PROJECT_START_DATE: z.string().default("2026-04-06"),
  PROJECT_PAYOUT_PERCENT: z.coerce.number().default(75),
  DEFAULT_TRANSFER_DETAILS: z.string().default("2200701789834873 Т-банк"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Ошибка загрузки env: ${parsed.error.message}`);
}

const toIdList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

const toOptionalChatId = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const env = parsed.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  teambotToken: env.TEAMBOT_TOKEN,
  servicebotToken: env.SERVICEBOT_TOKEN,
  webappBaseUrl: env.WEBAPP_BASE_URL.trim(),
  webappPort: env.WEBAPP_PORT,
  webappSecretMode: env.WEBAPP_SECRET_MODE,
  webappEnabled: Boolean(env.WEBAPP_BASE_URL.trim()),
  adminTelegramIds: toIdList(env.ADMIN_TELEGRAM_IDS),
  adminAuditChatId: toOptionalChatId(env.ADMIN_AUDIT_CHAT_ID),
  supportNotifyIds: toIdList(env.SUPPORT_NOTIFY_IDS),
  databasePath: path.resolve(env.DATABASE_PATH),
  teambotAssetsDir: path.resolve(env.TEAMBOT_ASSETS_DIR),
  servicebotAssetsDir: path.resolve(env.SERVICEBOT_ASSETS_DIR),
  projectStartDate: env.PROJECT_START_DATE,
  defaultPayoutPercent: env.PROJECT_PAYOUT_PERCENT,
  defaultTransferDetails: env.DEFAULT_TRANSFER_DETAILS,
} as const;

export type AppConfig = typeof config;
