import { getDb } from "../db/client";
import type { Booking, PaymentMethod } from "../types/entities";

export async function createBooking(userId: number, cardId: number, slotLabel: string, paymentMethod: PaymentMethod) {
  const db = await getDb();
  const status = paymentMethod === "bot_balance" ? "completed" : "requested";

  const result = await db.run(
    `INSERT INTO bookings (user_id, card_id, slot_label, payment_method, status)
     VALUES (?, ?, ?, ?, ?)`,
    userId,
    cardId,
    slotLabel,
    paymentMethod,
    status,
  );

  return db.get<Booking>("SELECT * FROM bookings WHERE id = ?", result.lastID);
}

export async function countCompletedBookings(userId: number) {
  const db = await getDb();
  const row = await db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM bookings WHERE user_id = ? AND status = 'completed'",
    userId,
  );

  return row?.total ?? 0;
}
