import { getDb } from "../db/client";
import type { Curator } from "../types/entities";
import { setUserCurator } from "./users.service";

export async function listCurators() {
  const db = await getDb();
  return db.all<Curator[]>("SELECT * FROM curators WHERE is_active = 1 ORDER BY created_at DESC");
}

export async function getCuratorById(curatorId: number) {
  const db = await getDb();
  return db.get<Curator>("SELECT * FROM curators WHERE id = ?", curatorId);
}

export async function createCurator(name: string, description: string) {
  const db = await getDb();
  const result = await db.run("INSERT INTO curators (name, description, is_active) VALUES (?, ?, 1)", name, description);
  return getCuratorById(Number(result.lastID));
}

export async function deleteCurator(curatorId: number) {
  const db = await getDb();
  await db.run("UPDATE curators SET is_active = 0 WHERE id = ?", curatorId);
  await db.run("UPDATE users SET curator_id = NULL WHERE curator_id = ?", curatorId);
}

export async function assignCuratorToUser(userId: number, curatorId: number) {
  return setUserCurator(userId, curatorId);
}

export async function unassignCuratorFromUser(userId: number) {
  return setUserCurator(userId, null);
}
