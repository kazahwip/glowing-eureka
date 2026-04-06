import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { getDb } from "../db/client";
import type { CardCategory } from "../types/entities";

const MODELS_DIR = path.resolve(process.cwd(), "models");
const MEDIA_ROOT_DIR = path.resolve(process.cwd(), "data", "media");
const DEMO_OWNER_TELEGRAM_ID = 7000000001;

interface DemoCardBlueprint {
  name: string;
  age: number;
  city: string;
  category: CardCategory;
  description: string;
}

const DEMO_CARD_BLUEPRINTS: DemoCardBlueprint[] = [
  { name: "Лана", age: 24, city: "Санкт-Петербург", category: "girls", description: "Премиальный стиль, уверенная работа в кадре и спокойная подача на закрытых событиях." },
  { name: "Ева", age: 22, city: "Москва", category: "girls", description: "Лёгкая коммуникация, точность по таймингу и аккуратный образ для съёмок и мероприятий." },
  { name: "Алина", age: 25, city: "Москва", category: "girls", description: "Подходит для презентаций, бренд-сессий и вечерних форматов с камерной атмосферой." },
  { name: "Милана", age: 23, city: "Москва", category: "pepper", description: "Яркий образ, уверенное поведение на площадке и высокая вовлечённость в проект." },
  { name: "Виктория", age: 26, city: "Москва", category: "girls", description: "Статусная подача, деликатное общение и аккуратная работа с запросами клиента." },
  { name: "София", age: 24, city: "Москва", category: "pepper", description: "Выразительная внешность, гибкая адаптация под формат события и ровный сервис." },
  { name: "Кира", age: 22, city: "Москва", category: "girls", description: "Современный стиль, хорошая динамика в кадре и спокойная коммуникация без суеты." },
  { name: "Полина", age: 27, city: "Москва", category: "pepper", description: "Энергичная подача, собранность и умение поддержать атмосферу на частном ивенте." },
  { name: "Диана", age: 23, city: "Москва", category: "girls", description: "Премиальный визуал, пунктуальность и комфортное взаимодействие на длинных сменах." },
  { name: "Лилия", age: 25, city: "Санкт-Петербург", category: "pepper", description: "Хорошо чувствует площадку, уверенно работает на съёмках и держит нужный ритм." },
  { name: "Арина", age: 24, city: "Санкт-Петербург", category: "girls", description: "Спокойная энергия, чистый образ и внимательное отношение к деталям заказа." },
  { name: "Вероника", age: 26, city: "Санкт-Петербург", category: "pepper", description: "Эффектная подача, гибкость по формату и комфортная работа в приватных пространствах." },
  { name: "Марта", age: 22, city: "Санкт-Петербург", category: "girls", description: "Аккуратный визуал, дисциплина по графику и лёгкое общение с гостями мероприятия." },
  { name: "Таисия", age: 24, city: "Екатеринбург", category: "girls", description: "Уверенная работа в кадре, собранность и ровный темп на продолжительных проектах." },
  { name: "Ника", age: 23, city: "Екатеринбург", category: "pepper", description: "Яркая визуальная подача, точное попадание в референс и комфортное сопровождение съёмки." },
  { name: "Олеся", age: 27, city: "Екатеринбург", category: "girls", description: "Спокойная коммуникация, статусный образ и хороший отклик от постоянных заказчиков." },
  { name: "Карина", age: 25, city: "Екатеринбург", category: "pepper", description: "Выразительный стиль, динамичная работа на площадке и уверенная презентация образа." },
  { name: "Мира", age: 22, city: "Нижний Новгород", category: "girls", description: "Лёгкий характер, аккуратность и хороший ритм для дневных и вечерних событий." },
  { name: "Элина", age: 24, city: "Нижний Новгород", category: "pepper", description: "Яркий визуал, спокойная манера общения и уверенная работа на камерных мероприятиях." },
  { name: "Адель", age: 26, city: "Нижний Новгород", category: "girls", description: "Премиальная подача, пунктуальность и комфортная коммуникация на длинных слотах." },
  { name: "Яна", age: 23, city: "Архангельск", category: "girls", description: "Чистый стиль, уверенная работа с камерой и лёгкая адаптация под темп события." },
  { name: "Василиса", age: 25, city: "Архангельск", category: "pepper", description: "Сильный образ, аккуратная подача и хорошая вовлечённость в задачу клиента." },
];

function normalizeRelativePath(value: string) {
  return value.replaceAll("\\", "/");
}

function roundToFiveHundred(value: number) {
  return Math.max(3500, Math.round(value / 500) * 500);
}

function buildPricing(index: number, category: CardCategory) {
  const basePrice = 4600 + index * 260 + (category === "pepper" ? 900 : 0);
  const price1h = roundToFiveHundred(basePrice);
  const price3h = roundToFiveHundred(price1h * 2.35);
  const priceFullDay = roundToFiveHundred(price1h * 5.45);

  return { price1h, price3h, priceFullDay };
}

function chunkPhotos() {
  if (!fs.existsSync(MODELS_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(MODELS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const groups: string[][] = [];
  for (let index = 0; index + 2 < files.length; index += 3) {
    groups.push(files.slice(index, index + 3));
  }

  return groups.slice(0, DEMO_CARD_BLUEPRINTS.length);
}

async function ensureDemoOwner() {
  const db = await getDb();
  await db.run(
    `INSERT OR IGNORE INTO users (telegram_id, username, first_name, role, status, has_worker_access)
     VALUES (?, ?, ?, 'worker', 'active', 1)`,
    DEMO_OWNER_TELEGRAM_ID,
    "honey_catalog",
    "Honey Bunny Catalog",
  );

  return db.get<{ id: number }>("SELECT id FROM users WHERE telegram_id = ?", DEMO_OWNER_TELEGRAM_ID);
}

async function persistDemoPhotos(group: string[], slug: string) {
  const references: string[] = [];

  for (let index = 0; index < group.length; index += 1) {
    const fileName = group[index];
    const sourcePath = path.join(MODELS_DIR, fileName);
    const extension = path.extname(fileName) || ".jpg";
    const relativePath = normalizeRelativePath(path.join("demo", slug, `${String(index + 1).padStart(2, "0")}${extension}`));
    const targetPath = path.join(MEDIA_ROOT_DIR, relativePath);

    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.copyFile(sourcePath, targetPath);
    references.push(`local:${relativePath}`);
  }

  return references;
}

export async function ensureDemoCatalogSeed() {
  const photoGroups = chunkPhotos();
  if (!photoGroups.length) {
    return;
  }

  const owner = await ensureDemoOwner();
  if (!owner) {
    return;
  }

  const db = await getDb();
  const targetCount = Math.min(photoGroups.length, DEMO_CARD_BLUEPRINTS.length);
  const existing = await db.get<{ total: number }>("SELECT COUNT(*) AS total FROM cards WHERE source = 'demo'");

  if ((existing?.total ?? 0) === targetCount) {
    return;
  }

  await db.run("DELETE FROM cards WHERE source = 'demo'");

  for (let index = 0; index < targetCount; index += 1) {
    const blueprint = DEMO_CARD_BLUEPRINTS[index];
    const photoReferences = await persistDemoPhotos(photoGroups[index], `model-${String(index + 1).padStart(2, "0")}`);
    const pricing = buildPricing(index, blueprint.category);

    const result = await db.run(
      `INSERT INTO cards (
        owner_user_id,
        category,
        source,
        city,
        name,
        age,
        description,
        price_1h,
        price_3h,
        price_full_day,
        is_active
      ) VALUES (?, ?, 'demo', ?, ?, ?, ?, ?, ?, ?, 1)`,
      owner.id,
      blueprint.category,
      blueprint.city,
      blueprint.name,
      blueprint.age,
      blueprint.description,
      pricing.price1h,
      pricing.price3h,
      pricing.priceFullDay,
    );

    const cardId = Number(result.lastID);
    for (const reference of photoReferences) {
      await db.run("INSERT INTO card_photos (card_id, telegram_file_id) VALUES (?, ?)", cardId, reference);
    }
  }
}
