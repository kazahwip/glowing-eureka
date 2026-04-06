"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFavorite = isFavorite;
exports.toggleFavorite = toggleFavorite;
exports.listFavoriteCards = listFavoriteCards;
const client_1 = require("../db/client");
async function isFavorite(userId, cardId) {
    const db = await (0, client_1.getDb)();
    const row = await db.get("SELECT id FROM favorites WHERE user_id = ? AND card_id = ?", userId, cardId);
    return Boolean(row);
}
async function toggleFavorite(userId, cardId) {
    const db = await (0, client_1.getDb)();
    const exists = await isFavorite(userId, cardId);
    if (exists) {
        await db.run("DELETE FROM favorites WHERE user_id = ? AND card_id = ?", userId, cardId);
        return false;
    }
    await db.run("INSERT INTO favorites (user_id, card_id) VALUES (?, ?)", userId, cardId);
    return true;
}
async function listFavoriteCards(userId) {
    const db = await (0, client_1.getDb)();
    return db.all(`SELECT cards.*
     FROM favorites
     JOIN cards ON cards.id = favorites.card_id
     WHERE favorites.user_id = ?
     ORDER BY favorites.created_at DESC`, userId);
}
