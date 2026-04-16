"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const rootDir = node_path_1.default.resolve(node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.url)), "..", "..");
const webappDir = node_path_1.default.join(rootDir, "src", "webapp");
const publicDir = node_path_1.default.join(rootDir, "dist", "public");
async function ensurePublicFiles() {
    await promises_1.default.mkdir(node_path_1.default.join(publicDir, "assets"), { recursive: true });
    await promises_1.default.copyFile(node_path_1.default.join(webappDir, "index.html"), node_path_1.default.join(publicDir, "index.html"));
    await promises_1.default.copyFile(node_path_1.default.join(webappDir, "styles.css"), node_path_1.default.join(publicDir, "styles.css"));
}
async function buildWebapp() {
    await ensurePublicFiles();
    await execFileAsync("npx", ["tsc", "-p", "tsconfig.webapp.json"], {
        cwd: rootDir,
        windowsHide: true,
    });
}
buildWebapp().catch((error) => {
    process.stderr.write(`WebApp build failed: ${String(error)}\n`);
    process.exitCode = 1;
});
