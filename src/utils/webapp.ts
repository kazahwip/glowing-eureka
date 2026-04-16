import { config } from "../config/env";

export function buildWebappUrl(screen: string) {
  const url = new URL(config.webappBaseUrl);
  url.searchParams.set("screen", screen);
  return url.toString();
}

export function buildMediaUrl(reference: string) {
  if (!reference.startsWith("local:")) {
    return null;
  }

  const url = new URL(config.webappBaseUrl);
  url.pathname = `/media/${reference.slice("local:".length)}`;
  url.search = "";
  return url.toString();
}
