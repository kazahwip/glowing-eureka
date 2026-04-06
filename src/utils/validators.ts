import { BACK_BUTTON } from "../config/constants";

export function isBackText(value?: string) {
  return value?.trim() === BACK_BUTTON;
}

export function parsePositiveNumber(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseAge(value?: string) {
  const parsed = parsePositiveNumber(value);

  if (!parsed || parsed < 18 || parsed > 99) {
    return null;
  }

  return Math.floor(parsed);
}

export function parseTelegramId(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}
