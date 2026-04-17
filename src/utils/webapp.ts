import { config } from "../config/env";

export function isWebappEnabled() {
  return config.webappEnabled;
}

export function buildWebappUrl(screen: string) {
  if (!config.webappEnabled) {
    return null;
  }

  const url = new URL(config.webappBaseUrl);
  url.searchParams.set("screen", screen);
  return url.toString();
}

export function buildMediaUrl(reference: string) {
  if (!config.webappEnabled || !reference.startsWith("local:")) {
    return null;
  }

  const url = new URL(config.webappBaseUrl);
  url.pathname = `/media/${reference.slice("local:".length)}`;
  url.search = "";
  return url.toString();
}
