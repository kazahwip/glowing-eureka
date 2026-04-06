import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Input, Telegram } from "telegraf";
import { config } from "../config/env";
import type { CardPhoto } from "../types/entities";
import { updateCardPhotoReference } from "./cards.service";

const MEDIA_ROOT_DIR = path.resolve(process.cwd(), "data", "media");

function getFallbackTelegrams() {
  return [config.teambotToken, config.servicebotToken]
    .filter(Boolean)
    .map((token) => new Telegram(token));
}

function normalizeRelativePath(value: string) {
  return value.replaceAll("\\", "/");
}

export function isLocalMediaReference(reference: string) {
  return reference.startsWith("local:");
}

export function resolveLocalMediaPath(reference: string) {
  const relativePath = reference.slice("local:".length);
  return path.join(MEDIA_ROOT_DIR, relativePath);
}

async function downloadByFileId(fileId: string, clients: Telegram[], scope: string) {
  for (const client of clients) {
    try {
      const fileLink = await client.getFileLink(fileId);
      const url = new URL(fileLink.toString());
      const extension = path.extname(url.pathname) || ".jpg";
      const relativePath = normalizeRelativePath(path.join(scope, `${Date.now()}-${randomUUID()}${extension}`));
      const absolutePath = path.join(MEDIA_ROOT_DIR, relativePath);

      await fsp.mkdir(path.dirname(absolutePath), { recursive: true });

      const response = await fetch(fileLink);
      if (!response.ok) {
        throw new Error(`Не удалось скачать файл ${fileId}: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fsp.writeFile(absolutePath, buffer);

      return `local:${relativePath}`;
    } catch {
      continue;
    }
  }

  return null;
}

export async function persistTelegramPhotoReferences(
  telegram: Telegram,
  references: string[],
  scope = "cards/drafts",
) {
  const clients = [telegram, ...getFallbackTelegrams()];
  const nextReferences: string[] = [];

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

export async function materializeCardPhotoReferences(photos: CardPhoto[]) {
  const clients = getFallbackTelegrams();
  const resolved: string[] = [];

  for (const photo of photos) {
    if (isLocalMediaReference(photo.telegram_file_id)) {
      resolved.push(photo.telegram_file_id);
      continue;
    }

    const storedReference = await downloadByFileId(photo.telegram_file_id, clients, `cards/${photo.card_id}`);
    if (storedReference) {
      await updateCardPhotoReference(photo.id, storedReference);
      resolved.push(storedReference);
      continue;
    }

    resolved.push(photo.telegram_file_id);
  }

  return resolved;
}

export function mediaInputFromReference(reference: string) {
  if (!isLocalMediaReference(reference)) {
    return reference;
  }

  const filePath = resolveLocalMediaPath(reference);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return Input.fromLocalFile(filePath);
}
