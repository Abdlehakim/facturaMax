// Persistence helpers for client records

const STORAGE_KEY = "sem_client_items_v1";

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

function persist(items) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
  } catch {}
}

function normalizeClient(data = {}, extras = {}) {
  const nameSource = data.name ?? data.fullName ?? data.clientName ?? "";
  const typeSource = data.type ?? data.clientType ?? data.category ?? "";
  const idSource = data.identifier ?? data.id ?? data.registration ?? data.registrationId ?? data.taxNumber ?? "";
  const phoneSource = data.phone ?? data.telephone ?? data.mobile ?? "";
  const emailSource = data.email ?? data.mail ?? data.contactEmail ?? "";

  const typeRaw = typeof typeSource === "string" ? typeSource.trim().toLowerCase() : String(typeSource || "").trim().toLowerCase();
  const clientType = typeRaw.includes("particulier") ? "particulier" : "societe";

  const entry = {
    name: typeof nameSource === "string" ? nameSource.trim() : String(nameSource || "").trim(),
    clientType,
    identifier: typeof idSource === "string" ? idSource.trim() : String(idSource || "").trim(),
    phone: typeof phoneSource === "string" ? phoneSource.trim() : String(phoneSource || "").trim(),
    email: typeof emailSource === "string" ? emailSource.trim() : String(emailSource || "").trim(),
  };
  if (extras && typeof extras === "object") Object.assign(entry, extras);
  return entry;
}

function getState() {
  const SEM = window.SEM || (window.SEM = {});
  SEM.clients = SEM.clients || {};
  if (!Array.isArray(SEM.clients.items)) {
    const stored = loadFromStorage();
    SEM.clients.items = Array.isArray(stored) ? stored.map((item) => normalizeClient(item)) : [];
  }
  return SEM.clients;
}

export function ensureClientState() {
  return getState().items;
}

export function getClientItems() {
  return ensureClientState();
}

export function setClientItems(items, { persistState = true } = {}) {
  const state = getState();
  state.items.length = 0;
  if (Array.isArray(items)) {
    items.forEach((item) => {
      state.items.push(normalizeClient(item));
    });
  }
  if (persistState) persist(state.items);
  return state.items;
}

export function addClient(item, extras = {}) {
  const state = getState();
  const normalized = normalizeClient(item, extras);
  state.items.push(normalized);
  persist(state.items);
  return state.items;
}

export function updateClient(index, item, extras = {}) {
  const state = getState();
  if (Number.isInteger(index) && index >= 0 && index < state.items.length) {
    state.items[index] = normalizeClient(item, extras);
    persist(state.items);
  }
  return state.items;
}

export function deleteClient(index) {
  const state = getState();
  if (Number.isInteger(index) && index >= 0 && index < state.items.length) {
    state.items.splice(index, 1);
    persist(state.items);
  }
  return state.items;
}
