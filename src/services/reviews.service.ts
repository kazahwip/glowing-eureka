import { getDb } from "../db/client";
import type { Review } from "../types/entities";

export async function listReviews(page = 1, limit = 5) {
  const db = await getDb();
  const offset = (page - 1) * limit;
  const items = await db.all<Review[]>(
    `SELECT reviews.*, users.username, users.first_name
     FROM reviews
     JOIN users ON users.id = reviews.user_id
     ORDER BY reviews.created_at DESC
     LIMIT ? OFFSET ?`,
    limit + 1,
    offset,
  );

  return {
    items: items.slice(0, limit),
    hasNext: items.length > limit,
  };
}

export async function createReview(userId: number, text: string) {
  const db = await getDb();
  await db.run("INSERT INTO reviews (user_id, text) VALUES (?, ?)", userId, text);
}
