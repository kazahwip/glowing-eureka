const instance = process.env.BOT_INSTANCE?.trim().toLowerCase();

async function bootstrap() {
  if (instance === "teambot") {
    await import("./teambot");
    return;
  }

  if (instance === "servicebot") {
    await import("./servicebot");
    return;
  }

  throw new Error("Не задан BOT_INSTANCE. Укажите 'teambot' или 'servicebot'.");
}

bootstrap().catch((error) => {
  process.stderr.write(`Ошибка запуска bothost launcher: ${String(error)}\n`);
  process.exitCode = 1;
});

