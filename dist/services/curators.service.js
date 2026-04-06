"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCurators = listCurators;
exports.getCuratorById = getCuratorById;
exports.createCurator = createCurator;
exports.deleteCurator = deleteCurator;
exports.assignCuratorToUser = assignCuratorToUser;
exports.unassignCuratorFromUser = unassignCuratorFromUser;
const client_1 = require("../db/client");
const users_service_1 = require("./users.service");
async function listCurators() {
    const db = await (0, client_1.getDb)();
    return db.all("SELECT * FROM curators WHERE is_active = 1 ORDER BY created_at DESC");
}
async function getCuratorById(curatorId) {
    const db = await (0, client_1.getDb)();
    return db.get("SELECT * FROM curators WHERE id = ?", curatorId);
}
async function createCurator(name, description) {
    const db = await (0, client_1.getDb)();
    const result = await db.run("INSERT INTO curators (name, description, is_active) VALUES (?, ?, 1)", name, description);
    return getCuratorById(Number(result.lastID));
}
async function deleteCurator(curatorId) {
    const db = await (0, client_1.getDb)();
    await db.run("UPDATE curators SET is_active = 0 WHERE id = ?", curatorId);
    await db.run("UPDATE users SET curator_id = NULL WHERE curator_id = ?", curatorId);
}
async function assignCuratorToUser(userId, curatorId) {
    return (0, users_service_1.setUserCurator)(userId, curatorId);
}
async function unassignCuratorFromUser(userId) {
    return (0, users_service_1.setUserCurator)(userId, null);
}
