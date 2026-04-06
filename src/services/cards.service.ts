import { getDb } from "../db/client";
import type { Card, CardCategory, CardPhoto, CardReviewStatus, CardWithPhotos } from "../types/entities";
import type { CardDraft } from "../types/context";

interface CreateCardOptions {
  reviewStatus?: CardReviewStatus;
  isActive?: boolean;
  source?: string;
}

export interface CardWithOwner extends CardWithPhotos {
  owner_telegram_id: number;
  owner_username: string | null;
  owner_first_name: string | null;
}

export async function createCard(ownerUserId: number, draft: CardDraft, options: CreateCardOptions = {}) {
  if (!draft.name || !draft.age || !draft.price1h || !draft.price3h || !draft.priceFullDay || !draft.photos?.length) {
    throw new Error("Черновик карточки заполнен не полностью.");
  }

  const reviewStatus = options.reviewStatus ?? "approved";
  const isActive = options.isActive ?? (reviewStatus === "approved" ? 1 : 0);
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO cards (
      owner_user_id,
      category,
      source,
      review_status,
      city,
      name,
      age,
      description,
      price_1h,
      price_3h,
      price_full_day,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ownerUserId,
    draft.category ?? "girls",
    options.source ?? "user",
    reviewStatus,
    draft.city ?? "Не указано",
    draft.name,
    draft.age,
    draft.description ?? "",
    draft.price1h,
    draft.price3h,
    draft.priceFullDay,
    isActive,
  );

  const cardId = Number(result.lastID);
  for (const photoId of draft.photos) {
    await db.run("INSERT INTO card_photos (card_id, telegram_file_id) VALUES (?, ?)", cardId, photoId);
  }

  return getCardById(cardId);
}

export async function getCardById(cardId: number): Promise<CardWithPhotos | null> {
  const db = await getDb();
  const card = await db.get<Card>("SELECT * FROM cards WHERE id = ?", cardId);
  if (!card) {
    return null;
  }

  const photos = await db.all<CardPhoto[]>("SELECT * FROM card_photos WHERE card_id = ? ORDER BY id ASC", cardId);
  return { ...card, photos };
}

export async function getCardWithOwner(cardId: number): Promise<CardWithOwner | null> {
  const db = await getDb();
  const card = await db.get<
    (Card & {
      owner_telegram_id: number;
      owner_username: string | null;
      owner_first_name: string | null;
    }) | null
  >(
    `SELECT
      cards.*,
      users.telegram_id AS owner_telegram_id,
      users.username AS owner_username,
      users.first_name AS owner_first_name
     FROM cards
     JOIN users ON users.id = cards.owner_user_id
     WHERE cards.id = ?`,
    cardId,
  );

  if (!card) {
    return null;
  }

  const photos = await db.all<CardPhoto[]>("SELECT * FROM card_photos WHERE card_id = ? ORDER BY id ASC", cardId);
  return { ...card, photos };
}

export async function updateCardPhotoReference(photoId: number, reference: string) {
  const db = await getDb();
  await db.run("UPDATE card_photos SET telegram_file_id = ? WHERE id = ?", reference, photoId);
}

export async function approveCard(cardId: number, adminUserId: number) {
  const db = await getDb();
  const card = await db.get<Card>("SELECT * FROM cards WHERE id = ?", cardId);
  if (!card) {
    return { status: "missing" as const, card: null };
  }

  if (card.review_status !== "pending") {
    return { status: "processed" as const, card: await getCardWithOwner(cardId) };
  }

  await db.run(
    `UPDATE cards
     SET review_status = 'approved',
         reviewed_by_user_id = ?,
         reviewed_at = CURRENT_TIMESTAMP,
         is_active = 1
     WHERE id = ?`,
    adminUserId,
    cardId,
  );

  return { status: "approved" as const, card: await getCardWithOwner(cardId) };
}

export async function rejectCard(cardId: number, adminUserId: number) {
  const db = await getDb();
  const card = await db.get<Card>("SELECT * FROM cards WHERE id = ?", cardId);
  if (!card) {
    return { status: "missing" as const, card: null };
  }

  if (card.review_status !== "pending") {
    return { status: "processed" as const, card: await getCardWithOwner(cardId) };
  }

  await db.run(
    `UPDATE cards
     SET review_status = 'rejected',
         reviewed_by_user_id = ?,
         reviewed_at = CURRENT_TIMESTAMP,
         is_active = 0
     WHERE id = ?`,
    adminUserId,
    cardId,
  );

  return { status: "rejected" as const, card: await getCardWithOwner(cardId) };
}

export async function listCardsByCity(city: string, category?: CardCategory) {
  const db = await getDb();
  if (category) {
    return db.all<Card[]>(
      "SELECT * FROM cards WHERE city = ? AND category = ? AND is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT 30",
      city,
      category,
    );
  }

  return db.all<Card[]>(
    "SELECT * FROM cards WHERE city = ? AND is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT 30",
    city,
  );
}

export async function listRecentCards(limit = 10, category?: CardCategory) {
  const db = await getDb();
  if (category) {
    return db.all<Card[]>(
      "SELECT * FROM cards WHERE category = ? AND is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT ?",
      category,
      limit,
    );
  }

  return db.all<Card[]>(
    "SELECT * FROM cards WHERE is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT ?",
    limit,
  );
}

export async function listCardsByOwner(ownerUserId: number) {
  const db = await getDb();
  return db.all<Card[]>("SELECT * FROM cards WHERE owner_user_id = ? ORDER BY created_at DESC", ownerUserId);
}

export async function countCards() {
  const db = await getDb();
  const row = await db.get<{ total: number }>("SELECT COUNT(*) AS total FROM cards");
  return row?.total ?? 0;
}

