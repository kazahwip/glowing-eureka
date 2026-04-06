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
}
async function ensurePaymentRequestColumns(db) {
    const columns = await db.all("PRAGMA table_info(payment_requests)");
    const columnNames = new Set(columns.map((column) => column.name));
    if (!columnNames.has("worker_user_id")) {
        await db.exec("ALTER TABLE payment_requests ADD COLUMN worker_user_id INTEGER NULL;");
    }
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
async function applySchema(db) {
    const schema = node_fs_1.default.readFileSync(schemaPath, "utf8");
    await db.exec(schema);
    await ensureCardColumns(db);
    await ensureUserColumns(db);
    await ensurePaymentRequestColumns(db);
    await ensureCuratorColumns(db);
    await ensureCuratorRequestTable(db);
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
