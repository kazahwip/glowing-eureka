import { closeDb, getDb } from "./client";

async function main() {
  await getDb();
  await closeDb();
  process.stdout.write("База данных инициализирована.\n");
}

main().catch((error) => {
  process.stderr.write(`Ошибка инициализации БД: ${String(error)}\n`);
  process.exitCode = 1;
});
