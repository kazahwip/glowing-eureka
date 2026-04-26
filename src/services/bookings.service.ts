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

export async function createPaidBooking(userId: number, cardId: number, slotLabel: string, amount: number) {
  const db = await getDb();
  await db.exec("BEGIN");

  try {
    const user = await db.get<{ balance: number }>("SELECT balance FROM users WHERE id = ?", userId);
    if (!user) {
      await db.exec("ROLLBACK");
      return { status: "missing_user" as const, booking: null };
    }

    if (user.balance < amount) {
      await db.exec("ROLLBACK");
      return { status: "insufficient_balance" as const, booking: null };
    }

    await db.run("UPDATE users SET balance = balance - ? WHERE id = ?", amount, userId);
    const result = await db.run(
      `INSERT INTO bookings (user_id, card_id, slot_label, payment_method, status)
       VALUES (?, ?, ?, 'bot_balance', 'completed')`,
      userId,
      cardId,
      slotLabel,
    );

    await db.exec("COMMIT");

    return {
      status: "completed" as const,
      booking: await db.get<Booking>("SELECT * FROM bookings WHERE id = ?", result.lastID),
    };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function createCashDepositBooking(userId: number, cardId: number, slotLabel: string, depositAmount: number) {
  const db = await getDb();
  await db.exec("BEGIN");

  try {
    const user = await db.get<{ balance: number }>("SELECT balance FROM users WHERE id = ?", userId);
    if (!user) {
      await db.exec("ROLLBACK");
      return { status: "missing_user" as const, booking: null };
    }

    if (user.balance < depositAmount) {
      await db.exec("ROLLBACK");
      return { status: "insufficient_balance" as const, booking: null };
    }

    await db.run("UPDATE users SET balance = balance - ? WHERE id = ?", depositAmount, userId);
    const result = await db.run(
      `INSERT INTO bookings (user_id, card_id, slot_label, payment_method, status)
       VALUES (?, ?, ?, 'cash', 'requested')`,
      userId,
      cardId,
      slotLabel,
    );

    await db.exec("COMMIT");

    return {
      status: "completed" as const,
      booking: await db.get<Booking>("SELECT * FROM bookings WHERE id = ?", result.lastID),
    };
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export async function countCompletedBookings(userId: number) {
  const db = await getDb();
  const row = await db.get<{ total: number }>(
    "SELECT COUNT(*) AS total FROM bookings WHERE user_id = ? AND status = 'completed'",
    userId,
  );

  return row?.total ?? 0;
}
