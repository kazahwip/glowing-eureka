"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCard = createCard;
exports.getCardById = getCardById;
exports.getCardWithOwner = getCardWithOwner;
exports.updateCardPhotoReference = updateCardPhotoReference;
exports.approveCard = approveCard;
exports.rejectCard = rejectCard;
exports.listCardsByCity = listCardsByCity;
exports.listRecentCards = listRecentCards;
exports.listInlineShareCards = listInlineShareCards;
exports.listCardsPaginated = listCardsPaginated;
exports.listCardsByOwner = listCardsByOwner;
exports.listRecentCardsForAdmin = listRecentCardsForAdmin;
exports.deleteCard = deleteCard;
exports.countCards = countCards;
const client_1 = require("../db/client");
async function createCard(ownerUserId, draft, options = {}) {
    if (!draft.name || !draft.age || !draft.price1h || !draft.price3h || !draft.priceFullDay || !draft.photos?.length) {
        throw new Error("Черновик карточки заполнен не полностью.");
    }
    const reviewStatus = options.reviewStatus ?? "approved";
    const isActive = options.isActive ?? (reviewStatus === "approved" ? 1 : 0);
    const db = await (0, client_1.getDb)();
    const result = await db.run(`INSERT INTO cards (
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ownerUserId, draft.category ?? "girls", options.source ?? "user", reviewStatus, draft.city ?? "Не указано", draft.name, draft.age, draft.description ?? "", draft.price1h, draft.price3h, draft.priceFullDay, isActive);
    const cardId = Number(result.lastID);
    for (const photoId of draft.photos) {
        await db.run("INSERT INTO card_photos (card_id, telegram_file_id) VALUES (?, ?)", cardId, photoId);
    }
    return getCardById(cardId);
}
async function getCardById(cardId) {
    const db = await (0, client_1.getDb)();
    const card = await db.get("SELECT * FROM cards WHERE id = ?", cardId);
    if (!card) {
        return null;
    }
    const photos = await db.all("SELECT * FROM card_photos WHERE card_id = ? ORDER BY id ASC", cardId);
    return { ...card, photos };
}
async function getCardWithOwner(cardId) {
    const db = await (0, client_1.getDb)();
    const card = await db.get(`SELECT
      cards.*,
      users.telegram_id AS owner_telegram_id,
      users.username AS owner_username,
      users.first_name AS owner_first_name
     FROM cards
     JOIN users ON users.id = cards.owner_user_id
     WHERE cards.id = ?`, cardId);
    if (!card) {
        return null;
    }
    const photos = await db.all("SELECT * FROM card_photos WHERE card_id = ? ORDER BY id ASC", cardId);
    return { ...card, photos };
}
async function updateCardPhotoReference(photoId, reference) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE card_photos SET telegram_file_id = ? WHERE id = ?", reference, photoId);
}
async function approveCard(cardId, adminUserId) {
    const db = await (0, client_1.getDb)();
    const card = await db.get("SELECT * FROM cards WHERE id = ?", cardId);
    if (!card) {
        return { status: "missing", card: null };
    }
    if (card.review_status !== "pending") {
        return { status: "processed", card: await getCardWithOwner(cardId) };
    }
    await db.run(`UPDATE cards
     SET review_status = 'approved',
         reviewed_by_user_id = ?,
         reviewed_at = CURRENT_TIMESTAMP,
         is_active = 1
     WHERE id = ?`, adminUserId, cardId);
    return { status: "approved", card: await getCardWithOwner(cardId) };
}
async function rejectCard(cardId, adminUserId) {
    const db = await (0, client_1.getDb)();
    const card = await db.get("SELECT * FROM cards WHERE id = ?", cardId);
    if (!card) {
        return { status: "missing", card: null };
    }
    if (card.review_status !== "pending") {
        return { status: "processed", card: await getCardWithOwner(cardId) };
    }
    await db.run(`UPDATE cards
     SET review_status = 'rejected',
         reviewed_by_user_id = ?,
         reviewed_at = CURRENT_TIMESTAMP,
         is_active = 0
     WHERE id = ?`, adminUserId, cardId);
    return { status: "rejected", card: await getCardWithOwner(cardId) };
}
async function listCardsByCity(city, category) {
    const db = await (0, client_1.getDb)();
    if (category) {
        return db.all("SELECT * FROM cards WHERE city = ? AND category = ? AND is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT 30", city, category);
    }
    return db.all("SELECT * FROM cards WHERE city = ? AND is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT 30", city);
}
async function listRecentCards(limit = 10, category) {
    const db = await (0, client_1.getDb)();
    if (category) {
        return db.all("SELECT * FROM cards WHERE category = ? AND is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT ?", category, limit);
    }
    return db.all("SELECT * FROM cards WHERE is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT ?", limit);
}
async function attachCardPhotos(cards) {
    const db = await (0, client_1.getDb)();
    const result = [];
    for (const card of cards) {
        const photos = await db.all("SELECT * FROM card_photos WHERE card_id = ? ORDER BY id ASC", card.id);
        result.push({ ...card, photos });
    }
    return result;
}
async function listInlineShareCards(query, limit = 20) {
    const db = await (0, client_1.getDb)();
    const normalized = query.trim();
    const cappedLimit = Math.max(1, Math.min(limit, 50));
    if (!normalized) {
        const cards = await db.all("SELECT * FROM cards WHERE is_active = 1 AND review_status = 'approved' ORDER BY created_at DESC LIMIT ?", cappedLimit);
        return attachCardPhotos(cards);
    }
    const conditions = ["is_active = 1", "review_status = 'approved'"];
    const params = [];
    const numericId = normalized.match(/^#?(\d+)$/)?.[1];
    if (numericId) {
        conditions.push("id = ?");
        params.push(Number(numericId));
    }
    else {
        conditions.push("(name LIKE ? OR city LIKE ?)");
        params.push(`%${normalized}%`, `%${normalized}%`);
    }
    const cards = await db.all(`SELECT * FROM cards WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ?`, ...params, cappedLimit);
    return attachCardPhotos(cards);
}
async function listCardsPaginated(options) {
    const db = await (0, client_1.getDb)();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, options.limit ?? 5);
    const offset = (page - 1) * limit;
    const conditions = ["is_active = 1", "review_status = 'approved'"];
    const params = [];
    if (options.category) {
        conditions.push("category = ?");
        params.push(options.category);
    }
    if (options.city) {
        conditions.push("city = ?");
        params.push(options.city);
    }
    const whereClause = conditions.join(" AND ");
    const totalRow = await db.get(`SELECT COUNT(*) AS total FROM cards WHERE ${whereClause}`, ...params);
    const items = await db.all(`SELECT * FROM cards WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
    return {
        page,
        limit,
        total: totalRow?.total ?? 0,
        items,
    };
}
async function listCardsByOwner(ownerUserId) {
    const db = await (0, client_1.getDb)();
    return db.all("SELECT * FROM cards WHERE owner_user_id = ? ORDER BY created_at DESC", ownerUserId);
}
async function listRecentCardsForAdmin(limit = 15) {
    const db = await (0, client_1.getDb)();
    return db.all("SELECT * FROM cards ORDER BY created_at DESC LIMIT ?", limit);
}
async function deleteCard(cardId) {
    const db = await (0, client_1.getDb)();
    const card = await getCardWithOwner(cardId);
    if (!card) {
        return null;
    }
    await db.run("DELETE FROM cards WHERE id = ?", cardId);
    return card;
}
async function countCards() {
    const db = await (0, client_1.getDb)();
    const row = await db.get("SELECT COUNT(*) AS total FROM cards");
    return row?.total ?? 0;
}
