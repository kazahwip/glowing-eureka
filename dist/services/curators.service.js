"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTelegramUsername = normalizeTelegramUsername;
exports.syncCuratorsForUser = syncCuratorsForUser;
exports.listCurators = listCurators;
exports.getCuratorById = getCuratorById;
exports.getCuratorWithUser = getCuratorWithUser;
exports.getCuratorByLinkedUserId = getCuratorByLinkedUserId;
exports.createCurator = createCurator;
exports.deleteCurator = deleteCurator;
exports.assignCuratorToUser = assignCuratorToUser;
exports.unassignCuratorFromUser = unassignCuratorFromUser;
exports.createCuratorRequest = createCuratorRequest;
exports.acceptCuratorRequest = acceptCuratorRequest;
exports.rejectCuratorRequest = rejectCuratorRequest;
const client_1 = require("../db/client");
const users_service_1 = require("./users.service");
function normalizeTelegramUsername(value) {
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
async function refreshCuratorLinkById(curatorId) {
    const db = await (0, client_1.getDb)();
    const curator = await db.get("SELECT * FROM curators WHERE id = ?", curatorId);
    if (!curator?.telegram_username) {
        return curator;
    }
    const linkedUser = await (0, users_service_1.getUserByUsername)(curator.telegram_username);
    if (linkedUser && linkedUser.id !== curator.linked_user_id) {
        await db.run("UPDATE curators SET linked_user_id = ? WHERE id = ?", linkedUser.id, curatorId);
        return db.get("SELECT * FROM curators WHERE id = ?", curatorId);
    }
    return curator;
}
async function syncCuratorsForUser(userId, username) {
    const normalized = normalizeTelegramUsername(username);
    if (!normalized) {
        return;
    }
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE curators SET linked_user_id = ? WHERE telegram_username IS NOT NULL AND LOWER(telegram_username) = LOWER(?)", userId, normalized);
}
async function listCurators() {
    const db = await (0, client_1.getDb)();
    const curators = await db.all("SELECT * FROM curators WHERE is_active = 1 ORDER BY created_at DESC");
    for (const curator of curators) {
        if (curator.telegram_username && !curator.linked_user_id) {
            await refreshCuratorLinkById(curator.id);
        }
    }
    return db.all("SELECT * FROM curators WHERE is_active = 1 ORDER BY created_at DESC");
}
async function getCuratorById(curatorId) {
    await refreshCuratorLinkById(curatorId);
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM curators WHERE id = ?", curatorId);
}
async function getCuratorWithUser(curatorId) {
    await refreshCuratorLinkById(curatorId);
    const db = await (0, client_1.getDb)();
    return db.get(`SELECT
      curators.*,
      users.telegram_id AS linked_telegram_id,
      users.username AS linked_username,
      users.first_name AS linked_first_name
     FROM curators
     LEFT JOIN users ON users.id = curators.linked_user_id
     WHERE curators.id = ?`, curatorId);
}
async function getCuratorByLinkedUserId(userId) {
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM curators WHERE linked_user_id = ? AND is_active = 1", userId);
}
async function createCurator(telegramUsername, name, description = "") {
    const normalizedUsername = normalizeTelegramUsername(telegramUsername);
    if (!normalizedUsername) {
        throw new Error("Некорректный username куратора.");
    }
    const linkedUser = await (0, users_service_1.getUserByUsername)(normalizedUsername);
    const db = await (0, client_1.getDb)();
    const existing = await db.get("SELECT * FROM curators WHERE telegram_username IS NOT NULL AND LOWER(telegram_username) = LOWER(?) ORDER BY id DESC LIMIT 1", normalizedUsername);
    if (existing) {
        await db.run(`UPDATE curators
       SET name = ?, telegram_username = ?, linked_user_id = ?, description = ?, is_active = 1
       WHERE id = ?`, name.trim(), normalizedUsername, linkedUser?.id ?? null, description.trim(), existing.id);
        return getCuratorById(existing.id);
    }
    const result = await db.run(`INSERT INTO curators (name, telegram_username, linked_user_id, description, is_active)
     VALUES (?, ?, ?, ?, 1)`, name.trim(), normalizedUsername, linkedUser?.id ?? null, description.trim());
    return getCuratorById(Number(result.lastID));
}
async function deleteCurator(curatorId) {
    const db = await (0, client_1.getDb)();
    const curator = await getCuratorById(curatorId);
    await db.run("UPDATE curators SET is_active = 0 WHERE id = ?", curatorId);
    await db.run("UPDATE users SET curator_id = NULL WHERE curator_id = ?", curatorId);
    await db.run(`UPDATE curator_requests
     SET status = 'rejected',
         reviewed_by_user_id = COALESCE(reviewed_by_user_id, ?),
         reviewed_at = CURRENT_TIMESTAMP
     WHERE curator_id = ? AND status = 'pending'`, curator?.linked_user_id ?? null, curatorId);
}
async function assignCuratorToUser(userId, curatorId) {
    return (0, users_service_1.setUserCurator)(userId, curatorId);
}
async function unassignCuratorFromUser(userId) {
    return (0, users_service_1.setUserCurator)(userId, null);
}
async function getCuratorRequestById(requestId) {
    const db = await (0, client_1.getDb)();
    return db.get(`SELECT
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
     WHERE curator_requests.id = ?`, requestId);
}
async function createCuratorRequest(userId, curatorId) {
    const db = await (0, client_1.getDb)();
    const curator = await getCuratorById(curatorId);
    if (!curator || curator.is_active !== 1) {
        return { status: "missing", request: null };
    }
    const resolvedCurator = await getCuratorById(curatorId);
    if (!resolvedCurator?.linked_user_id) {
        return { status: "unavailable", request: null };
    }
    if (resolvedCurator.linked_user_id === userId) {
        return { status: "self", request: null };
    }
    const worker = await (0, users_service_1.getUserById)(userId);
    if (!worker) {
        return { status: "worker_missing", request: null };
    }
    if (worker.curator_id === curatorId) {
        return { status: "already_assigned", request: null };
    }
    const existingPending = await db.get(`SELECT *
     FROM curator_requests
     WHERE user_id = ? AND curator_id = ? AND status = 'pending'
     ORDER BY id DESC
     LIMIT 1`, userId, curatorId);
    if (existingPending) {
        return { status: "pending_exists", request: await getCuratorRequestById(existingPending.id) };
    }
    const result = await db.run("INSERT INTO curator_requests (user_id, curator_id, status) VALUES (?, ?, 'pending')", userId, curatorId);
    return { status: "created", request: await getCuratorRequestById(Number(result.lastID)) };
}
async function reviewCuratorRequest(requestId, curatorUserId, decision) {
    const db = await (0, client_1.getDb)();
    const request = await getCuratorRequestById(requestId);
    if (!request) {
        return { status: "missing", request: null };
    }
    if (request.curator_linked_user_id !== curatorUserId) {
        return { status: "forbidden", request };
    }
    if (request.status !== "pending") {
        return { status: "processed", request };
    }
    await db.run(`UPDATE curator_requests
     SET status = ?, reviewed_by_user_id = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ?`, decision, curatorUserId, requestId);
    if (decision === "accepted") {
        await assignCuratorToUser(request.user_id, request.curator_id);
    }
    return { status: decision, request: await getCuratorRequestById(requestId) };
}
async function acceptCuratorRequest(requestId, curatorUserId) {
    return reviewCuratorRequest(requestId, curatorUserId, "accepted");
}
async function rejectCuratorRequest(requestId, curatorUserId) {
    return reviewCuratorRequest(requestId, curatorUserId, "rejected");
}
