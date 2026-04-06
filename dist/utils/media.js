"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAssetPath = resolveAssetPath;
exports.sendScreen = sendScreen;
exports.sendMediaGroupFromReferences = sendMediaGroupFromReferences;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const env_1 = require("../config/env");
const media_service_1 = require("../services/media.service");
function getAssetDir(botKind) {
    return botKind === "teambot" ? env_1.config.teambotAssetsDir : env_1.config.servicebotAssetsDir;
}
function resolveAssetPath(botKind, fileName) {
    return node_path_1.default.join(getAssetDir(botKind), fileName);
}
async function sendScreen(ctx, options) {
    const { banner, botKind, text, messageExtra, photoExtra } = options;
    const normalizedText = text.trim();
    if (banner) {
        const filePath = resolveAssetPath(botKind, banner);
        if (node_fs_1.default.existsSync(filePath)) {
            if (normalizedText.length > 900) {
                await ctx.replyWithPhoto({ source: filePath });
                await ctx.reply(normalizedText, {
                    parse_mode: "HTML",
                    ...(messageExtra ?? photoExtra),
                });
                return;
            }
            if (!normalizedText) {
                await ctx.replyWithPhoto({ source: filePath }, {
                    ...photoExtra,
                });
                return;
            }
            await ctx.replyWithPhoto({ source: filePath }, {
                caption: normalizedText,
                parse_mode: "HTML",
                ...photoExtra,
            });
            return;
        }
    }
    await ctx.reply(normalizedText || "Главное меню", {
        parse_mode: "HTML",
        ...messageExtra,
    });
}
async function sendMediaGroupFromReferences(ctx, references) {
    if (!references.length) {
        return;
    }
    const mediaGroup = references
        .map((reference, index) => {
        const media = (0, media_service_1.mediaInputFromReference)(reference);
        if (!media) {
            return null;
        }
        return {
            type: "photo",
            media,
            ...(index === 0 ? { caption: "Фотографии анкеты", parse_mode: "HTML" } : {}),
        };
    })
        .filter((item) => Boolean(item));
    if (!mediaGroup.length) {
        return;
    }
    await ctx.replyWithMediaGroup(mediaGroup);
}
