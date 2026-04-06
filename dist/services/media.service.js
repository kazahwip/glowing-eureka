"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLocalMediaReference = isLocalMediaReference;
exports.resolveLocalMediaPath = resolveLocalMediaPath;
exports.persistTelegramPhotoReferences = persistTelegramPhotoReferences;
exports.materializeCardPhotoReferences = materializeCardPhotoReferences;
exports.mediaInputFromReference = mediaInputFromReference;
const node_fs_1 = __importDefault(require("node:fs"));
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const telegraf_1 = require("telegraf");
const env_1 = require("../config/env");
const cards_service_1 = require("./cards.service");
const MEDIA_ROOT_DIR = node_path_1.default.resolve(process.cwd(), "data", "media");
function getFallbackTelegrams() {
    return [env_1.config.teambotToken, env_1.config.servicebotToken]
        .filter(Boolean)
        .map((token) => new telegraf_1.Telegram(token));
}
function normalizeRelativePath(value) {
    return value.replaceAll("\\", "/");
}
function isLocalMediaReference(reference) {
    return reference.startsWith("local:");
}
function resolveLocalMediaPath(reference) {
    const relativePath = reference.slice("local:".length);
    return node_path_1.default.join(MEDIA_ROOT_DIR, relativePath);
}
async function downloadByFileId(fileId, clients, scope) {
    for (const client of clients) {
        try {
            const fileLink = await client.getFileLink(fileId);
            const url = new URL(fileLink.toString());
            const extension = node_path_1.default.extname(url.pathname) || ".jpg";
            const relativePath = normalizeRelativePath(node_path_1.default.join(scope, `${Date.now()}-${(0, node_crypto_1.randomUUID)()}${extension}`));
            const absolutePath = node_path_1.default.join(MEDIA_ROOT_DIR, relativePath);
            await promises_1.default.mkdir(node_path_1.default.dirname(absolutePath), { recursive: true });
            const response = await fetch(fileLink);
            if (!response.ok) {
                throw new Error(`Не удалось скачать файл ${fileId}: ${response.status}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            await promises_1.default.writeFile(absolutePath, buffer);
            return `local:${relativePath}`;
        }
        catch {
            continue;
        }
    }
    return null;
}
async function persistTelegramPhotoReferences(telegram, references, scope = "cards/drafts") {
    const clients = [telegram, ...getFallbackTelegrams()];
    const nextReferences = [];
    for (const reference of references) {
        if (isLocalMediaReference(reference)) {
            nextReferences.push(reference);
            continue;
        }
        const storedReference = await downloadByFileId(reference, clients, scope);
        nextReferences.push(storedReference ?? reference);
    }
    return nextReferences;
}
async function materializeCardPhotoReferences(photos) {
    const clients = getFallbackTelegrams();
    const resolved = [];
    for (const photo of photos) {
        if (isLocalMediaReference(photo.telegram_file_id)) {
            resolved.push(photo.telegram_file_id);
            continue;
        }
        const storedReference = await downloadByFileId(photo.telegram_file_id, clients, `cards/${photo.card_id}`);
        if (storedReference) {
            await (0, cards_service_1.updateCardPhotoReference)(photo.id, storedReference);
            resolved.push(storedReference);
            continue;
        }
        resolved.push(photo.telegram_file_id);
    }
    return resolved;
}
function mediaInputFromReference(reference) {
    if (!isLocalMediaReference(reference)) {
        return reference;
    }
    const filePath = resolveLocalMediaPath(reference);
    if (!node_fs_1.default.existsSync(filePath)) {
        return null;
    }
    return telegraf_1.Input.fromLocalFile(filePath);
}
