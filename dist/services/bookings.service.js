"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBooking = createBooking;
exports.countCompletedBookings = countCompletedBookings;
const client_1 = require("../db/client");
async function createBooking(userId, cardId, slotLabel, paymentMethod) {
    const db = await (0, client_1.getDb)();
    const status = paymentMethod === "bot_balance" ? "completed" : "requested";
    const result = await db.run(`INSERT INTO bookings (user_id, card_id, slot_label, payment_method, status)
     VALUES (?, ?, ?, ?, ?)`, userId, cardId, slotLabel, paymentMethod, status);
    return db.get("SELECT * FROM bookings WHERE id = ?", result.lastID);
}
async function countCompletedBookings(userId) {
    const db = await (0, client_1.getDb)();
    const row = await db.get("SELECT COUNT(*) AS total FROM bookings WHERE user_id = ? AND status = 'completed'", userId);
    return row?.total ?? 0;
}
