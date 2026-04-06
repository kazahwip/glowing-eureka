"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSupportTicket = createSupportTicket;
const client_1 = require("../db/client");
async function createSupportTicket(userId, message) {
    const db = await (0, client_1.getDb)();
    const result = await db.run("INSERT INTO support_tickets (user_id, message, status) VALUES (?, ?, 'new')", userId, message);
    return db.get("SELECT * FROM support_tickets WHERE id = ?", Number(result.lastID));
}
