"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBooking = createBooking;
exports.createPaidBooking = createPaidBooking;
exports.createCashDepositBooking = createCashDepositBooking;
exports.countCompletedBookings = countCompletedBookings;
const client_1 = require("../db/client");
async function createBooking(userId, cardId, slotLabel, paymentMethod) {
    const db = await (0, client_1.getDb)();
    const status = paymentMethod === "bot_balance" ? "completed" : "requested";
    const result = await db.run(`INSERT INTO bookings (user_id, card_id, slot_label, payment_method, status)
     VALUES (?, ?, ?, ?, ?)`, userId, cardId, slotLabel, paymentMethod, status);
    return db.get("SELECT * FROM bookings WHERE id = ?", result.lastID);
}
async function createPaidBooking(userId, cardId, slotLabel, amount) {
    const db = await (0, client_1.getDb)();
    await db.exec("BEGIN");
    try {
        const user = await db.get("SELECT balance FROM users WHERE id = ?", userId);
        if (!user) {
            await db.exec("ROLLBACK");
            return { status: "missing_user", booking: null };
        }
        if (user.balance < amount) {
            await db.exec("ROLLBACK");
            return { status: "insufficient_balance", booking: null };
        }
        await db.run("UPDATE users SET balance = balance - ? WHERE id = ?", amount, userId);
        const result = await db.run(`INSERT INTO bookings (user_id, card_id, slot_label, payment_method, status)
       VALUES (?, ?, ?, 'bot_balance', 'completed')`, userId, cardId, slotLabel);
        await db.exec("COMMIT");
        return {
            status: "completed",
            booking: await db.get("SELECT * FROM bookings WHERE id = ?", result.lastID),
        };
    }
    catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
async function createCashDepositBooking(userId, cardId, slotLabel, depositAmount) {
    const db = await (0, client_1.getDb)();
    await db.exec("BEGIN");
    try {
        const user = await db.get("SELECT balance FROM users WHERE id = ?", userId);
        if (!user) {
            await db.exec("ROLLBACK");
            return { status: "missing_user", booking: null };
        }
        if (user.balance < depositAmount) {
            await db.exec("ROLLBACK");
            return { status: "insufficient_balance", booking: null };
        }
        await db.run("UPDATE users SET balance = balance - ? WHERE id = ?", depositAmount, userId);
        const result = await db.run(`INSERT INTO bookings (user_id, card_id, slot_label, payment_method, status)
       VALUES (?, ?, ?, 'cash', 'requested')`, userId, cardId, slotLabel);
        await db.exec("COMMIT");
        return {
            status: "completed",
            booking: await db.get("SELECT * FROM bookings WHERE id = ?", result.lastID),
        };
    }
    catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
async function countCompletedBookings(userId) {
    const db = await (0, client_1.getDb)();
    const row = await db.get("SELECT COUNT(*) AS total FROM bookings WHERE user_id = ? AND status = 'completed'", userId);
    return row?.total ?? 0;
}
