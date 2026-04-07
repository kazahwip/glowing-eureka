import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";
import { config } from "../config/env";

let databasePromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null;

const schemaPath = path.resolve(process.cwd(), "db/schema.sql");

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

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

  if (!columnNames.has("withdrawable_balance")) {
    await db.exec("ALTER TABLE users ADD COLUMN withdrawable_balance REAL NOT NULL DEFAULT 0;");
  }

  if (!columnNames.has("signal_new_referrals")) {
    await db.exec("ALTER TABLE users ADD COLUMN signal_new_referrals INTEGER NOT NULL DEFAULT 1;");
  }

  if (!columnNames.has("signal_navigation")) {
    await db.exec("ALTER TABLE users ADD COLUMN signal_navigation INTEGER NOT NULL DEFAULT 1;");
  }

  if (!columnNames.has("signal_search")) {
    await db.exec("ALTER TABLE users ADD COLUMN signal_search INTEGER NOT NULL DEFAULT 1;");
  }

  if (!columnNames.has("signal_payments")) {
    await db.exec("ALTER TABLE users ADD COLUMN signal_payments INTEGER NOT NULL DEFAULT 1;");
  }

  if (!columnNames.has("signal_bookings")) {
    await db.exec("ALTER TABLE users ADD COLUMN signal_bookings INTEGER NOT NULL DEFAULT 1;");
  }
}

async function ensurePaymentRequestColumns(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const columns = await db.all<Array<{ name: string }>>("PRAGMA table_info(payment_requests)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("worker_user_id")) {
    await db.exec("ALTER TABLE payment_requests ADD COLUMN worker_user_id INTEGER NULL;");
  }

  if (!columnNames.has("worker_share_amount")) {
    await db.exec("ALTER TABLE payment_requests ADD COLUMN worker_share_amount REAL NOT NULL DEFAULT 0;");
  }

  if (!columnNames.has("curator_user_id")) {
    await db.exec("ALTER TABLE payment_requests ADD COLUMN curator_user_id INTEGER NULL;");
  }

  if (!columnNames.has("curator_share_amount")) {
    await db.exec("ALTER TABLE payment_requests ADD COLUMN curator_share_amount REAL NOT NULL DEFAULT 0;");
  }
}

async function ensureCuratorColumns(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const columns = await db.all<Array<{ name: string }>>("PRAGMA table_info(curators)");
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("telegram_username")) {
    await db.exec("ALTER TABLE curators ADD COLUMN telegram_username TEXT NULL;");
  }

  if (!columnNames.has("linked_user_id")) {
    await db.exec("ALTER TABLE curators ADD COLUMN linked_user_id INTEGER NULL;");
  }

  await db.exec("CREATE INDEX IF NOT EXISTS idx_curators_linked_user_id ON curators(linked_user_id);");
  await db.run(
    `UPDATE curators
     SET linked_user_id = (
       SELECT users.id
       FROM users
       WHERE users.username IS NOT NULL AND LOWER(users.username) = LOWER(curators.telegram_username)
       LIMIT 1
     )
     WHERE linked_user_id IS NULL
       AND telegram_username IS NOT NULL
       AND telegram_username != ''`,
  );
}

async function ensureCuratorRequestTable(db: Database<sqlite3.Database, sqlite3.Statement>) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS curator_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      curator_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by_user_id INTEGER NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (curator_id) REFERENCES curators(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
}

async function syncPayoutData(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const approvedRequests = await db.all<
    Array<{
      id: number;
      amount: number;
      worker_user_id: number | null;
      worker_share_amount: number;
      curator_user_id: number | null;
      curator_share_amount: number;
    }>
  >(
    `SELECT
      id,
      amount,
      worker_user_id,
      worker_share_amount,
      curator_user_id,
      curator_share_amount
     FROM payment_requests
     WHERE status = 'approved'`,
  );

  for (const request of approvedRequests) {
    let workerShareAmount = 0;
    let curatorUserId: number | null = null;
    let curatorShareAmount = 0;

    if (request.worker_user_id) {
      workerShareAmount = roundMoney(request.amount * 0.25);
      const row = await db.get<{ curatorUserId: number | null }>(
        `SELECT curators.linked_user_id AS curatorUserId
         FROM users
         LEFT JOIN curators ON curators.id = users.curator_id AND curators.is_active = 1
         WHERE users.id = ?`,
        request.worker_user_id,
      );

      curatorUserId = row?.curatorUserId ?? null;
      if (curatorUserId) {
        curatorShareAmount = roundMoney(request.amount * 0.1);
      }
    }

    if (
      request.worker_share_amount !== workerShareAmount ||
      request.curator_user_id !== curatorUserId ||
      request.curator_share_amount !== curatorShareAmount
    ) {
      await db.run(
        `UPDATE payment_requests
         SET worker_share_amount = ?, curator_user_id = ?, curator_share_amount = ?
         WHERE id = ?`,
        workerShareAmount,
        curatorUserId,
        curatorShareAmount,
        request.id,
      );
    }
  }

  await db.run("UPDATE users SET withdrawable_balance = 0, total_profit = 0, avg_profit = 0, best_profit = 0");

  const userProfitRows = await db.all<
    Array<{
      userId: number;
      totalProfit: number;
      avgProfit: number;
      bestProfit: number;
    }>
  >(
    `SELECT
      user_id AS userId,
      ROUND(COALESCE(SUM(share_amount), 0), 2) AS totalProfit,
      ROUND(COALESCE(AVG(share_amount), 0), 2) AS avgProfit,
      ROUND(COALESCE(MAX(share_amount), 0), 2) AS bestProfit
     FROM (
       SELECT worker_user_id AS user_id, worker_share_amount AS share_amount
       FROM payment_requests
       WHERE status = 'approved' AND worker_user_id IS NOT NULL AND worker_share_amount > 0
       UNION ALL
       SELECT curator_user_id AS user_id, curator_share_amount AS share_amount
       FROM payment_requests
       WHERE status = 'approved' AND curator_user_id IS NOT NULL AND curator_share_amount > 0
     )
     GROUP BY user_id`,
  );

  for (const row of userProfitRows) {
    await db.run(
      `UPDATE users
       SET withdrawable_balance = ?, total_profit = ?, avg_profit = ?, best_profit = ?
       WHERE id = ?`,
      row.totalProfit,
      row.totalProfit,
      row.avgProfit,
      row.bestProfit,
      row.userId,
    );
  }
}

async function applySchema(db: Database<sqlite3.Database, sqlite3.Statement>) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  await db.exec(schema);
  await ensureCardColumns(db);
  await ensureUserColumns(db);
  await ensurePaymentRequestColumns(db);
  await ensureCuratorColumns(db);
  await ensureCuratorRequestTable(db);
  await syncPayoutData(db);
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
