export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready(): void;
        expand(): void;
        BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void };
        HapticFeedback?: { impactOccurred(style: string): void; notificationOccurred(type: string): void };
        colorScheme?: "light" | "dark";
      };
    };
  }
}

type CardCategoryKey = "girls" | "pepper";

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
  category: CardCategoryKey;
  city: string;
  page: number;
  cardId: number | null;
  selectedPhoto: number;
};

const NAV_ITEMS: Array<{ screen: Exclude<AppScreen, "card" | "search">; label: string; icon: string }> = [
  { screen: "catalog", label: "Каталог", icon: "catalog" },
  { screen: "club", label: "VIP", icon: "club" },
  { screen: "reviews", label: "Отзывы", icon: "reviews" },
  { screen: "profile", label: "Профиль", icon: "profile" },
  { screen: "support", label: "Помощь", icon: "support" },
];

const SECTION_LABELS: Record<Exclude<AppScreen, "card">, string> = {
  catalog: "VIP Модели",
  club: "VIP Клуб",
  reviews: "Отзывы",
  profile: "Профиль",
  search: "Поиск",
  support: "Поддержка",
  info: "Информация",
};

const INFO_SECTIONS: Array<{ key: string; title: string; subtitle: string }> = [
  { key: "info_center", title: "Центр инфо", subtitle: "Главные разделы" },
  { key: "safety", title: "Безопасность", subtitle: "Политика и приватность" },
  { key: "tech", title: "Технические", subtitle: "Помощь по Mini App" },
  { key: "legal", title: "Документы", subtitle: "Юридическая часть" },
  { key: "finance", title: "Финансы", subtitle: "Оплата и баланс" },
  { key: "data", title: "Персональные данные", subtitle: "Хранение и защита" },
  { key: "verification", title: "Верификация", subtitle: "Подтверждение анкет" },
  { key: "emergency", title: "Экстренные службы", subtitle: "Контакты" },
  { key: "awards", title: "Награды", subtitle: "Статусы и бонусы" },
  { key: "agreement", title: "Соглашение", subtitle: "Правила сервиса" },
];

const ICONS: Record<string, string> = {
  catalog:
    '<svg viewBox="0 0 24 24"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>',
  club:
    '<svg viewBox="0 0 24 24"><path d="M12 3l2.39 5.06 5.61.46-4.27 3.7 1.34 5.4L12 14.9l-5.07 2.72 1.34-5.4L4 8.52l5.61-.46L12 3z"/></svg>',
  reviews:
    '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.14L4 21l1.86-5.4A8 8 0 1 1 21 12z"/></svg>',
  profile:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  support:
    '<svg viewBox="0 0 24 24"><path d="M9.5 9a2.5 2.5 0 1 1 4.5 1.5c-.7.6-1.5 1-1.5 2v.5"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/><circle cx="12" cy="12" r="9"/></svg>',
  search:
    '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24"><path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.66l-1.06-1.05a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  heartFilled:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  back:
    '<svg viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>',
  star:
    '<svg viewBox="0 0 24 24"><path d="M12 2l2.39 6.96H22l-6 4.45L18.18 22 12 17.6 5.82 22 8 13.41 2 8.96h7.61L12 2z"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg>',
  document:
    '<svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>',
  wallet:
    '<svg viewBox="0 0 24 24"><path d="M3 8a3 3 0 0 1 3-3h12a2 2 0 0 1 2 2v3"/><path d="M3 8v9a3 3 0 0 0 3 3h13a2 2 0 0 0 2-2v-3"/><circle cx="17" cy="14" r="1.5" fill="currentColor" stroke="none"/></svg>',
  send:
    '<svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  chat:
    '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.14L4 21l1.86-5.4A8 8 0 1 1 21 12z"/></svg>',
  info:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01"/><path d="M12 11v5"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24"><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="M5.6 5.6l2.1 2.1"/><path d="M16.3 16.3l2.1 2.1"/><path d="M5.6 18.4l2.1-2.1"/><path d="M16.3 7.7l2.1-2.1"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  pepper:
    '<svg viewBox="0 0 24 24"><path d="M14 4c0 2 1 3 3 3"/><path d="M11 6c-4 0-8 3-8 8a6 6 0 0 0 6 6c4 0 7-3 7-7 0-4-2-7-5-7z"/></svg>',
  bunny:
    '<svg viewBox="0 0 24 24"><path d="M9 3l2 7"/><path d="M15 3l-2 7"/><path d="M7 21a5 5 0 1 1 10 0"/><circle cx="12" cy="14" r="4"/></svg>',
};

const appRoot = document.querySelector<HTMLDivElement>("#app");
const modalRoot = document.querySelector<HTMLDivElement>("#modal-root");
const toastRoot = document.querySelector<HTMLDivElement>("#toast-root");
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

function icon(name: string) {
  return ICONS[name] ?? "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(value: number, currency = "₽") {
  if (!Number.isFinite(value)) return `0 ${currency}`;
  return `${value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ${currency}`;
}

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "♥";
  return trimmed.charAt(0).toUpperCase();
}

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

/* Toasts */
function toast(message: string, kind: "success" | "error" | "info" = "info", timeout = 3200) {
  if (!toastRoot) return;
  const node = document.createElement("div");
  node.className = `toast ${kind === "info" ? "" : kind}`.trim();
  node.innerHTML = `<span class="dot"></span><span>${escapeHtml(message)}</span>`;
  toastRoot.appendChild(node);
  window.setTimeout(() => {
    node.style.transition = "opacity .25s ease, transform .25s ease";
    node.style.opacity = "0";
    node.style.transform = "translateY(-8px)";
    window.setTimeout(() => node.remove(), 260);
  }, timeout);
}

/* Modals */
type ModalOptions = {
  title: string;
  body: string;
  actions?: Array<{ label: string; kind?: "primary" | "secondary" | "ghost" | "danger"; id?: string; closeOnClick?: boolean; onClick?: () => void | Promise<void> }>;
  onMount?: (root: HTMLElement) => void;
  size?: "default" | "centered";
};

function closeModal() {
  if (!modalRoot) return;
  modalRoot.innerHTML = "";
}

function openModal(options: ModalOptions) {
  if (!modalRoot) return;
  const actions = options.actions ?? [];
  modalRoot.innerHTML = `
    <div class="modal-backdrop ${options.size === "centered" ? "center" : ""}" data-modal-backdrop>
      <div class="modal" role="dialog" aria-modal="true">
        <header class="modal-head">
          <h3>${escapeHtml(options.title)}</h3>
          <button class="modal-close" data-modal-close aria-label="Закрыть">×</button>
        </header>
        <div class="modal-body">${options.body}</div>
        ${actions.length ? `<div class="modal-actions">${actions
            .map(
              (action, index) =>
                `<button class="button ${action.kind === "secondary" ? "secondary" : action.kind === "ghost" ? "ghost" : action.kind === "danger" ? "danger" : ""}" data-modal-action="${index}">${escapeHtml(action.label)}</button>`,
            )
            .join("")}</div>` : ""}
      </div>
    </div>
  `;

  modalRoot.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
  modalRoot.querySelector("[data-modal-backdrop]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  });

  modalRoot.querySelectorAll<HTMLElement>("[data-modal-action]").forEach((node) => {
    const idx = Number(node.dataset.modalAction ?? 0);
    const action = actions[idx];
    node.addEventListener("click", async () => {
      try {
        await action?.onClick?.();
      } finally {
        if (action?.closeOnClick !== false) {
          closeModal();
        }
      }
    });
  });

  options.onMount?.(modalRoot.querySelector(".modal") as HTMLElement);
}

/* Navigation */
function setScreen(screen: AppScreen) {
  state.screen = screen;
  render().catch(showFatal);
}

function navButton(item: (typeof NAV_ITEMS)[number]) {
  const isActive =
    state.screen === item.screen ||
    (item.screen === "catalog" && state.screen === "search");
  return `<button class="nav-item${isActive ? " active" : ""}" data-screen="${item.screen}">
    ${icon(item.icon)}
    <span>${item.label}</span>
  </button>`;
}

function renderNavigation() {
  return `<nav class="nav" role="tablist">${NAV_ITEMS.map(navButton).join("")}</nav>`;
}

function renderBrandBar() {
  const balance = state.bootstrap?.user.balance ?? 0;
  const balanceLabel = balance > 0 ? formatMoney(balance) : "Гость";
  return `<header class="brand-bar">
    <div class="brand">
      <div class="brand-mark">HB</div>
      <div><span class="brand-name">Honey <em>Bunny</em></span></div>
    </div>
    <div class="brand-balance" data-screen="profile" role="button" tabindex="0">
      ${icon("wallet")}
      <span>${escapeHtml(balanceLabel)}</span>
    </div>
  </header>`;
}

function attachCommonEvents() {
  document.querySelectorAll<HTMLElement>("[data-screen]").forEach((element) => {
    element.addEventListener("click", () => {
      const screen = element.dataset.screen as AppScreen | undefined;
      if (screen) {
        haptic("light");
        setScreen(screen);
      }
    });
  });
}

function haptic(style: "light" | "medium" | "soft" | "success" = "light") {
  try {
    if (style === "success") {
      telegram?.HapticFeedback?.notificationOccurred("success");
    } else {
      telegram?.HapticFeedback?.impactOccurred(style);
    }
  } catch {
    /* no-op */
  }
}

/* Loading skeleton */
function skeletonShell(count = 4) {
  return `<div class="loading-stack">${Array.from({ length: count })
    .map(
      () => `
      <div class="card" style="padding:0;">
        <div class="skeleton skeleton-card"></div>
      </div>`,
    )
    .join("")}</div>`;
}

function showLoading() {
  if (!appRoot) return;
  appRoot.innerHTML = `<div class="shell">
    ${renderBrandBar()}
    <section class="hero" style="padding:32px 24px;">
      <div class="eyebrow">Honey Bunny</div>
      <h1>Загрузка</h1>
      <p>Готовим премиальный каталог.</p>
    </section>
    ${skeletonShell(3)}
  </div>`;
}

/* Friend code lock */
async function renderBootstrapLock() {
  if (!appRoot) return;
  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="hero lock-card">
        <div class="lock-icon">${icon("shield")}</div>
        <div class="eyebrow">Honey Bunny · Приватный доступ</div>
        <h1>Friend code</h1>
        <p>Для первого входа в Mini App введите код друга, который вы получили от представителя Honey Bunny.</p>
        <div class="field">
          <input id="friend-code-input" maxlength="16" placeholder="A8KF29PL" autocomplete="off" spellcheck="false" />
        </div>
        <div class="button-row" style="justify-content:center;">
          <button class="button" id="friend-code-submit">${icon("send")}<span>Активировать</span></button>
        </div>
      </section>
    </div>
  `;

  const submit = async () => {
    const input = document.querySelector<HTMLInputElement>("#friend-code-input");
    const code = input?.value.trim() ?? "";
    if (!code) {
      toast("Введите friend code", "error");
      return;
    }
    try {
      await api("/api/webapp/friend-code/activate", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      toast("Доступ активирован", "success");
      haptic("success");
      await bootstrap();
    } catch {
      toast("Не удалось активировать friend code", "error");
    }
  };

  document.querySelector("#friend-code-submit")?.addEventListener("click", submit);
  document.querySelector("#friend-code-input")?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") submit();
  });
}

/* Catalog */
async function renderCatalog() {
  if (!appRoot) return;
  appRoot.innerHTML = `<div class="shell">${renderBrandBar()}${skeletonShell(2)}${renderNavigation()}</div>`;
  attachCommonEvents();

  const data = await api<{
    categories: Array<{ key: CardCategoryKey; label: string }>;
    cities: string[];
    recent: Record<CardCategoryKey, Array<{ id: number; name: string; age: number; city: string; price_1h: number }>>;
  }>("/api/webapp/catalog/summary");

  const cards = data.recent[state.category] ?? [];
  const categoryLabel = data.categories.find((c) => c.key === state.category)?.label ?? "Каталог";

  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="hero">
        <div class="eyebrow">${icon("spark")}<span>Honey Bunny · Mini App</span></div>
        <h1>Эстетика и сервис<br/>премиального уровня</h1>
        <p>Открывайте анкеты, выбирайте город и переходите к бронированию в одном элегантном интерфейсе.</p>
        <div class="button-row" style="margin-top:18px;">
          <button class="button" data-screen="search">${icon("search")}<span>Найти модель</span></button>
          <button class="button ghost" data-screen="club">${icon("club")}<span>VIP клуб</span></button>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>${escapeHtml(categoryLabel)}</h2>
          <button class="link" data-screen="search">Все анкеты ›</button>
        </div>
        <div class="tabs">
          ${data.categories
            .map(
              (item) =>
                `<button class="tab${item.key === state.category ? " active" : ""}" data-category="${item.key}">${escapeHtml(item.label)}</button>`,
            )
            .join("")}
        </div>
        <div class="chips" style="margin-top:14px;">
          ${data.cities
            .map(
              (city) => `<button class="chip${city === state.city ? " active" : ""}" data-city="${escapeHtml(city)}">${icon("pin")}<span>${escapeHtml(city)}</span></button>`,
            )
            .join("")}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Свежие анкеты</h2>
          <span class="muted" style="font-size:13px;">${cards.length} ${cards.length === 1 ? "карточка" : "карточек"}</span>
        </div>
        <div class="list two">
          ${cards.length
            ? cards.map(renderCatalogCard).join("")
            : `<div class="empty">Скоро появятся новые анкеты в этой категории.</div>`}
        </div>
      </section>

      ${renderNavigation()}
    </div>
  `;

  document.querySelectorAll<HTMLElement>("[data-category]").forEach((element) => {
    element.addEventListener("click", () => {
      state.category = element.dataset.category as CardCategoryKey;
      haptic("light");
      render().catch(showFatal);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-city]").forEach((element) => {
    element.addEventListener("click", () => {
      state.city = element.dataset.city ?? state.city;
      state.page = 1;
      state.screen = "search";
      haptic("light");
      render().catch(showFatal);
    });
  });

  bindOpenCard();
  attachCommonEvents();
}

function renderCatalogCard(card: { id: number; name: string; age: number; city: string; price_1h: number }) {
  return `
    <article class="card" role="button" tabindex="0" data-open-card="${card.id}">
      <div class="card-cover">
        <span class="badge">${state.category === "pepper" ? "Перчик" : "Premium"}</span>
        <span class="initial">${escapeHtml(initials(card.name))}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(card.name)}<span class="age">${card.age} лет</span></div>
        <div class="meta">${icon("pin")}<span>${escapeHtml(card.city)}</span></div>
        <div class="price"><strong>${formatMoney(card.price_1h)}</strong>за час</div>
      </div>
    </article>
  `;
}

function bindOpenCard() {
  document.querySelectorAll<HTMLElement>("[data-open-card]").forEach((element) => {
    element.addEventListener("click", () => {
      state.cardId = Number(element.dataset.openCard);
      state.selectedPhoto = 0;
      haptic("light");
      setScreen("card");
    });
  });
}

/* Search */
async function renderSearch() {
  if (!appRoot) return;
  appRoot.innerHTML = `<div class="shell">${renderBrandBar()}${skeletonShell(3)}${renderNavigation()}</div>`;
  attachCommonEvents();

  const data = await api<{
    page: number;
    totalPages: number;
    items: Array<{ id: number; name: string; age: number; city: string; price1h: number }>;
  }>(`/api/webapp/cards?category=${state.category}&city=${encodeURIComponent(state.city)}&page=${state.page}`);

  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="hero">
        <div class="eyebrow">${icon("search")}<span>Поиск</span></div>
        <h1>${escapeHtml(state.city)}</h1>
        <p>${state.category === "pepper" ? "Раздел: Девушки с перчиком" : "Раздел: Девушки"}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(state.city)}</span>
          <span class="tag">${state.category === "pepper" ? "Перчик" : "Premium"}</span>
          <span class="tag">Стр. ${data.page} / ${data.totalPages}</span>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Анкеты</h2>
          <button class="link" data-screen="catalog">← Назад в каталог</button>
        </div>
        <div class="list two">
          ${data.items.length
            ? data.items
                .map(
                  (card) => `
                  <article class="card" role="button" tabindex="0" data-open-card="${card.id}">
                    <div class="card-cover">
                      <span class="badge">${state.category === "pepper" ? "Перчик" : "Premium"}</span>
                      <span class="initial">${escapeHtml(initials(card.name))}</span>
                    </div>
                    <div class="card-body">
                      <div class="card-title">${escapeHtml(card.name)}<span class="age">${card.age} лет</span></div>
                      <div class="meta">${icon("pin")}<span>${escapeHtml(card.city)}</span></div>
                      <div class="price"><strong>${formatMoney(card.price1h)}</strong>за час</div>
                    </div>
                  </article>`,
                )
                .join("")
            : `<div class="empty">В выбранном городе пока нет анкет.</div>`}
        </div>
        <div class="pagination" style="margin-top:18px;">
          <button class="button ghost" data-page="${Math.max(1, data.page - 1)}" ${data.page <= 1 ? "disabled" : ""}>${icon("back")}<span>Назад</span></button>
          <span><strong>${data.page}</strong> из ${data.totalPages}</span>
          <button class="button ghost" data-page="${Math.min(data.totalPages, data.page + 1)}" ${data.page >= data.totalPages ? "disabled" : ""}><span>Далее</span>${icon("arrow")}</button>
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  bindOpenCard();
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((element) => {
    element.addEventListener("click", () => {
      const next = Number(element.dataset.page);
      if (Number.isFinite(next)) {
        state.page = next;
        haptic("light");
        render().catch(showFatal);
      }
    });
  });
  attachCommonEvents();
}

/* Card detail */
async function renderCard() {
  if (!appRoot) return;
  if (!state.cardId) {
    state.screen = "catalog";
    await render();
    return;
  }

  appRoot.innerHTML = `<div class="shell">${renderBrandBar()}${skeletonShell(2)}</div>`;

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

  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <button class="button ghost" id="back-to-search" style="align-self:flex-start;">${icon("back")}<span>Назад</span></button>

      <section class="gallery">
        <div class="gallery-main">
          ${activePhoto
            ? `<img src="${escapeHtml(activePhoto)}" alt="${escapeHtml(card.name)}" />`
            : `<div class="empty-photo">${escapeHtml(initials(card.name))}</div>`}
        </div>
        ${card.photoUrls.length > 1
          ? `<div class="gallery-thumbs">
              ${card.photoUrls
                .map(
                  (url, index) => `
                    <button data-photo-index="${index}" class="${index === state.selectedPhoto ? "active" : ""}">
                      <img src="${escapeHtml(url)}" alt="${escapeHtml(card.name)} ${index + 1}" loading="lazy" />
                    </button>`,
                )
                .join("")}
            </div>`
          : ""}
      </section>

      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">${icon("star")}<span>Анкета</span></div>
            <h2 style="margin-bottom:0;">${escapeHtml(card.name)}</h2>
          </div>
          <button class="modal-close" id="favorite-btn" title="Избранное" style="color:${card.favorite ? "#ff8fbf" : "var(--muted)"};">
            ${card.favorite ? icon("heartFilled") : icon("heart")}
          </button>
        </div>
        <div class="content-html">${card.html}</div>
        <hr class="split-line" />
        <div class="stat-row"><span>Цена за час</span><strong>${formatMoney(card.price1h)}</strong></div>
        <div class="button-row" style="margin-top:18px;">
          <button class="button" id="book-btn">${icon("send")}<span>Оформить визит</span></button>
          <button class="button secondary" id="reviews-btn">${icon("chat")}<span>Отзывы</span></button>
          <button class="button secondary" id="schedule-btn">${icon("calendar")}<span>Расписание</span></button>
        </div>
        <div class="button-row" style="margin-top:10px;">
          <button class="button ghost" id="certificate-btn">${icon("document")}<span>Сертификат</span></button>
          <button class="button ghost" id="safety-btn">${icon("shield")}<span>Безопасность</span></button>
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
    try {
      await api(`/api/webapp/cards/${card.id}/favorite/toggle`, { method: "POST" });
      haptic("success");
      toast(card.favorite ? "Удалено из избранного" : "Добавлено в избранное", "success");
      await render();
    } catch {
      toast("Не удалось обновить избранное", "error");
    }
  });

  document.querySelector("#reviews-btn")?.addEventListener("click", async () => {
    try {
      const reviews = await api<{ text?: string; html?: string }>(`/api/webapp/cards/${card.id}/reviews?page=1`);
      openModal({
        title: `${card.name} · Отзывы`,
        body: `<div class="content-html">${reviews.html ?? reviews.text ?? "Отзывов пока нет."}</div>`,
        actions: [{ label: "Закрыть", kind: "secondary" }],
      });
    } catch {
      toast("Не удалось загрузить отзывы", "error");
    }
  });

  document.querySelector("#schedule-btn")?.addEventListener("click", async () => {
    try {
      const today = await api<{ html: string }>(`/api/webapp/cards/${card.id}/schedule?mode=today`);
      const renderModeButtons = (current: "today" | "week") => `
        <div class="tabs" style="margin-bottom:14px;">
          <button class="tab${current === "today" ? " active" : ""}" data-schedule-mode="today">Сегодня</button>
          <button class="tab${current === "week" ? " active" : ""}" data-schedule-mode="week">Неделя</button>
        </div>
        <div class="content-html" id="schedule-body">${today.html}</div>
      `;
      openModal({
        title: `${card.name} · Расписание`,
        body: renderModeButtons("today"),
        actions: [{ label: "Закрыть", kind: "secondary" }],
        onMount: (root) => {
          const bind = () => {
            root.querySelectorAll<HTMLElement>("[data-schedule-mode]").forEach((node) => {
              node.addEventListener("click", async () => {
                const mode = node.dataset.scheduleMode as "today" | "week";
                root.querySelectorAll<HTMLElement>("[data-schedule-mode]").forEach((tab) => {
                  tab.classList.toggle("active", tab.dataset.scheduleMode === mode);
                });
                const target = root.querySelector<HTMLElement>("#schedule-body");
                if (target) target.innerHTML = "<div class=\"skeleton skeleton-line\" style=\"height:60px;\"></div>";
                try {
                  const next = await api<{ html: string }>(`/api/webapp/cards/${card.id}/schedule?mode=${mode}`);
                  if (target) target.innerHTML = next.html;
                } catch {
                  if (target) target.innerHTML = "<p>Не удалось загрузить расписание.</p>";
                }
              });
            });
          };
          bind();
        },
      });
    } catch {
      toast("Не удалось загрузить расписание", "error");
    }
  });

  document.querySelector("#certificate-btn")?.addEventListener("click", async () => {
    try {
      const cert = await api<{ html: string }>(`/api/webapp/cards/${card.id}/certificate`);
      openModal({
        title: "Сертификат",
        body: `<div class="content-html">${cert.html}</div>`,
        actions: [{ label: "Закрыть", kind: "secondary" }],
      });
    } catch {
      toast("Не удалось загрузить сертификат", "error");
    }
  });

  document.querySelector("#safety-btn")?.addEventListener("click", async () => {
    try {
      const safety = await api<{ html: string }>(`/api/webapp/cards/${card.id}/safety`);
      openModal({
        title: "Политика безопасности",
        body: `<div class="content-html">${safety.html}</div>`,
        actions: [{ label: "Закрыть", kind: "secondary" }],
      });
    } catch {
      toast("Не удалось загрузить политику", "error");
    }
  });

  document.querySelector("#book-btn")?.addEventListener("click", () => openBookingModal(card.id));
}

function openBookingModal(cardId: number) {
  openModal({
    title: "Оформление визита",
    body: `
      <p class="muted" style="margin-top:0;">Выберите способ оплаты. Наличные доступны после первой успешной встречи.</p>
      <div class="button-row" style="margin-top:14px;">
        <button class="button" data-payment="bot_balance">${icon("wallet")}<span>Списать с баланса</span></button>
        <button class="button secondary" data-payment="cash">${icon("phone")}<span>Наличные курьеру</span></button>
      </div>
    `,
    actions: [{ label: "Отмена", kind: "ghost" }],
    onMount: (root) => {
      root.querySelectorAll<HTMLElement>("[data-payment]").forEach((node) => {
        node.addEventListener("click", async () => {
          const paymentMethod = node.dataset.payment as "bot_balance" | "cash";
          try {
            await api(`/api/webapp/cards/${cardId}/prebook`, {
              method: "POST",
              body: JSON.stringify({ paymentMethod }),
            });
            closeModal();
            haptic("success");
            toast("Бронирование создано. Менеджер свяжется в ближайшее время.", "success", 4000);
          } catch (error) {
            const code = error instanceof Error ? error.message : "request_failed";
            if (code === "cash_locked") {
              toast("Наличные откроются после первой успешной встречи.", "error", 4500);
            } else {
              toast("Не удалось создать бронирование", "error");
            }
          }
        });
      });
    },
  });
}

/* Reviews feed */
async function renderReviews() {
  if (!appRoot) return;
  appRoot.innerHTML = `<div class="shell">${renderBrandBar()}${skeletonShell(3)}${renderNavigation()}</div>`;
  attachCommonEvents();

  const data = await api<{ items: string[]; hasNext: boolean; page: number }>("/api/webapp/reviews?page=1");

  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="hero">
        <div class="eyebrow">${icon("chat")}<span>Отзывы</span></div>
        <h1>Лента Honey Bunny</h1>
        <p>Свежие отзывы внутри Mini App. Полная live-лента доступна в нашем закрытом канале.</p>
        <div class="button-row" style="margin-top:18px;">
          <a class="button" href="${escapeHtml(state.bootstrap?.menu.reviewChannelUrl ?? "#")}" target="_blank" rel="noreferrer">${icon("send")}<span>Открыть канал</span></a>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Свежие отклики</h2>
          <span class="muted" style="font-size:13px;">${data.items.length}</span>
        </div>
        <div class="list">
          ${data.items.length
            ? data.items
                .map((item) => `<article class="card"><div class="card-body content-html">${item}</div></article>`)
                .join("")
            : `<div class="empty">Отзывов пока нет.</div>`}
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;
  attachCommonEvents();
}

/* Profile */
async function renderProfile() {
  if (!appRoot) return;
  appRoot.innerHTML = `<div class="shell">${renderBrandBar()}${skeletonShell(2)}${renderNavigation()}</div>`;
  attachCommonEvents();

  const data = await api<{
    user: { balance: number; created_at: string; telegram_id: number; first_name?: string | null };
    favorites: Array<{ id: number; name: string; age: number; city: string; price1h: number }>;
  }>("/api/webapp/profile");

  if (state.bootstrap) {
    state.bootstrap.user.balance = data.user.balance;
  }

  const firstName = data.user.first_name ?? "Гость";
  const created = new Date(data.user.created_at);

  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="profile-head">
        <div class="profile-avatar">${escapeHtml(initials(firstName))}</div>
        <div class="profile-text">
          <div class="eyebrow">Профиль</div>
          <h1>${escapeHtml(firstName)}</h1>
          <div class="profile-balance">
            <span class="amount">${data.user.balance.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}</span>
            <span class="currency">RUB</span>
          </div>
          <p>Telegram ID · ${data.user.telegram_id}</p>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Аккаунт</h2>
        </div>
        <div class="stat-row"><span>Баланс</span><strong>${formatMoney(data.user.balance)}</strong></div>
        <div class="stat-row"><span>Дата регистрации</span><strong>${created.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}</strong></div>
        <div class="stat-row"><span>Завершённых встреч</span><strong>${state.bootstrap?.user.completedBookings ?? 0}</strong></div>
        <div class="stat-row"><span>Избранных анкет</span><strong>${data.favorites.length}</strong></div>
        <div class="button-row" style="margin-top:18px;">
          <button class="button" id="topup-btn">${icon("wallet")}<span>Пополнить баланс</span></button>
          <button class="button ghost" data-screen="info">${icon("info")}<span>Информация</span></button>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Избранное</h2>
          <span class="muted" style="font-size:13px;">${data.favorites.length}</span>
        </div>
        <div class="list two">
          ${data.favorites.length
            ? data.favorites
                .map(
                  (card) => `
                    <article class="card" role="button" tabindex="0" data-open-card="${card.id}">
                      <div class="card-cover">
                        <span class="badge rose">Избранное</span>
                        <span class="initial">${escapeHtml(initials(card.name))}</span>
                      </div>
                      <div class="card-body">
                        <div class="card-title">${escapeHtml(card.name)}<span class="age">${card.age} лет</span></div>
                        <div class="meta">${icon("pin")}<span>${escapeHtml(card.city)}</span></div>
                        <div class="price"><strong>${formatMoney(card.price1h)}</strong>за час</div>
                      </div>
                    </article>`,
                )
                .join("")
            : `<div class="empty">Избранных анкет пока нет.<br/>Откройте каталог и нажмите ♥ на понравившейся анкете.</div>`}
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelector("#topup-btn")?.addEventListener("click", () => openTopupModal());
  bindOpenCard();
  attachCommonEvents();
}

/* Top-up flow */
function openTopupModal() {
  openModal({
    title: "Пополнить баланс",
    body: `
      <p class="muted" style="margin-top:0;">Укажите сумму. После создания заявки вы получите реквизиты, переведёте средства и приложите чек.</p>
      <div class="field">
        <label>Сумма</label>
        <input id="topup-amount" type="number" min="100" step="100" inputmode="numeric" placeholder="Например, 5000" />
      </div>
    `,
    actions: [
      { label: "Отмена", kind: "ghost" },
      {
        label: "Получить реквизиты",
        kind: "primary",
        closeOnClick: false,
        onClick: async () => {
          const value = Number((document.querySelector<HTMLInputElement>("#topup-amount")?.value ?? "").trim());
          if (!Number.isFinite(value) || value <= 0) {
            toast("Введите корректную сумму", "error");
            return;
          }
          try {
            const topup = await api<{ requestId: number; transferDetails: string; amount: number }>(
              "/api/webapp/topup/create",
              {
                method: "POST",
                body: JSON.stringify({ amount: value }),
              },
            );
            closeModal();
            openTopupReceiptModal(topup);
          } catch {
            toast("Не удалось создать заявку", "error");
          }
        },
      },
    ],
  });
}

function openTopupReceiptModal(topup: { requestId: number; transferDetails: string; amount: number }) {
  openModal({
    title: `Оплата · ${formatMoney(topup.amount)}`,
    body: `
      <p class="muted" style="margin-top:0;">Переведите указанную сумму, затем приложите фото чека. Заявка попадёт администратору на проверку.</p>
      <div class="transfer-block"><strong>${escapeHtml(topup.transferDetails)}</strong></div>
      <div class="field" style="margin-top:14px;">
        <label>Чек об оплате</label>
        <input id="topup-receipt" type="file" accept="image/*" />
      </div>
    `,
    actions: [
      { label: "Позже", kind: "ghost" },
      {
        label: "Отправить чек",
        kind: "primary",
        closeOnClick: false,
        onClick: async () => {
          const input = document.querySelector<HTMLInputElement>("#topup-receipt");
          const file = input?.files?.[0];
          if (!file) {
            toast("Прикрепите фото чека", "error");
            return;
          }
          try {
            const base64 = await readFileAsDataUrl(file);
            await api(`/api/webapp/topup/${topup.requestId}/receipt`, {
              method: "POST",
              body: JSON.stringify({ imageBase64: base64 }),
            });
            closeModal();
            toast("Чек отправлен админу на проверку", "success", 4000);
            haptic("success");
          } catch {
            toast("Не удалось отправить чек", "error");
          }
        },
      },
    ],
  });
}

/* Support */
async function renderSupport() {
  if (!appRoot) return;
  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="hero">
        <div class="eyebrow">${icon("support")}<span>Поддержка</span></div>
        <h1>Связь с командой</h1>
        <p>Опишите вопрос — оператор Honey Bunny ответит в Telegram. Если нужно срочно, откройте чат с поддержкой.</p>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Новое обращение</h2>
        </div>
        <div class="field">
          <label>Сообщение</label>
          <textarea id="support-message" placeholder="Расскажите, что произошло..."></textarea>
        </div>
        <div class="button-row" style="margin-top:14px;">
          <button class="button" id="support-submit">${icon("send")}<span>Отправить</span></button>
          <a class="button ghost" href="${escapeHtml(state.bootstrap?.menu.supportBotUrl ?? "#")}" target="_blank" rel="noreferrer">${icon("chat")}<span>Открыть чат</span></a>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Полезные каналы</h2>
        </div>
        <div class="support-channels">
          <a class="support-channel" href="${escapeHtml(state.bootstrap?.menu.supportBotUrl ?? "#")}" target="_blank" rel="noreferrer">
            <div class="icon">${icon("chat")}</div>
            <div class="body">
              <h4>Поддержка 24/7</h4>
              <p>Ответ оператора в течение нескольких минут</p>
            </div>
            ${icon("arrow")}
          </a>
          <a class="support-channel" href="${escapeHtml(state.bootstrap?.menu.reviewChannelUrl ?? "#")}" target="_blank" rel="noreferrer">
            <div class="icon">${icon("star")}</div>
            <div class="body">
              <h4>Канал отзывов</h4>
              <p>Реальные отклики наших клиентов</p>
            </div>
            ${icon("arrow")}
          </a>
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelector("#support-submit")?.addEventListener("click", async () => {
    const message = document.querySelector<HTMLTextAreaElement>("#support-message")?.value.trim() ?? "";
    if (!message) {
      toast("Введите текст обращения", "error");
      return;
    }
    try {
      await api("/api/webapp/support", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      const textarea = document.querySelector<HTMLTextAreaElement>("#support-message");
      if (textarea) textarea.value = "";
      toast("Обращение отправлено", "success");
      haptic("success");
    } catch {
      toast("Не удалось отправить обращение", "error");
    }
  });
  attachCommonEvents();
}

/* Info */
async function renderInfo() {
  if (!appRoot) return;
  appRoot.innerHTML = `<div class="shell">${renderBrandBar()}${skeletonShell(1)}${renderNavigation()}</div>`;
  attachCommonEvents();

  const data = await api<{ section: { title: string; text: string } }>("/api/webapp/info/info_center");

  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="hero">
        <div class="eyebrow">${icon("info")}<span>Информация</span></div>
        <h1>${escapeHtml(data.section.title)}</h1>
        <p>Все справочные разделы Honey Bunny собраны в одном интерфейсе.</p>
      </section>
      <section class="section content-html">${data.section.text}</section>
      <section class="section">
        <div class="section-head">
          <h2>Разделы</h2>
        </div>
        <div class="info-grid">
          ${INFO_SECTIONS.filter((item) => item.key !== "info_center")
            .map(
              (item) => `<button class="info-tile" data-info-key="${escapeHtml(item.key)}">
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.subtitle)}</p>
              </button>`,
            )
            .join("")}
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;

  document.querySelectorAll<HTMLElement>("[data-info-key]").forEach((element) => {
    element.addEventListener("click", async () => {
      const key = element.dataset.infoKey!;
      try {
        const section = await api<{ section: { title: string; text: string } }>(`/api/webapp/info/${key}`);
        openModal({
          title: section.section.title,
          body: `<div class="content-html">${section.section.text}</div>`,
          actions: [{ label: "Закрыть", kind: "secondary" }],
        });
      } catch {
        toast("Не удалось загрузить раздел", "error");
      }
    });
  });
  attachCommonEvents();
}

/* Club */
async function renderClub() {
  if (!appRoot) return;
  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="banner">
        <div class="eyebrow">${icon("club")}<span>VIP CLUB</span></div>
        <h2>Закрытый клуб Honey Bunny</h2>
        <p>Приоритетная обработка, индивидуальный куратор и закрытые подборки моделей высочайшего уровня.</p>
        <div class="button-row" style="margin-top:22px;">
          <button class="button" data-screen="support">${icon("send")}<span>Подать заявку</span></button>
          <button class="button ghost" data-screen="catalog">${icon("catalog")}<span>В каталог</span></button>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Условия</h2>
        </div>
        <div class="stat-row"><span>Стоимость</span><strong>150 000 ₽ / год</strong></div>
        <div class="stat-row"><span>Приоритет обработки</span><strong>Максимальный</strong></div>
        <div class="stat-row"><span>Куратор</span><strong>Персональный</strong></div>
        <div class="stat-row"><span>Формат</span><strong>Закрытое сообщество</strong></div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2>Что вы получите</h2>
        </div>
        <div class="club-perks">
          <div class="club-perk">
            <div class="perk-icon">${icon("spark")}</div>
            <div>
              <h4>Закрытые анкеты</h4>
              <p>Доступ к моделям, которые недоступны в общем каталоге.</p>
            </div>
          </div>
          <div class="club-perk">
            <div class="perk-icon">${icon("phone")}</div>
            <div>
              <h4>Персональный куратор</h4>
              <p>Помогает с подбором, бронированием и сопровождением 24/7.</p>
            </div>
          </div>
          <div class="club-perk">
            <div class="perk-icon">${icon("shield")}</div>
            <div>
              <h4>Конфиденциальность</h4>
              <p>Расширенные политики приватности и защищённые каналы связи.</p>
            </div>
          </div>
          <div class="club-perk">
            <div class="perk-icon">${icon("star")}</div>
            <div>
              <h4>Особый статус</h4>
              <p>Бонусы, компенсации и приглашения на закрытые мероприятия.</p>
            </div>
          </div>
        </div>
      </section>
      ${renderNavigation()}
    </div>
  `;
  attachCommonEvents();
}

/* Render dispatcher */
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function showFatal(error: unknown) {
  if (!appRoot) return;
  appRoot.innerHTML = `
    <div class="shell">
      ${renderBrandBar()}
      <section class="hero fatal">
        <div class="eyebrow">${icon("info")}<span>Honey Bunny</span></div>
        <h1>Не удалось открыть Mini App</h1>
        <p>${escapeHtml(error instanceof Error ? error.message : "Неизвестная ошибка.")}</p>
        <div class="button-row" style="justify-content:center; margin-top:18px;">
          <button class="button" id="retry-btn">${icon("spark")}<span>Попробовать снова</span></button>
        </div>
      </section>
    </div>
  `;
  document.querySelector("#retry-btn")?.addEventListener("click", () => {
    bootstrap().catch(showFatal);
  });
}

async function bootstrap() {
  telegram?.ready();
  telegram?.expand();
  showLoading();
  state.bootstrap = await api("/api/webapp/bootstrap");
  const requestedScreen = new URL(window.location.href).searchParams.get("screen");
  state.screen = (requestedScreen && requestedScreen in SECTION_LABELS
    ? requestedScreen
    : state.bootstrap?.initialScreen ?? "catalog") as AppScreen;
  if (!(state.screen in SECTION_LABELS)) {
    state.screen = "catalog";
  }
  await render();
}

bootstrap().catch(showFatal);
