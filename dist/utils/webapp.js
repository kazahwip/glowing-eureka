"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWebappUrl = buildWebappUrl;
exports.buildMediaUrl = buildMediaUrl;
const env_1 = require("../config/env");
function buildWebappUrl(screen) {
    const url = new URL(env_1.config.webappBaseUrl);
    url.searchParams.set("screen", screen);
    return url.toString();
}
function buildMediaUrl(reference) {
    if (!reference.startsWith("local:")) {
        return null;
    }
    const url = new URL(env_1.config.webappBaseUrl);
    url.pathname = `/media/${reference.slice("local:".length)}`;
    url.search = "";
    return url.toString();
}
