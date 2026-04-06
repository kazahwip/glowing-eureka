import fs from "node:fs";
import path from "node:path";
import { config } from "../config/env";
import { mediaInputFromReference } from "../services/media.service";
import type { BotKind } from "../types/entities";
import type { AppContext } from "../types/context";

interface ScreenOptions {
  botKind: BotKind;
  banner?: string;
  text: string;
  messageExtra?: Record<string, unknown>;
  photoExtra?: Record<string, unknown>;
}

function getAssetDir(botKind: BotKind) {
  return botKind === "teambot" ? config.teambotAssetsDir : config.servicebotAssetsDir;
}

export function resolveAssetPath(botKind: BotKind, fileName: string) {
  return path.join(getAssetDir(botKind), fileName);
}

export async function sendScreen(ctx: AppContext, options: ScreenOptions) {
  const { banner, botKind, text, messageExtra, photoExtra } = options;
  const normalizedText = text.trim();
  if (banner) {
    const filePath = resolveAssetPath(botKind, banner);
    if (fs.existsSync(filePath)) {
      if (normalizedText.length > 900) {
        await ctx.replyWithPhoto({ source: filePath });
        await ctx.reply(normalizedText, {
          parse_mode: "HTML",
          ...(messageExtra ?? photoExtra),
        });
        return;
      }

      if (!normalizedText) {
        await ctx.replyWithPhoto(
          { source: filePath },
          {
            ...photoExtra,
          },
        );
        return;
      }

      await ctx.replyWithPhoto(
        { source: filePath },
        {
          caption: normalizedText,
          parse_mode: "HTML",
          ...photoExtra,
        },
      );
      return;
    }
  }

  await ctx.reply(normalizedText || "Главное меню", {
    parse_mode: "HTML",
    ...messageExtra,
  });
}

export async function sendMediaGroupFromReferences(ctx: AppContext, references: string[]) {
  if (!references.length) {
    return;
  }

  const mediaGroup = references
    .map((reference, index) => {
      const media = mediaInputFromReference(reference);
      if (!media) {
        return null;
      }

      return {
        type: "photo" as const,
        media,
        ...(index === 0 ? { caption: "Фотографии анкеты", parse_mode: "HTML" as const } : {}),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!mediaGroup.length) {
    return;
  }

  await ctx.replyWithMediaGroup(mediaGroup);
}
