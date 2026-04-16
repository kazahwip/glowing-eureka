export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready(): void;
        expand(): void;
        BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void };
      };
    };
  }
}

type AppScreen = "catalog" | "club" | "reviews" | "profile" | "search" | "support" | "info" | "card";

type AppState = {
  bootstrap: null | {
    user: {
      id: number;
      balance: number;
      firstName?: string | null;
      username?: string | null;
      createdAt: string;
      requireFriendCode: boolean;
      completedBookings: number;
    };
    initialScreen: string;
    menu: { reviewChannelUrl: string; supportBotUrl: string };
    favoritesCount: number;
  };
  screen: AppScreen;
  category: "girls" | "pepper";
  city: string;
  page: number;
  cardId: number | null;
  selectedPhoto: number;
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
const telegram = window.Telegram?.WebApp;

const state: AppState = {
  bootstrap: null,
  screen: "catalog",
  category: "girls",
  city: "Москва",
  page: 1,
  cardId: null,
  selectedPhoto: 0,
};

const sectionLabels: Record<Exclude<AppScreen, "card">, string> = {
  catalog: "VIP Модели",
  club: "VIP Клуб",
  reviews: "Отзывы",
  profile: "Профиль",
  search: "Поиск",
  support: "Поддержка",
  info: "Информация",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": telegram?.initData ?? "",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string } | null;
    throw new Error(payload?.code ?? "request_failed");
  }

  return response.json() as Promise<T>;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setScreen(screen: AppScreen) {
  state.screen = screen;
  render().catch(showFatal);
}

function navButton(screen: Exclude<AppScreen, "card">, label: string) {
  const active = state.screen === screen || (screen === "catalog" && state.screen === "search");
  return `<button class="tab${active ? "" : " secondary"}" data-screen="${screen}">${label}</button>`;
}

function renderNavigation() {
  return `<div class="nav">
    ${navButton("catalog", "Модели")}
    ${navButton("reviews", "Отзывы")}
    ${navButton("profile", "Профиль")}
    ${navButton("support", "Поддержка")}
  </div>`;
}

async function renderBootstrapLock() {
  appRoot!.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Honey Bunny</div>
        <h1>Friend code</h1>
        <p>Для первого входа в Mini App введите код друга, который вы получили от представителя.</p>
        <div class="field">
          <input id="friend-code-input" maxlength="16" placeholder="Например: A8KF29PL" />
        </div>
        <div class="button-row">
          <button class="button" id="friend-code-submit">Активировать</button>
        </div>
      </section>
    </div>
  `;

  document.querySelector("#friend-code-submit")?.addEventListener("click", async () => {
    const input = document.querySelector<HTMLInputElement>("#friend-code-input");
    const code = input?.value.trim() ?? "";
    if (!code) {
      alert("Введите friend code.");
      return;
    }

    try {
      await api("/api/webapp/friend-code/activate", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      await bootstrap();
    } catch {
      alert("Не удалось активировать friend code.");
    }
  });
}

function attachCommonEvents() {
  document.querySelectorAll<HTMLElement>("[data-screen]").forEach((element) => {
    element.addEventListener("click", () => {
      const screen = element.dataset.screen as AppScreen | undefined;
      if (screen) {
        setScreen(screen);
      }
    });
  });
}

async function renderCatalog() {
  const data = await api<{
    categories: Array<{ key: "girls" | "pepper"; label: string }>;
    cities: string[];
    recent: Record<"girls" | "pepper", Array<{ id: number; name: string; age: number; city: string; price_1h: number }>>;
  }>("/api/webapp/catalog/summary");

  const cards = data.recent[state.category];
  appRoot!.innerHTML = `
    <div class="shell">
      <section class="banner">
        <div class="eyebrow">Honey Bunny Mini App</div>
        <h2>Минималистичный каталог без лишних шагов</h2>
        <p>Открывайте анкеты, фильтруйте по городу и переходите к бронированию в одном интерфейсе.</p>
      </section>
      <section class="section">
        <div class="tabs">
          ${data.categories
            .map(
              (item) =>
                `<button class="tab${item.key === state.category ? "" : " secondary"}" data-category="${item.key}">${escapeHtml(item.label)}</button>`,
            )
            .join("")}
        </div>
        <div class="chips" style="margin-top:14px;">
          ${data.cities
            .map((city) => `<button class="chip" data-city="${escapeHtml(city)}">${escapeHtml(city)}</button>`)
            .join("")}
        </div>
      </section>
      <section class="section">
        <h2>Свежие анкеты</h2>
        <div class="list" style="margin-top:16px;">
          ${cards
            .map(
              (card) => `
                <article class="card">
                  <div class="card-body">
                    <div class="card-title">${escapeHtml(card.name)}, ${card.age}</div>
                    <div class="meta">${escapeHtml(card.city)}</div>
                    <div class="price">1 час: ${card.price_1h.toFixed(2)} RUB</div>
                    <div class="button-row" style="margin-top:14px;">
                      <button class="button" data-open-card="${card.id}">Открыть анкету</button>
                    </div>
                  </div>
                </article>`,
            )
            .join("")}
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelectorAll<HTMLElement>("[data-category]").forEach((element) => {
    element.addEventListener("click", () => {
      state.category = element.dataset.category as "girls" | "pepper";
      render().catch(showFatal);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-city]").forEach((element) => {
    element.addEventListener("click", () => {
      state.city = element.dataset.city ?? state.city;
      state.page = 1;
      state.screen = "search";
      render().catch(showFatal);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-open-card]").forEach((element) => {
    element.addEventListener("click", () => {
      state.cardId = Number(element.dataset.openCard);
      state.selectedPhoto = 0;
      setScreen("card");
    });
  });

  attachCommonEvents();
}

async function renderSearch() {
  const data = await api<{
    page: number;
    totalPages: number;
    items: Array<{ id: number; name: string; age: number; city: string; price1h: number }>;
  }>(`/api/webapp/cards?category=${state.category}&city=${encodeURIComponent(state.city)}&page=${state.page}`);

  appRoot!.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Поиск</div>
        <h1>${escapeHtml(state.city)}</h1>
        <p>Раздел: ${state.category === "pepper" ? "Девушки с перчиком" : "Девушки"}</p>
      </section>
      <section class="section">
        <div class="list">
          ${data.items
            .map(
              (card) => `
                <article class="card">
                  <div class="card-body">
                    <div class="card-title">${escapeHtml(card.name)}, ${card.age}</div>
                    <div class="meta">${escapeHtml(card.city)}</div>
                    <div class="price">1 час: ${card.price1h.toFixed(2)} RUB</div>
                    <div class="button-row" style="margin-top:14px;">
                      <button class="button" data-open-card="${card.id}">Открыть</button>
                    </div>
                  </div>
                </article>`,
            )
            .join("")}
        </div>
        <div class="pagination" style="margin-top:18px;">
          <button class="button ghost" data-page="${Math.max(1, data.page - 1)}">Назад</button>
          <span>${data.page} из ${data.totalPages}</span>
          <button class="button ghost" data-page="${Math.min(data.totalPages, data.page + 1)}">Далее</button>
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelectorAll<HTMLElement>("[data-open-card]").forEach((element) => {
    element.addEventListener("click", () => {
      state.cardId = Number(element.dataset.openCard);
      state.selectedPhoto = 0;
      setScreen("card");
    });
  });

  document.querySelectorAll<HTMLElement>("[data-page]").forEach((element) => {
    element.addEventListener("click", () => {
      state.page = Number(element.dataset.page);
      render().catch(showFatal);
    });
  });

  attachCommonEvents();
}

async function renderCard() {
  if (!state.cardId) {
    state.screen = "catalog";
    await render();
    return;
  }

  const data = await api<{
    card: {
      id: number;
      name: string;
      favorite: boolean;
      photoUrls: string[];
      html: string;
      price1h: number;
    };
  }>(`/api/webapp/cards/${state.cardId}`);

  const card = data.card;
  const activePhoto = card.photoUrls[state.selectedPhoto] ?? card.photoUrls[0] ?? "";
  appRoot!.innerHTML = `
    <div class="shell">
      <section class="gallery">
        <div class="gallery-main">${activePhoto ? `<img src="${activePhoto}" alt="${escapeHtml(card.name)}" />` : ""}</div>
        <div class="gallery-thumbs">
          ${card.photoUrls
            .map(
              (url, index) => `
                <button data-photo-index="${index}">
                  <img src="${url}" alt="${escapeHtml(card.name)} ${index + 1}" />
                </button>`,
            )
            .join("")}
        </div>
      </section>
      <section class="section">
        <div class="content-html">${card.html}</div>
        <div class="button-row" style="margin-top:18px;">
          <button class="button" id="book-btn">Оформить</button>
          <button class="button secondary" id="reviews-btn">Отзывы</button>
          <button class="button secondary" id="schedule-btn">Расписание</button>
        </div>
        <div class="button-row" style="margin-top:10px;">
          <button class="button secondary" id="certificate-btn">Сертификат</button>
          <button class="button secondary" id="safety-btn">Политика безопасности</button>
          <button class="button ghost" id="favorite-btn">${card.favorite ? "Убрать из избранного" : "Добавить в избранное"}</button>
        </div>
        <div class="button-row" style="margin-top:10px;">
          <button class="button ghost" id="back-to-search">Назад</button>
        </div>
      </section>
    </div>
  `;

  document.querySelectorAll<HTMLElement>("[data-photo-index]").forEach((element) => {
    element.addEventListener("click", () => {
      state.selectedPhoto = Number(element.dataset.photoIndex);
      render().catch(showFatal);
    });
  });

  document.querySelector("#back-to-search")?.addEventListener("click", () => setScreen("search"));
  document.querySelector("#favorite-btn")?.addEventListener("click", async () => {
    await api(`/api/webapp/cards/${card.id}/favorite/toggle`, { method: "POST" });
    await render();
  });

  document.querySelector("#reviews-btn")?.addEventListener("click", async () => {
    const reviews = await api<{ text: string }>(`/api/webapp/cards/${card.id}/reviews?page=1`);
    alert(stripHtml(reviews.text));
  });
  document.querySelector("#schedule-btn")?.addEventListener("click", async () => {
    const schedule = await api<{ html: string }>(`/api/webapp/cards/${card.id}/schedule?mode=today`);
    alert(stripHtml(schedule.html));
  });
  document.querySelector("#certificate-btn")?.addEventListener("click", async () => {
    const cert = await api<{ html: string }>(`/api/webapp/cards/${card.id}/certificate`);
    alert(stripHtml(cert.html));
  });
  document.querySelector("#safety-btn")?.addEventListener("click", async () => {
    const safety = await api<{ html: string }>(`/api/webapp/cards/${card.id}/safety`);
    alert(stripHtml(safety.html));
  });
  document.querySelector("#book-btn")?.addEventListener("click", async () => {
    const paymentMethod = confirm("Оплатить из баланса бота?\nНажмите Отмена для наличных.") ? "bot_balance" : "cash";
    try {
      await api(`/api/webapp/cards/${card.id}/prebook`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod }),
      });
      alert("Бронирование создано.");
    } catch (error) {
      alert(error instanceof Error && error.message === "cash_locked" ? "Наличные откроются после первой успешной встречи." : "Не удалось создать бронирование.");
    }
  });
}

async function renderReviews() {
  const data = await api<{ items: string[]; hasNext: boolean; page: number }>("/api/webapp/reviews?page=1");
  appRoot!.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Отзывы</div>
        <h1>Лента Honey Bunny</h1>
        <p>Последние отзывы внутри Mini App. Канал с live-лентой тоже остаётся доступен отдельно.</p>
      </section>
      <section class="section">
        <div class="list">
          ${data.items.map((item) => `<article class="card"><div class="card-body content-html">${item}</div></article>`).join("")}
        </div>
        <div class="button-row" style="margin-top:16px;">
          <a class="button ghost" href="${state.bootstrap?.menu.reviewChannelUrl ?? "#"}" target="_blank" rel="noreferrer">Открыть канал</a>
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;
  attachCommonEvents();
}

async function renderProfile() {
  const data = await api<{
    user: { balance: number; created_at: string; telegram_id: number; first_name?: string | null };
    favorites: Array<{ id: number; name: string; age: number; city: string; price1h: number }>;
  }>("/api/webapp/profile");

  appRoot!.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Профиль</div>
        <h1>${escapeHtml(data.user.first_name ?? "Гость")}</h1>
        <p>Баланс: ${data.user.balance.toFixed(2)} RUB</p>
      </section>
      <section class="section">
        <div class="stat-row"><span>Telegram ID</span><strong>${data.user.telegram_id}</strong></div>
        <div class="stat-row"><span>Дата регистрации</span><strong>${new Date(data.user.created_at).toLocaleDateString("ru-RU")}</strong></div>
        <div class="button-row" style="margin-top:18px;">
          <button class="button" id="topup-btn">Пополнить баланс</button>
        </div>
      </section>
      <section class="section">
        <h2>Избранное</h2>
        <div class="list" style="margin-top:16px;">
          ${data.favorites.length
            ? data.favorites
                .map(
                  (card) => `
                    <article class="card">
                      <div class="card-body">
                        <div class="card-title">${escapeHtml(card.name)}, ${card.age}</div>
                        <div class="meta">${escapeHtml(card.city)}</div>
                        <div class="price">1 час: ${card.price1h.toFixed(2)} RUB</div>
                        <div class="button-row" style="margin-top:12px;">
                          <button class="button secondary" data-open-card="${card.id}">Открыть</button>
                        </div>
                      </div>
                    </article>`
                )
                .join("")
            : `<div class="empty">Избранных анкет пока нет.</div>`}
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelector("#topup-btn")?.addEventListener("click", showTopupFlow);
  document.querySelectorAll<HTMLElement>("[data-open-card]").forEach((element) => {
    element.addEventListener("click", () => {
      state.cardId = Number(element.dataset.openCard);
      setScreen("card");
    });
  });
  attachCommonEvents();
}

async function showTopupFlow() {
  const amountInput = prompt("На сколько пополнить баланс?");
  const amount = Number(amountInput);
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const topup = await api<{ requestId: number; transferDetails: string; amount: number }>("/api/webapp/topup/create", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });

  const confirmed = confirm(`Реквизиты для перевода:\n\n${topup.transferDetails}\n\nПосле перевода нажмите OK, чтобы загрузить чек.`);
  if (!confirmed) {
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const base64 = await readFileAsDataUrl(file);
    await api(`/api/webapp/topup/${topup.requestId}/receipt`, {
      method: "POST",
      body: JSON.stringify({ imageBase64: base64 }),
    });
    alert("Чек отправлен админу на проверку.");
  };
  input.click();
}

async function renderSupport() {
  appRoot!.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Поддержка</div>
        <h1>Связь с оператором</h1>
        <p>Оставьте обращение внутри Mini App или откройте внешний support bot.</p>
      </section>
      <section class="section">
        <div class="field">
          <textarea id="support-message" placeholder="Опишите обращение"></textarea>
        </div>
        <div class="button-row" style="margin-top:14px;">
          <button class="button" id="support-submit">Отправить</button>
          <a class="button ghost" href="${state.bootstrap?.menu.supportBotUrl ?? "#"}" target="_blank" rel="noreferrer">Оператор</a>
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelector("#support-submit")?.addEventListener("click", async () => {
    const message = document.querySelector<HTMLTextAreaElement>("#support-message")?.value.trim() ?? "";
    if (!message) {
      alert("Введите текст обращения.");
      return;
    }
    await api("/api/webapp/support", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    alert("Обращение отправлено.");
  });
  attachCommonEvents();
}

async function renderInfo() {
  const data = await api<{ section: { title: string; text: string } }>("/api/webapp/info/info_center");
  appRoot!.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Информация</div>
        <h1>${escapeHtml(data.section.title)}</h1>
        <p>Все справочные разделы Honey Bunny в одном интерфейсе.</p>
      </section>
      <section class="section content-html">${data.section.text}</section>
      <section class="section">
        <div class="chips">
          ${["safety", "tech", "legal", "finance", "data", "verification", "emergency", "awards", "agreement"]
            .map((key) => `<button class="chip" data-info-key="${key}">${escapeHtml(key)}</button>`)
            .join("")}
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelectorAll<HTMLElement>("[data-info-key]").forEach((element) => {
    element.addEventListener("click", async () => {
      const key = element.dataset.infoKey!;
      const section = await api<{ section: { title: string; text: string } }>(`/api/webapp/info/${key}`);
      alert(stripHtml(`<b>${section.section.title}</b>\n\n${section.section.text}`));
    });
  });
  attachCommonEvents();
}

async function renderClub() {
  appRoot!.innerHTML = `
    <div class="shell">
      <section class="banner">
        <div class="eyebrow">VIP Club</div>
        <h2>Закрытый доступ к расширенному бронированию</h2>
        <p>Приоритетная обработка, закрытые подборки и персональное сопровождение внутри Honey Bunny.</p>
      </section>
      <section class="section">
        <div class="stat-row"><span>Стоимость</span><strong>150,000 RUB / год</strong></div>
        <div class="stat-row"><span>Приоритет</span><strong>Максимальный</strong></div>
        <div class="stat-row"><span>Формат</span><strong>Закрытый клуб</strong></div>
      </section>
      ${renderNavigation()}
    </div>
  `;
  attachCommonEvents();
}

async function render() {
  if (!appRoot || !state.bootstrap) {
    return;
  }

  if (state.bootstrap.user.requireFriendCode) {
    await renderBootstrapLock();
    return;
  }

  switch (state.screen) {
    case "catalog":
      await renderCatalog();
      break;
    case "search":
      await renderSearch();
      break;
    case "card":
      await renderCard();
      break;
    case "reviews":
      await renderReviews();
      break;
    case "profile":
      await renderProfile();
      break;
    case "support":
      await renderSupport();
      break;
    case "info":
      await renderInfo();
      break;
    case "club":
      await renderClub();
      break;
  }
}

function stripHtml(value: string) {
  const container = document.createElement("div");
  container.innerHTML = value;
  return container.textContent ?? "";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function showFatal(error: unknown) {
  if (!appRoot) {
    return;
  }

  appRoot.innerHTML = `
    <div class="shell">
      <section class="hero">
        <div class="eyebrow">Honey Bunny</div>
        <h1>Ошибка загрузки</h1>
        <p>${escapeHtml(error instanceof Error ? error.message : "Не удалось открыть Mini App.")}</p>
      </section>
    </div>
  `;
}

async function bootstrap() {
  telegram?.ready();
  telegram?.expand();
  state.bootstrap = await api("/api/webapp/bootstrap");
  const requestedScreen = new URL(window.location.href).searchParams.get("screen");
  state.screen = (requestedScreen && requestedScreen in sectionLabels ? requestedScreen : state.bootstrap?.initialScreen ?? "catalog") as AppScreen;
  if (!(state.screen in sectionLabels)) {
    state.screen = "catalog";
  }
  await render();
}

bootstrap().catch(showFatal);
