# Awake Bots

Два связанных Telegram-бота на `Node.js + TypeScript + Telegraf`:

- `teambot` для внутренней работы команды, профилей, карточек и админ-панели
- `servicebot` для клиентского каталога, профиля, отзывов, поддержки и воркер-панели

Оба бота работают с общей БД и общей бизнес-логикой.

## Стек

- Node.js 18+
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
bothost.js
teambot.js
servicebot.js
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
- реферальные ссылки создаются в `teambot`, а действия клиента в `servicebot` могут уходить воркеру в личные сообщения `teambot`

## Bothost.ru

Проект адаптирован под деплой на Bothost в **один проект**: `bothost.js` поднимает `teambot` и `servicebot` одновременно.

### Что уже подготовлено

- общий launcher: `src/apps/bothost.ts`
- root-launcher `bothost.js` для панелей, которые ждут главный файл в корне проекта
- `npm start` запускает оба Telegram-бота сразу
- `teambot.js` и `servicebot.js` оставлены для одиночного запуска
- `BOT_INSTANCE` больше не нужен для основного деплоя, но оставлен как legacy-режим

### Как деплоить на Bothost

According to the official Bothost Telegram hosting page, сервис поддерживает Git Deploy, Node.js/JS-окружение для `Telegraf`, Long Polling/Webhook, env-переменные и автоперезапуск: https://bothost.ru/telegram-bots

1. Создайте **один** проект на Bothost.
2. Укажите:
   - `TEAMBOT_TOKEN`
   - `SERVICEBOT_TOKEN`
   - `ADMIN_TELEGRAM_IDS`
   - `SUPPORT_NOTIFY_IDS`
   - `PROJECT_START_DATE`
   - `PROJECT_PAYOUT_PERCENT`
   - `DEFAULT_TRANSFER_DETAILS`
3. Build command:

```bash
npm install && npm run build
```

4. Start command:

```bash
npm start
```

5. Если в панели есть поле `Главный файл`, указывайте:

```text
bothost.js
```

### Важно по хранилищу

- если используете SQLite, путь `DATABASE_PATH` должен указывать на постоянное хранилище Bothost, иначе БД потеряется после пересоздания контейнера
- если на тарифе нет постоянного volume, лучше вынести БД во внешний PostgreSQL
- demo-каталог и локальные фото сохраняются в `data/media`, поэтому их тоже лучше хранить на persistent storage

### Рекомендуемая env-конфигурация для Bothost

```env
NODE_ENV=production
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

`BOT_INSTANCE` можно не задавать. Если вы всё же хотите вручную запустить только один бот через `bothost.js`, допустимы значения `teambot` или `servicebot`.

## Команды

### teambot

- `/start`
- `/kassa`
- `/admin`

### servicebot

- `/start`
- `/awake`
- `/worker`
