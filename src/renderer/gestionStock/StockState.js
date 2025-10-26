// Persistence and shared state helpers for stock items

const STORAGE_KEY = "sem_stock_items_v1";

function isDesktopEnvironment() {
  return typeof window !== "undefined" && !!window.SoukElMeuble;
}

function loadFromStorage() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistStockItems(items) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
  } catch {}
}

function coerceNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStockItem(data = {}, extras = {}) {
  const ref = typeof data.ref === "string" ? data.ref.trim() : String(data.ref ?? "").trim();
  const nameSource = data.name ?? data.product ?? "";
  const descSource = data.desc ?? data.description ?? "";
  const item = {
    ref,
    name: typeof nameSource === "string" ? nameSource : String(nameSource ?? ""),
    desc: typeof descSource === "string" ? descSource : String(descSource ?? ""),
    qty: coerceNumber(data.qty ?? data.quantity ?? 0, 0),
    price: coerceNumber(data.price ?? data.unitPrice ?? 0, 0),
    tva: coerceNumber(data.tva ?? data.vat ?? 0, 0),
    discount: coerceNumber(data.discount ?? data.remise ?? 0, 0),
  };
  if (extras && typeof extras === "object") Object.assign(item, extras);
  return item;
}

function getState() {
  const SEM = window.SEM || (window.SEM = {});
  SEM.stock = SEM.stock || {};
  if (!Array.isArray(SEM.stock.items)) {
    const stored = loadFromStorage();
    SEM.stock.items = Array.isArray(stored) ? stored.map((it) => normalizeStockItem(it)) : [];
  }
  return SEM.stock;
}

export function ensureStockState() {
  return getState().items;
}

export function getStockItems() {
  return ensureStockState();
}

export function setStockItems(items, { persist = true } = {}) {
  const state = getState();
  state.items.length = 0;
  if (Array.isArray(items)) {
    items.forEach((item) => {
      const extras = {};
      if (item && typeof item === "object") {
        if (item.__path) extras.__path = item.__path;
        if (item.__fileName) extras.__fileName = item.__fileName;
      }
      state.items.push(normalizeStockItem(item, extras));
    });
  }
  if (persist) persistStockItems(state.items);
  return state.items;
}

export function addStockItem(item, extras = {}) {
  const state = getState();
  const normalized = normalizeStockItem(item, extras);
  state.items.push(normalized);
  persistStockItems(state.items);
  return state.items;
}

export function updateStockItem(index, item, extras = {}) {
  const state = getState();
  if (Number.isInteger(index) && index >= 0 && index < state.items.length) {
    const current = state.items[index] || {};
    const preserved = {};
    if (current.__path) preserved.__path = current.__path;
    if (current.__fileName) preserved.__fileName = current.__fileName;
    state.items[index] = normalizeStockItem(item, { ...preserved, ...extras });
    persistStockItems(state.items);
  }
  return state.items;
}

export function deleteStockItem(index) {
  const state = getState();
  if (Number.isInteger(index) && index >= 0 && index < state.items.length) {
    state.items.splice(index, 1);
    persistStockItems(state.items);
  }
  return state.items;
}

export async function refreshStockFromFilesystem() {
  if (!isDesktopEnvironment() || !window.SoukElMeuble?.listArticles) {
    return getStockItems();
  }
  try {
    const list = await window.SoukElMeuble.listArticles();
    if (!Array.isArray(list)) return getStockItems();
    const items = list
      .map((entry) => {
        if (!entry) return null;
        const base = entry.article || entry;
        const extras = {};
        if (entry.path) extras.__path = entry.path;
        if (entry.name) extras.__fileName = entry.name;
        return normalizeStockItem(base, extras);
      })
      .filter(Boolean);
    items.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), undefined, {
        sensitivity: "base",
      })
    );
    setStockItems(items);
    return items;
  } catch (error) {
    console.warn("[stock] Failed to refresh from filesystem:", error);
    return getStockItems();
  }
}
