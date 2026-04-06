import { getDb } from "../db/client";
import type { Card } from "../types/entities";

export async function isFavorite(userId: number, cardId: number) {
  const db = await getDb();
  const row = await db.get<{ id: number }>("SELECT id FROM favorites WHERE user_id = ? AND card_id = ?", userId, cardId);
  return Boolean(row);
}

export async function toggleFavorite(userId: number, cardId: number) {
  const db = await getDb();
  const exists = await isFavorite(userId, cardId);
  if (exists) {
    await db.run("DELETE FROM favorites WHERE user_id = ? AND card_id = ?", userId, cardId);
    return false;
  }

  await db.run("INSERT INTO favorites (user_id, card_id) VALUES (?, ?)", userId, cardId);
  return true;
}

export async function listFavoriteCards(userId: number) {
  const db = await getDb();
  return db.all<Card[]>(
    `SELECT cards.*
     FROM favorites
     JOIN cards ON cards.id = favorites.card_id
     WHERE favorites.user_id = ?
     ORDER BY favorites.created_at DESC`,
    userId,
  );
}
