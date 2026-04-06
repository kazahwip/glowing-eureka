"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listReviews = listReviews;
exports.createReview = createReview;
const client_1 = require("../db/client");
async function listReviews(page = 1, limit = 5) {
    const db = await (0, client_1.getDb)();
    const offset = (page - 1) * limit;
    const items = await db.all(`SELECT reviews.*, users.username, users.first_name
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     ORDER BY reviews.created_at DESC
     LIMIT ? OFFSET ?`, limit + 1, offset);
    return {
        items: items.slice(0, limit),
        hasNext: items.length > limit,
    };
}
async function createReview(userId, text) {
    const db = await (0, client_1.getDb)();
    await db.run("INSERT INTO reviews (user_id, text) VALUES (?, ?)", userId, text);
}
