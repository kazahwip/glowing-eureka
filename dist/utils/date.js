"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.daysBetween = daysBetween;
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
});
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
});
function formatDate(date) {
    return dateFormatter.format(new Date(date));
}
function formatDateTime(date) {
    return dateTimeFormatter.format(new Date(date));
}
function daysBetween(startDate, endDate = new Date()) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
}
