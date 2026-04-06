# Awake Bots

Два связанных Telegram-бота на `Node.js + TypeScript + Telegraf`:

- `teambot` для команды, карточек, профилей, кассы и админ-панели
- `servicebot` для каталога, профиля клиента, отзывов, поддержки и воркер-панели

Оба бота работают с общей БД и общей бизнес-логикой.

## Стек

- Node.js 20+
- TypeScript
- Telegraf 4
- SQLite

## Структура проекта

```text
assets/
  servicebot/
  teambot/
db/
  schema.sql
src/
  apps/
  config/
  db/
  handlers/
  keyboards/
  middlewares/
  scenes/
  services/
  types/
  utils/
.env.example
package.json
README.md
tsconfig.json
```

## Локальный запуск

1. Скопируйте `.env.example` в `.env`
2. Заполните:
   - `TEAMBOT_TOKEN`
   - `SERVICEBOT_TOKEN`
   - `ADMIN_TELEGRAM_IDS`
   - `SUPPORT_NOTIFY_IDS`
3. Установите зависимости:

```bash
npm install
```

4. Инициализируйте БД:

```bash
npm run db:init
```

5. Для разработки запустите в двух терминалах:

```bash
npm run dev:team
npm run dev:service
```

## Production

```bash
npm run build
npm run start:team
npm run start:service
```

## Изображения

Папки для баннеров:

- `assets/teambot/menu.png`
- `assets/teambot/bot.png`
- `assets/teambot/karta.png`
- `assets/teambot/profile.png`
- `assets/teambot/curators.png`
- `assets/teambot/info.png`
- `assets/servicebot/menu.jpg`

Если изображение отсутствует, бот отправит экран без падения, с graceful fallback на текст.

## База данных

Основные таблицы:

- `users`
- `curators`
- `cards`
- `card_photos`
- `clients`
- `bookings`
- `payment_requests`
- `reviews`
- `support_tickets`
- `settings`
- `admin_logs`
- `error_logs`
- `favorites`

Схема лежит в [db/schema.sql](./db/schema.sql).

## Как связаны боты

- оба используют общую таблицу `users`
- регистрация в `teambot` автоматически открывает воркер-доступ в `servicebot`
- `/awake` в `servicebot` вручную поднимает флаг `has_worker_access`
- воркерские реферальные ссылки создаются в `teambot`, а действия клиента в `servicebot` могут уходить воркеру в личные сообщения `teambot`

## Bothost.ru

Проект адаптирован под деплой на Bothost через один и тот же GitHub-репозиторий.

### Что уже подготовлено

- добавлен единый launcher: `src/apps/bothost.ts`
- `npm start` запускает нужного бота через переменную `BOT_INSTANCE`
- есть `.env.example` под прод-окружение
- `.gitignore` исключает `.env`, `data/`, `logs/`, `dist/` и `node_modules`

### Как деплоить на Bothost

According to the official Bothost Telegram hosting page, сервис поддерживает Git Deploy, преднастроенное Node.js/JS-окружение для `Telegraf`, Long Polling и Webhook, а также автоперезапуск и env-переменные: https://bothost.ru/telegram-bots

Рекомендуемая схема для этого проекта:

1. Создайте **два проекта** на Bothost из одного и того же GitHub-репозитория.
2. В первом проекте задайте:
   - `BOT_INSTANCE=teambot`
3. Во втором проекте задайте:
   - `BOT_INSTANCE=servicebot`
4. В обоих проектах укажите:
   - `TEAMBOT_TOKEN`
   - `SERVICEBOT_TOKEN`
   - `ADMIN_TELEGRAM_IDS`
   - `SUPPORT_NOTIFY_IDS`
   - `PROJECT_START_DATE`
   - `PROJECT_PAYOUT_PERCENT`
   - `DEFAULT_TRANSFER_DETAILS`
5. Build command:

```bash
npm install && npm run build
```

6. Start command:

```bash
npm start
```

### Важно по хранилищу

- если используете SQLite, путь `DATABASE_PATH` должен указывать на **постоянное хранилище** Bothost, иначе БД потеряется после пересоздания контейнера
- если на тарифе нет постоянного volume, лучше вынести БД во внешний PostgreSQL
- для `servicebot` demo-каталог и локальные фото пересоздаются/скачиваются в `data/media`, поэтому это тоже лучше хранить на persistent storage

### Рекомендуемая env-конфигурация для Bothost

Пример:

```env
NODE_ENV=production
BOT_INSTANCE=teambot
TEAMBOT_TOKEN=...
SERVICEBOT_TOKEN=...
ADMIN_TELEGRAM_IDS=123456789
SUPPORT_NOTIFY_IDS=123456789
DATABASE_PATH=/workspace/data/awake.sqlite
TEAMBOT_ASSETS_DIR=./assets/teambot
SERVICEBOT_ASSETS_DIR=./assets/servicebot
PROJECT_START_DATE=2026-04-06
PROJECT_PAYOUT_PERCENT=75
DEFAULT_TRANSFER_DETAILS=2200701789834873 Т-банк
```

Если у вас volume примонтирован в другой путь, просто поменяйте `DATABASE_PATH`.

## Команды

### teambot

- `/start`
- `/kassa`
- `/admin`

### servicebot

- `/start`
- `/awake`
- `/worker`

