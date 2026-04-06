import { getDb } from "../db/client";
import type { Curator, CuratorRequest } from "../types/entities";
import { getUserById, getUserByUsername, setUserCurator } from "./users.service";

export interface CuratorWithUser extends Curator {
  linked_telegram_id: number | null;
  linked_username: string | null;
  linked_first_name: string | null;
}

export interface CuratorRequestWithRelations extends CuratorRequest {
  worker_telegram_id: number;
  worker_username: string | null;
  worker_first_name: string | null;
  curator_name: string;
  curator_telegram_username: string | null;
  curator_linked_user_id: number | null;
  curator_linked_telegram_id: number | null;
}

export function normalizeTelegramUsername(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^@+/, "");
  if (!normalized) {
    return null;
  }

  if (!/^[A-Za-z0-9_]{4,32}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

async function refreshCuratorLinkById(curatorId: number) {
  const db = await getDb();
  const curator = await db.get<Curator>("SELECT * FROM curators WHERE id = ?", curatorId);
  if (!curator?.telegram_username) {
    return curator;
  }

  const linkedUser = await getUserByUsername(curator.telegram_username);
  if (linkedUser && linkedUser.id !== curator.linked_user_id) {
    await db.run("UPDATE curators SET linked_user_id = ? WHERE id = ?", linkedUser.id, curatorId);
    return db.get<Curator>("SELECT * FROM curators WHERE id = ?", curatorId);
  }

  return curator;
}

export async function syncCuratorsForUser(userId: number, username?: string | null) {
  const normalized = normalizeTelegramUsername(username);
  if (!normalized) {
    return;
  }

  const db = await getDb();
  await db.run(
    "UPDATE curators SET linked_user_id = ? WHERE telegram_username IS NOT NULL AND LOWER(telegram_username) = LOWER(?)",
    userId,
    normalized,
  );
}

export async function listCurators() {
  const db = await getDb();
  const curators = await db.all<Curator[]>("SELECT * FROM curators WHERE is_active = 1 ORDER BY created_at DESC");

  for (const curator of curators) {
    if (curator.telegram_username && !curator.linked_user_id) {
      await refreshCuratorLinkById(curator.id);
    }
  }

  return db.all<Curator[]>("SELECT * FROM curators WHERE is_active = 1 ORDER BY created_at DESC");
}

export async function getCuratorById(curatorId: number) {
  await refreshCuratorLinkById(curatorId);
  const db = await getDb();
  return db.get<Curator>("SELECT * FROM curators WHERE id = ?", curatorId);
}

export async function getCuratorWithUser(curatorId: number) {
  await refreshCuratorLinkById(curatorId);
  const db = await getDb();
  return db.get<CuratorWithUser>(
    `SELECT
      curators.*,
      users.telegram_id AS linked_telegram_id,
      users.username AS linked_username,
      users.first_name AS linked_first_name
     FROM curators
     LEFT JOIN users ON users.id = curators.linked_user_id
     WHERE curators.id = ?`,
    curatorId,
  );
}

export async function getCuratorByLinkedUserId(userId: number) {
  const db = await getDb();
  return db.get<Curator>("SELECT * FROM curators WHERE linked_user_id = ? AND is_active = 1", userId);
}

export async function createCurator(telegramUsername: string, name: string, description = "") {
  const normalizedUsername = normalizeTelegramUsername(telegramUsername);
  if (!normalizedUsername) {
    throw new Error("Некорректный username куратора.");
  }

  const linkedUser = await getUserByUsername(normalizedUsername);
  const db = await getDb();
  const existing = await db.get<Curator>(
    "SELECT * FROM curators WHERE telegram_username IS NOT NULL AND LOWER(telegram_username) = LOWER(?) ORDER BY id DESC LIMIT 1",
    normalizedUsername,
  );

  if (existing) {
    await db.run(
      `UPDATE curators
       SET name = ?, telegram_username = ?, linked_user_id = ?, description = ?, is_active = 1
       WHERE id = ?`,
      name.trim(),
      normalizedUsername,
      linkedUser?.id ?? null,
      description.trim(),
      existing.id,
    );

    return getCuratorById(existing.id);
  }

  const result = await db.run(
    `INSERT INTO curators (name, telegram_username, linked_user_id, description, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    name.trim(),
    normalizedUsername,
    linkedUser?.id ?? null,
    description.trim(),
  );

  return getCuratorById(Number(result.lastID));
}

export async function deleteCurator(curatorId: number) {
  const db = await getDb();
  const curator = await getCuratorById(curatorId);

  await db.run("UPDATE curators SET is_active = 0 WHERE id = ?", curatorId);
  await db.run("UPDATE users SET curator_id = NULL WHERE curator_id = ?", curatorId);
  await db.run(
    `UPDATE curator_requests
     SET status = 'rejected',
         reviewed_by_user_id = COALESCE(reviewed_by_user_id, ?),
         reviewed_at = CURRENT_TIMESTAMP
     WHERE curator_id = ? AND status = 'pending'`,
    curator?.linked_user_id ?? null,
    curatorId,
  );
}

export async function assignCuratorToUser(userId: number, curatorId: number) {
  return setUserCurator(userId, curatorId);
}

export async function unassignCuratorFromUser(userId: number) {
  return setUserCurator(userId, null);
}

async function getCuratorRequestById(requestId: number) {
  const db = await getDb();
  return db.get<CuratorRequestWithRelations>(
    `SELECT
      curator_requests.*,
      workers.telegram_id AS worker_telegram_id,
      workers.username AS worker_username,
      workers.first_name AS worker_first_name,
      curators.name AS curator_name,
      curators.telegram_username AS curator_telegram_username,
      curators.linked_user_id AS curator_linked_user_id,
      recipients.telegram_id AS curator_linked_telegram_id
     FROM curator_requests
     JOIN users AS workers ON workers.id = curator_requests.user_id
     JOIN curators ON curators.id = curator_requests.curator_id
     LEFT JOIN users AS recipients ON recipients.id = curators.linked_user_id
     WHERE curator_requests.id = ?`,
    requestId,
  );
}

export async function createCuratorRequest(userId: number, curatorId: number) {
  const db = await getDb();
  const curator = await getCuratorById(curatorId);
  if (!curator || curator.is_active !== 1) {
    return { status: "missing" as const, request: null };
  }

  const resolvedCurator = await getCuratorById(curatorId);
  if (!resolvedCurator?.linked_user_id) {
    return { status: "unavailable" as const, request: null };
  }

  if (resolvedCurator.linked_user_id === userId) {
    return { status: "self" as const, request: null };
  }

  const worker = await getUserById(userId);
  if (!worker) {
    return { status: "worker_missing" as const, request: null };
  }

  if (worker.curator_id === curatorId) {
    return { status: "already_assigned" as const, request: null };
  }

  const existingPending = await db.get<CuratorRequest>(
    `SELECT *
     FROM curator_requests
     WHERE user_id = ? AND curator_id = ? AND status = 'pending'
     ORDER BY id DESC
     LIMIT 1`,
    userId,
    curatorId,
  );

  if (existingPending) {
    return { status: "pending_exists" as const, request: await getCuratorRequestById(existingPending.id) };
  }

  const result = await db.run(
    "INSERT INTO curator_requests (user_id, curator_id, status) VALUES (?, ?, 'pending')",
    userId,
    curatorId,
  );

  return { status: "created" as const, request: await getCuratorRequestById(Number(result.lastID)) };
}

async function reviewCuratorRequest(requestId: number, curatorUserId: number, decision: "accepted" | "rejected") {
  const db = await getDb();
  const request = await getCuratorRequestById(requestId);
  if (!request) {
    return { status: "missing" as const, request: null };
  }

  if (request.curator_linked_user_id !== curatorUserId) {
    return { status: "forbidden" as const, request };
  }

  if (request.status !== "pending") {
    return { status: "processed" as const, request };
  }

  await db.run(
    `UPDATE curator_requests
     SET status = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    decision,
    curatorUserId,
    requestId,
  );

  if (decision === "accepted") {
    await assignCuratorToUser(request.user_id, request.curator_id);
  }

  return { status: decision as "accepted" | "rejected", request: await getCuratorRequestById(requestId) };
}

export async function acceptCuratorRequest(requestId: number, curatorUserId: number) {
  return reviewCuratorRequest(requestId, curatorUserId, "accepted");
}

export async function rejectCuratorRequest(requestId: number, curatorUserId: number) {
  return reviewCuratorRequest(requestId, curatorUserId, "rejected");
}
