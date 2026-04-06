import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { config } from "../config/env";

let databasePromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null;

const schemaPath = path.resolve(process.cwd(), "db/schema.sql");

async function ensureCardColumns(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const columns = await db.all<Array<{ name: string }>>("PRAGMA table_info(cards)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("category")) {
    await db.exec("ALTER TABLE cards ADD COLUMN category TEXT NOT NULL DEFAULT 'girls';");
  }

  if (!columnNames.has("source")) {
    await db.exec("ALTER TABLE cards ADD COLUMN source TEXT NOT NULL DEFAULT 'user';");
  }

  if (!columnNames.has("review_status")) {
    await db.exec("ALTER TABLE cards ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved';");
  }

  if (!columnNames.has("reviewed_by_user_id")) {
    await db.exec("ALTER TABLE cards ADD COLUMN reviewed_by_user_id INTEGER NULL;");
  }

  if (!columnNames.has("reviewed_at")) {
    await db.exec("ALTER TABLE cards ADD COLUMN reviewed_at TEXT NULL;");
  }

  await db.run("UPDATE cards SET category = 'girls' WHERE category IS NULL OR category = ''");
  await db.run("UPDATE cards SET source = 'user' WHERE source IS NULL OR source = ''");
  await db.run("UPDATE cards SET review_status = 'approved' WHERE review_status IS NULL OR review_status = ''");
}

async function ensureUserColumns(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const columns = await db.all<Array<{ name: string }>>("PRAGMA table_info(users)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("referred_by_user_id")) {
    await db.exec("ALTER TABLE users ADD COLUMN referred_by_user_id INTEGER NULL;");
  }
}

async function ensurePaymentRequestColumns(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const columns = await db.all<Array<{ name: string }>>("PRAGMA table_info(payment_requests)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("worker_user_id")) {
    await db.exec("ALTER TABLE payment_requests ADD COLUMN worker_user_id INTEGER NULL;");
  }
}

async function applySchema(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  await db.exec(schema);
  await ensureCardColumns(db);
  await ensureUserColumns(db);
  await ensurePaymentRequestColumns(db);
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [
    "transfer_details",
    config.defaultTransferDetails,
  ]);
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [
    "project_payout_percent",
    String(config.defaultPayoutPercent),
  ]);
}

export async function getDb() {
  if (!databasePromise) {
    const directory = path.dirname(config.databasePath);
    fs.mkdirSync(directory, { recursive: true });
    databasePromise = open({
      filename: config.databasePath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec("PRAGMA foreign_keys = ON;");
      await applySchema(db);
      return db;
    });
  }

  return databasePromise;
}

export async function closeDb() {
  if (!databasePromise) {
    return;
  }

  const db = await databasePromise;
  await db.close();
  databasePromise = null;
}
