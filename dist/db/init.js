"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("./client");
async function main() {
    await (0, client_1.getDb)();
    await (0, client_1.closeDb)();
    process.stdout.write("База данных инициализирована.\n");
}
main().catch((error) => {
    process.stderr.write(`Ошибка инициализации БД: ${String(error)}\n`);
    process.exitCode = 1;
});
