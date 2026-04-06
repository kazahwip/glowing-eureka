"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBackText = isBackText;
exports.parsePositiveNumber = parsePositiveNumber;
exports.parseAge = parseAge;
exports.parseTelegramId = parseTelegramId;
const constants_1 = require("../config/constants");
function isBackText(value) {
    return value?.trim() === constants_1.BACK_BUTTON;
}
function parsePositiveNumber(value) {
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
function parseAge(value) {
    const parsed = parsePositiveNumber(value);
    if (!parsed || parsed < 18 || parsed > 99) {
        return null;
    }
    return Math.floor(parsed);
}
function parseTelegramId(value) {
    if (!value) {
        return null;
    }
    const parsed = Number(value.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
