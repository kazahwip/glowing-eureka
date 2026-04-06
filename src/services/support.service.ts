import { getDb } from "../db/client";
import type { SupportTicket } from "../types/entities";

export async function createSupportTicket(userId: number, message: string) {
  const db = await getDb();
  const result = await db.run("INSERT INTO support_tickets (user_id, message, status) VALUES (?, ?, 'new')", userId, message);
  return db.get<SupportTicket>("SELECT * FROM support_tickets WHERE id = ?", Number(result.lastID));
}
