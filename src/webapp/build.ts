import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const webappDir = path.join(rootDir, "src", "webapp");
const publicDir = path.join(rootDir, "dist", "public");

async function ensurePublicFiles() {
  await fs.mkdir(path.join(publicDir, "assets"), { recursive: true });
  await fs.copyFile(path.join(webappDir, "index.html"), path.join(publicDir, "index.html"));
  await fs.copyFile(path.join(webappDir, "styles.css"), path.join(publicDir, "styles.css"));
}

async function buildWebapp() {
  await ensurePublicFiles();
  await execFileAsync(process.execPath, [path.join(rootDir, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.webapp.json"], {
    cwd: rootDir,
    windowsHide: true,
  });
}

buildWebapp().catch((error) => {
  process.stderr.write(`WebApp build failed: ${String(error)}\n`);
  process.exitCode = 1;
});
