(function (w) {
  try { console.log("[invoice] ItemSearchController loaded"); } catch {}
  const SEM = (w.SEM = w.SEM || {});
  if (typeof SEM.setupInvoiceItemSearch === "function") return;

  let sharedApi = null;

  function bindApi(api) {
    SEM.invalidateStockSearchPool = api.invalidateStockSearchPool;
    SEM.ensureStockPoolFromFilesystem = api.ensureStockPoolFromFilesystem;
    SEM.addItemFromStock = api.addItemFromStock;
    w.SEM.attachItemSearch = api.attachItemSearch;
  }

  function tryAttachOrObserve() {
    try { if (console && console.log) console.log("[invoice] tryAttachOrObserve invoked", { readyState: document.readyState }); } catch {}
    try {
      const input = document.getElementById("itemSearchInput");
      const results = document.getElementById("itemSearchResults");
      if (input && results) {
        try { w.SEM.attachItemSearch?.(); } catch {}
        return;
      }
      const target = document.body || document.documentElement;
      const obs = new MutationObserver(() => {
        const el1 = document.getElementById("itemSearchInput");
        const el2 = document.getElementById("itemSearchResults");
        if (el1 && el2) {
          try { w.SEM.attachItemSearch?.(); } catch {}
          obs.disconnect();
        }
      });
      obs.observe(target, { childList: true, subtree: true });
      setTimeout(() => { try { obs.disconnect(); } catch {} }, 15000);
    } catch (err) {
      try { console.warn("[invoice] tryAttachOrObserve error:", err); } catch {}
    }
  }

  SEM.setupInvoiceItemSearch = function setupInvoiceItemSearch(windowOverride) {
    if (sharedApi) {
      bindApi(sharedApi);
      tryAttachOrObserve();
      return sharedApi;
    }

    const root = windowOverride || w;
    const state = () => SEM.state;
    const STORAGE_KEY = "sem_stock_items_v1";

    const canFetchFromFs = () =>
      !!(root.SoukElMeuble && typeof root.SoukElMeuble.listArticles === "function");

    const getEl =
      root.getEl ||
      ((id) =>
        typeof root.document === "undefined" ? null : root.document.getElementById(id));

    let cachedPool = null;
    let loadingPromise = null;

    function escapeLite(value) {
      const str = String(value ?? "");
      if (!str) return "";
      if (typeof root.escapeHTML === "function") return root.escapeHTML(str);
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normaliseCandidate(data = {}) {
      if (!data || typeof data !== "object") return null;
      const refSource = data.ref ?? data.reference ?? "";
      const nameSource = data.name ?? data.product ?? data.label ?? "";
      const descSource = data.desc ?? data.description ?? data.details ?? "";
      const qtyRaw = Number(data.qty ?? data.quantity ?? 1);
      const priceRaw = Number(data.price ?? data.unitPrice ?? 0);
      const tvaRaw = Number(data.tva ?? data.vat ?? 0);
      const discountRaw = Number(data.discount ?? data.remise ?? 0);

      const item = {
        ref:
          typeof refSource === "string"
            ? refSource.trim()
            : String(refSource ?? "").trim(),
        name:
          typeof nameSource === "string"
            ? nameSource.trim()
            : String(nameSource ?? "").trim(),
        desc:
          typeof descSource === "string"
            ? descSource.trim()
            : String(descSource ?? "").trim(),
        qty: Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1,
        price: Number.isFinite(priceRaw) ? priceRaw : 0,
        tva: Number.isFinite(tvaRaw) ? tvaRaw : 0,
        discount: Number.isFinite(discountRaw) ? discountRaw : 0,
      };
      if (data.__path) item.__path = data.__path;
      if (data.__fileName) item.__fileName = data.__fileName;
      return item;
    }

    function pushCandidate(pool, seen, entry) {
      const normalised = normaliseCandidate(entry);
      if (!normalised) return null;
      const key = `${normalised.ref}|${normalised.name}|${normalised.desc}`.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);
      pool.push(normalised);
      return normalised;
    }

    function buildPool(seed = []) {
      const pool = [];
      const seen = new Set();
      const push = (entry) => pushCandidate(pool, seen, entry);
      if (Array.isArray(seed)) seed.forEach(push);
      const fromState = root.SEM?.stock?.items;
      if (Array.isArray(fromState)) fromState.forEach(push);
      if (typeof root.localStorage !== "undefined") {
        try {
          const raw = root.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) parsed.forEach(push);
          }
        } catch {}
      }
      return pool;
    }

    function getPool(force = false) {
      if (!force && Array.isArray(cachedPool)) return cachedPool;
      cachedPool = buildPool();
      return cachedPool;
    }

    function invalidatePool() {
      cachedPool = null;
    }

    function ensureFromFilesystem(options = {}) {
      const { force = false } = options;
      if (!canFetchFromFs()) return null;
      if (!force && Array.isArray(cachedPool) && cachedPool.length) return null;
      if (loadingPromise) return loadingPromise;

      loadingPromise = (async () => {
        try {
          const rawList = await root.SoukElMeuble.listArticles();
          const arr = Array.isArray(rawList?.items)
            ? rawList.items
            : Array.isArray(rawList)
            ? rawList
            : [];
          const seed = arr.map((entry) => {
            const base = entry?.article || entry || {};
            return { ...base, __path: entry?.path, __fileName: entry?.name };
          });
          const pool = buildPool(seed);
          cachedPool = pool;
          const stock = (root.SEM.stock = root.SEM.stock || {});
          stock.items = pool.map((item) => ({ ...item }));
          if (typeof root.localStorage !== "undefined") {
            try {
              const persistable = pool.map(({ __path, __fileName, ...rest }) => rest);
              root.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
            } catch {}
          }
          return pool;
        } catch (error) {
          if (console && typeof console.warn === "function") {
            console.warn("[invoice] Failed to load stock articles:", error);
          }
          return Array.isArray(cachedPool) ? cachedPool : [];
        } finally {
          loadingPromise = null;
        }
      })();

      return loadingPromise;
    }

    function filterMatches(term, limit = 8) {
      const value = String(term || "").trim().toLowerCase();
      if (!value) return [];
      const tokens = value.split(/\s+/).filter(Boolean);
      if (!tokens.length) return [];
      const pool = getPool();
      if (!Array.isArray(pool) || !pool.length) return [];
      return pool
        .filter((item) => {
          const haystack = `${item.ref} ${item.name} ${item.desc}`.toLowerCase();
          return tokens.every((token) => haystack.includes(token));
        })
        .slice(0, limit);
    }

    function formatMoneyForSearch(value) {
      const currency = state()?.meta?.currency || "TND";
      if (typeof root.formatMoney === "function") return root.formatMoney(value, currency);
      try {
        return new root.Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
        }).format(Number(value) || 0);
      } catch {
        const n = Number(value || 0);
        return `${Number.isFinite(n) ? n.toFixed(2) : "0.00"} ${currency}`.trim();
      }
    }

    function addItemFromStock(stockItem) {
      const normalised = normaliseCandidate(stockItem);
      if (!normalised) return;
      const st = state() || (SEM.state = {});
      if (!Array.isArray(st.items)) st.items = [];

      const refKey  = String(normalised.ref || "").trim().toLowerCase();
      const nameKey = String(normalised.name || "").trim().toLowerCase();
      const descKey = String(normalised.desc || "").trim().toLowerCase();
      const priceN  = Number(normalised.price || 0);
      const tvaN    = Number(normalised.tva || 0);
      const discN   = Number(normalised.discount || 0);

      const idx = st.items.findIndex((it) => {
        return (
          String(it.ref || "").trim().toLowerCase() === refKey &&
          String(it.product || "").trim().toLowerCase() === nameKey &&
          String(it.desc || "").trim().toLowerCase() === descKey &&
          Number(it.price || 0) === priceN &&
          Number(it.tva || 0) === tvaN &&
          Number(it.discount || 0) === discN
        );
      });

      if (idx >= 0) {
        const line = st.items[idx];
        if (!Number.isFinite(line.stockQty)) {
          line.stockQty = Number.isFinite(normalised.qty) && normalised.qty > 0 ? normalised.qty : 0;
        }
        const stockMax = Number(line.stockQty || 0);
        let next = Number(line.qty || 0) + 1;
        if (Number.isFinite(stockMax) && stockMax > 0 && next > stockMax) next = stockMax;
        line.qty = next;
        SEM.renderItems?.();
        return;
      }

      const invoiceItem = {
        ref: normalised.ref || "",
        product: normalised.name || "",
        desc: normalised.desc || "",
        qty: 1,
        stockQty: Number.isFinite(normalised.qty) && normalised.qty > 0 ? normalised.qty : 0,
        price: Number.isFinite(normalised.price) ? normalised.price : 0,
        tva: Number.isFinite(normalised.tva) ? normalised.tva : 0,
        discount: Number.isFinite(normalised.discount) ? normalised.discount : 0,
      };
      st.items.push(invoiceItem);
      SEM.renderItems?.();
    }

    function attachItemSearch() {
      const input = getEl("itemSearchInput");
      const results = getEl("itemSearchResults");
      if (!input || !results) {
        try { console.log("[invoice] attachItemSearch: missing nodes", { hasInput: !!input, hasResults: !!results }); } catch {}
        return;
      }
      if (input.dataset.bound === "1") return;
      input.dataset.bound = "1";
      if (console && console.log) console.log("[invoice] attachItemSearch bound");

      let currentResults = [];
      let currentTerm = "";

      const hideResults = () => {
        results.innerHTML = "";
        results.classList.remove("is-visible");
        results.style.display = "none";
        if (console && console.log) console.log("[invoice] search dropdown hidden");
      };

      const showEmpty = () => {
        results.innerHTML = `<div class="item-search__empty">Aucun article trouvé.</div>`;
        results.classList.add("is-visible");
        results.style.display = "block";
      };

      const renderResults = () => {
        if (!currentResults.length) {
          showEmpty();
          return;
        }
        results.innerHTML = currentResults
          .map((item, idx) => {
            const title = escapeLite(item.name || item.ref || "Article");
            const badge = item.ref
              ? `<span class="item-search__badge">${escapeLite(item.ref)}</span>`
              : "";
            const desc = item.desc
              ? `<span class="item-search__desc">${escapeLite(item.desc)}</span>`
              : "";
            const subtitleParts = [];
            if (badge) subtitleParts.push(badge);
            if (desc) subtitleParts.push(desc);
            const subtitle = subtitleParts.length
              ? `<div class="item-search__subtitle">${subtitleParts.join("")}</div>`
              : "";
            const priceLabel = escapeLite(formatMoneyForSearch(item.price));
            return `
              <div class="item-search__result" data-index="${idx}" role="option" aria-selected="false">
                <div class="item-search__info">
                  <div class="item-search__title">${title}</div>
                  ${subtitle}
                </div>
                <div class="item-search__meta">
                  <span class="item-search__price">${priceLabel}</span>
                </div>
              </div>`;
          })
          .join("");
        results.classList.add("is-visible");
        results.style.display = "block";
      };

      const updateResults = () => {
        currentTerm = input.value.trim();
        if (currentTerm.length < 2) {
          currentResults = [];
          results.innerHTML = `<div class="item-search__empty">Saisissez au moins 2 lettres pour lancer la recherche.</div>`;
          results.classList.add("is-visible");
          results.style.display = "block";
          if (console && console.log) {
            console.log("[invoice] search input", { term: currentTerm, results: [], source: "min-length" });
          }
          return;
        }
        currentResults = filterMatches(currentTerm, 10);
        if (console && console.log) {
          console.log("[invoice] search input", {
            term: currentTerm,
            results: currentResults.map((x) => ({ ref: x.ref, name: x.name, price: x.price })),
            source: "live-input",
          });
        }
        if (!currentResults.length) {
          showEmpty();
          const maybeReload = ensureFromFilesystem();
          if (maybeReload && typeof maybeReload.then === "function") {
            const requested = currentTerm;
            maybeReload
              .then(() => {
                if (input.value.trim() !== requested) return;
                currentResults = filterMatches(requested, 10);
                if (console && console.log) {
                  console.log("[invoice] search input", {
                    term: requested,
                    results: currentResults.map((x) => ({ ref: x.ref, name: x.name, price: x.price })),
                    source: "fs-refresh",
                  });
                }
                if (currentResults.length) renderResults();
                else showEmpty();
              })
              .catch(() => {});
          }
          return;
        }
        renderResults();
      };

      const addSelection = (index = 0) => {
        const entry = currentResults[index];
        if (!entry) {
          if (currentTerm.length >= 2) {
            if (typeof root.showDialog === "function") {
              root.showDialog("Aucun article ne correspond à votre recherche.", { title: "Stock" });
            } else if (typeof root.alert === "function") {
              root.alert("Aucun article ne correspond à votre recherche.");
            }
          }
          return;
        }
        addItemFromStock(entry);
        input.value = "";
        currentTerm = "";
        currentResults = [];
        hideResults();
        input.focus();
      };

      const maybeInitial = ensureFromFilesystem();
      if (maybeInitial && typeof maybeInitial.then === "function") {
        maybeInitial
          .then(() => {
            if (input.value.trim().length >= 2) {
              currentTerm = input.value.trim();
              currentResults = filterMatches(currentTerm, 10);
              if (console && console.log) {
                console.log("[invoice] search input", {
                  term: currentTerm,
                  results: currentResults.map((x) => ({ ref: x.ref, name: x.name, price: x.price })),
                  source: "initial-load",
                });
              }
              if (currentResults.length) renderResults();
              else showEmpty();
            }
          })
          .catch(() => {});
      }

      input.addEventListener("input", updateResults);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          addSelection(0);
        } else if (ev.key === "Escape") {
          hideResults();
          currentResults = [];
        }
      });

      results.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
      });

      results.addEventListener("click", (ev) => {
        const row = ev.target.closest(".item-search__result");
        if (row) addSelection(Number(row.dataset.index || "0"));
      });
    }

    sharedApi = {
      invalidateStockSearchPool: invalidatePool,
      ensureStockPoolFromFilesystem: ensureFromFilesystem,
      addItemFromStock,
      attachItemSearch,
    };

    bindApi(sharedApi);

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", tryAttachOrObserve, { once: true });
      } else {
        Promise.resolve().then(tryAttachOrObserve);
      }
    }

    return sharedApi;
  };

  SEM.setupInvoiceItemSearch();
})(window);
