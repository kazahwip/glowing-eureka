const fs = require("node:fs");
const path = require("node:path");

const entrypoint = path.join(__dirname, "dist", "apps", "bothost.js");

if (!fs.existsSync(entrypoint)) {
  process.stderr.write("Build not found. Run: npm install && npm run build\n");
  process.exit(1);
}

require(entrypoint);

