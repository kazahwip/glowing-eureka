"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.closeDb = closeDb;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const env_1 = require("../config/env");
let databasePromise = null;
const schemaPath = node_path_1.default.resolve(process.cwd(), "db/schema.sql");
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
async function ensureCardColumns(db) {
    const columns = await db.all("PRAGMA table_info(cards)");
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
async function ensureUserColumns(db) {
    const columns = await db.all("PRAGMA table_info(users)");
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
async function ensurePaymentRequestColumns(db) {
    const columns = await db.all("PRAGMA table_info(payment_requests)");
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
    if (!columnNames.has("source")) {
        await db.exec("ALTER TABLE payment_requests ADD COLUMN source TEXT NOT NULL DEFAULT 'honeybunny';");
    }
    await db.run("UPDATE payment_requests SET source = 'honeybunny' WHERE source IS NULL OR source = ''");
}
async function ensureCuratorColumns(db) {
    const columns = await db.all("PRAGMA table_info(curators)");
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("telegram_username")) {
        await db.exec("ALTER TABLE curators ADD COLUMN telegram_username TEXT NULL;");
    }
    if (!columnNames.has("linked_user_id")) {
        await db.exec("ALTER TABLE curators ADD COLUMN linked_user_id INTEGER NULL;");
    }
    await db.exec("CREATE INDEX IF NOT EXISTS idx_curators_linked_user_id ON curators(linked_user_id);");
    await db.run(`UPDATE curators
     SET linked_user_id = (
       SELECT users.id
       FROM users
       WHERE users.username IS NOT NULL AND LOWER(users.username) = LOWER(curators.telegram_username)
       LIMIT 1
     )
     WHERE linked_user_id IS NULL
       AND telegram_username IS NOT NULL
       AND telegram_username != ''`);
}
async function ensureCuratorRequestTable(db) {
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
async function syncPayoutData(db) {
    const approvedRequests = await db.all(`SELECT
      id,
      amount,
      worker_user_id,
      worker_share_amount,
      curator_user_id,
      curator_share_amount
     FROM payment_requests
     WHERE status = 'approved'`);
    for (const request of approvedRequests) {
        let workerShareAmount = 0;
        let curatorUserId = null;
        let curatorShareAmount = 0;
        if (request.worker_user_id) {
            const worker = await db.get("SELECT role FROM users WHERE id = ?", request.worker_user_id);
            if (worker?.role === "admin") {
                workerShareAmount = roundMoney(request.amount);
            }
            else {
                workerShareAmount = roundMoney(request.amount * 0.25);
                const row = await db.get(`SELECT curators.linked_user_id AS curatorUserId
           FROM users
           LEFT JOIN curators ON curators.id = users.curator_id AND curators.is_active = 1
           WHERE users.id = ?`, request.worker_user_id);
                curatorUserId = row?.curatorUserId ?? null;
                if (curatorUserId) {
                    curatorShareAmount = roundMoney(request.amount * 0.1);
                }
            }
        }
        if (request.worker_share_amount !== workerShareAmount ||
            request.curator_user_id !== curatorUserId ||
            request.curator_share_amount !== curatorShareAmount) {
            await db.run(`UPDATE payment_requests
         SET worker_share_amount = ?, curator_user_id = ?, curator_share_amount = ?
         WHERE id = ?`, workerShareAmount, curatorUserId, curatorShareAmount, request.id);
        }
    }
    await db.run("UPDATE users SET withdrawable_balance = 0, total_profit = 0, avg_profit = 0, best_profit = 0");
    const userProfitRows = await db.all(`SELECT
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
     GROUP BY user_id`);
    for (const row of userProfitRows) {
        await db.run(`UPDATE users
       SET withdrawable_balance = ?, total_profit = ?, avg_profit = ?, best_profit = ?
       WHERE id = ?`, row.totalProfit, row.totalProfit, row.avgProfit, row.bestProfit, row.userId);
    }
}
async function applySchema(db) {
    const schema = node_fs_1.default.readFileSync(schemaPath, "utf8");
    await db.exec(schema);
    await ensureCardColumns(db);
    await ensureUserColumns(db);
    await ensurePaymentRequestColumns(db);
    await ensureCuratorColumns(db);
    await ensureCuratorRequestTable(db);
    await syncPayoutData(db);
    await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [
        "transfer_details",
        env_1.config.defaultTransferDetails,
    ]);
    await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", [
        "project_payout_percent",
        String(env_1.config.defaultPayoutPercent),
    ]);
}
async function getDb() {
    if (!databasePromise) {
        const directory = node_path_1.default.dirname(env_1.config.databasePath);
        node_fs_1.default.mkdirSync(directory, { recursive: true });
        databasePromise = (0, sqlite_1.open)({
            filename: env_1.config.databasePath,
            driver: sqlite3_1.default.Database,
        }).then(async (db) => {
            await db.exec("PRAGMA foreign_keys = ON;");
            await applySchema(db);
            return db;
        });
    }
    return databasePromise;
}
async function closeDb() {
    if (!databasePromise) {
        return;
    }
    const db = await databasePromise;
    await db.close();
    databasePromise = null;
}
