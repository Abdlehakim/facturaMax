// gestionFacture/app-bindings-CreateInvoice.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  const state = () => SEM.state;
  const STOCK_STORAGE_KEY = "sem_stock_items_v1";
  const canFetchStockFromFS = () => !!(w.SoukElMeuble && typeof w.SoukElMeuble.listArticles === "function");

  let cachedStockSearchPool = null;
  let stockPoolLoadPromise = null;

  function escapeHtmlLite(value) {
    const str = String(value ?? "");
    if (!str) return "";
    if (typeof w.escapeHTML === "function") return w.escapeHTML(str);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeStockCandidate(data = {}) {
    if (!data || typeof data !== "object") return null;
    const refSource = data.ref ?? data.reference ?? "";
    const nameSource = data.name ?? data.product ?? data.label ?? "";
    const descSource = data.desc ?? data.description ?? data.details ?? "";
    const qtyRaw = Number(data.qty ?? data.quantity ?? 1);
    const priceRaw = Number(data.price ?? data.unitPrice ?? 0);
    const tvaRaw = Number(data.tva ?? data.vat ?? 0);
    const discountRaw = Number(data.discount ?? data.remise ?? 0);
    const item = {
      ref: typeof refSource === "string" ? refSource.trim() : String(refSource ?? "").trim(),
      name: typeof nameSource === "string" ? nameSource.trim() : String(nameSource ?? "").trim(),
      desc: typeof descSource === "string" ? descSource.trim() : String(descSource ?? "").trim(),
      qty: Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1,
      price: Number.isFinite(priceRaw) ? priceRaw : 0,
      tva: Number.isFinite(tvaRaw) ? tvaRaw : 0,
      discount: Number.isFinite(discountRaw) ? discountRaw : 0,
    };
    if (data.__path) item.__path = data.__path;
    if (data.__fileName) item.__fileName = data.__fileName;
    return item;
  }

  function pushStockCandidate(pool, seen, entry) {
    const normalized = normalizeStockCandidate(entry);
    if (!normalized) return null;
    const key = `${normalized.ref}|${normalized.name}|${normalized.desc}`.toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    pool.push(normalized);
    return normalized;
  }

  function buildStockSearchPool(seedEntries = []) {
    const pool = [];
    const seen = new Set();
    const push = (entry) => pushStockCandidate(pool, seen, entry);
    if (Array.isArray(seedEntries)) seedEntries.forEach(push);
    const fromState = w.SEM?.stock?.items;
    if (Array.isArray(fromState)) fromState.forEach(push);
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem(STOCK_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) parsed.forEach(push);
        }
      } catch {}
    }
    return pool;
  }

  function getStockSearchPool(force = false) {
    if (!force && Array.isArray(cachedStockSearchPool)) return cachedStockSearchPool;
    cachedStockSearchPool = buildStockSearchPool();
    return cachedStockSearchPool;
  }

  function invalidateStockSearchPool() {
    cachedStockSearchPool = null;
  }

  function ensureStockPoolFromFilesystem({ force = false } = {}) {
    if (!canFetchStockFromFS()) return null;
    if (!force && Array.isArray(cachedStockSearchPool) && cachedStockSearchPool.length) return null;
    if (stockPoolLoadPromise) return stockPoolLoadPromise;
    stockPoolLoadPromise = (async () => {
      try {
        const rawList = await w.SoukElMeuble.listArticles();
        const arr = Array.isArray(rawList?.items) ? rawList.items : Array.isArray(rawList) ? rawList : [];
        const seed = arr.map((entry) => {
          const base = entry?.article || entry || {};
          return { ...base, __path: entry?.path, __fileName: entry?.name };
        });
        const pool = buildStockSearchPool(seed);
        cachedStockSearchPool = pool;
        const stock = (w.SEM.stock = w.SEM.stock || {});
        stock.items = pool.map((item) => ({ ...item }));
        if (typeof localStorage !== "undefined") {
          try {
            const persistable = pool.map(({ __path, __fileName, ...rest }) => rest);
            localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(persistable));
          } catch {}
        }
        return pool;
      } catch (error) {
        console.warn("[invoice] Failed to load stock articles:", error);
        return Array.isArray(cachedStockSearchPool) ? cachedStockSearchPool : [];
      } finally {
        stockPoolLoadPromise = null;
      }
    })();
    return stockPoolLoadPromise;
  }

  function filterStockMatches(term, limit = 8) {
    const value = String(term || "").trim().toLowerCase();
    if (!value) return [];
    const tokens = value.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const pool = getStockSearchPool();
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
    if (typeof w.formatMoney === "function") return w.formatMoney(value, currency);
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value) || 0);
    } catch {
      const n = Number(value || 0);
      return `${Number.isFinite(n) ? n.toFixed(2) : "0.00"} ${currency}`.trim();
    }
  }

  SEM.toggleSealFields = function (enabled) {
    const f = getEl("sealFields");
    if (f) f.style.display = enabled ? "" : "none";
  };

  SEM.refreshSealPreview = function () {
    const st = state();
    const wrap = getEl("sealPreviewWrap");
    const img = getEl("sealPreview");
    if (!wrap || !img) return;
    const seal = st.company?.seal || {};
    if (seal.enabled && seal.image) { img.src = seal.image; wrap.style.display = ""; }
    else { img.src = ""; wrap.style.display = "none"; }
  };

  SEM.setSealImage = function (dataUrl) {
    const st = state();
    st.company = st.company || {};
    st.company.seal = st.company.seal || { enabled:false, image:"", maxWidthMm:38, maxHeightMm:38, opacity:0.88, rotateDeg:-2 };
    st.company.seal.image = dataUrl || "";
    if (st.company.seal.image) st.company.seal.enabled = true;
    SEM.refreshSealPreview();
  };

  SEM.loadSealFromFile = async function (file) {
    if (!file) return;
    if (file.type && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => SEM.setSealImage(String(reader.result || ""));
      reader.readAsDataURL(file);
      return;
    }
    if (file.type === "application/pdf") {
      if (!w.pdfjsLib) { await showDialog("Impossible de lire le PDF sans pdf.js. Veuillez l'installer/charger localement, ou joignez une image.", { title: "Cachet PDF" }); return; }
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        SEM.setSealImage(canvas.toDataURL("image/png", 0.92));
      } catch {
        await showDialog("Echec du chargement du PDF. Essayez un autre fichier ou convertissez-le en image.", { title: "Cachet PDF" });
      }
      return;
    }
    await showDialog("Format de fichier non supporte. Joignez une image ou un PDF.", { title: "Cachet" });
  };

  SEM.updateClientIdPlaceholder = function () {
    const typeSel = getEl("clientType");
    const type = (typeSel?.value || state().client?.type || "societe").toLowerCase();
    const idInput = getEl("clientVat");
    if (idInput) idInput.placeholder = type === "particulier" ? "CIN ou Passeport" : "XXXXXXXXX";
  };

  function setBlockDisplay(id, on) { const el = getEl(id); if (el) el.style.display = on ? "grid" : "none"; }

  function forceExtrasVisibility() {
    setBlockDisplay("fodecFields", !!getEl("fodecEnabled")?.checked);
    setBlockDisplay("shipFields",  !!getEl("shipEnabled") ?.checked);
    setBlockDisplay("stampFields", !!getEl("stampEnabled")?.checked);
    const whOn = !!getEl("whEnabled")?.checked;
    const whFields = getEl("whFields");
    if (whFields) whFields.style.display = whOn ? "grid" : "none";
  }

  SEM.toggleWHFields   = (on) => setBlockDisplay("whFields",   on);
  SEM.toggleShipFields = (on) => setBlockDisplay("shipFields",  on);
  SEM.toggleStampFields= (on) => setBlockDisplay("stampFields", on);
  SEM.toggleFodecFields= (on) => setBlockDisplay("fodecFields", on);

  SEM.updateWHAmountPreview = function () {
    const { whAmount } = SEM.computeTotalsReturn();
    setVal("whAmount", formatMoney(whAmount, state().meta.currency || "TND"));
    const lbl = state().meta.withholding?.label?.trim() || "Retenue a la source";
    setText("miniWHLabel", lbl);
  };

  SEM.updateExtrasMiniRows = function () {
    const st = state();
    const cur = st.meta.currency || "TND";
    const ex = st.meta.extras || {};
    const totals = SEM.computeTotalsReturn();

    const shipEnabled = !!ex.shipping?.enabled;
    const shipTT = shipEnabled ? (Number(ex.shipping.amount || 0) * (1 + Number(ex.shipping.tva || 0) / 100)) : 0;
    setText("miniShipLabel", ex.shipping?.label?.trim() || "Frais de livraison");
    setText("miniShip", formatMoney(shipTT, cur));
    const shipRow = getEl("miniShipRow"); if (shipRow) shipRow.style.display = shipEnabled ? "" : "none";

    const stampEnabled = !!ex.stamp?.enabled;
    const stampTT = stampEnabled ? (Number(ex.stamp.amount || 0) * (1 + Number(ex.stamp.tva || 0) / 100)) : 0;
    setText("miniStampLabel", ex.stamp?.label?.trim() || "Timbre fiscal");
    setText("miniStamp", formatMoney(stampTT, cur));
    const stampRow = getEl("miniStampRow"); if (stampRow) stampRow.style.display = stampEnabled ? "" : "none";

    const f = ex.fodec || {};
    const fEnabled = !!f.enabled;
    const fLabel = (f.label || "FODEC").trim();
    const fRate = Number(f.rate || 0);
    const fodecHT = fEnabled ? (totals?.extras?.fodecHT || 0) : 0;
    const rateStr = (Number.isInteger(Math.abs(fRate)) ? String(Math.abs(fRate)) : String(Math.abs(fRate)).replace(/\.?0+$/, "")) + "%";
    const miniRow = getEl("miniFODECRow"); const miniLbl = getEl("miniFODECLabel"); const miniVal = getEl("miniFODEC");
    if (miniRow) miniRow.style.display = fEnabled ? "" : "none";
    if (miniLbl) miniLbl.textContent = fEnabled ? `${fLabel} (${rateStr})` : fLabel;
    if (miniVal) miniVal.textContent = formatMoney(fodecHT, cur);

    const fodecAuto = getEl("fodecAmount");
    if (fodecAuto) fodecAuto.value = fEnabled ? formatMoney(fodecHT, cur) : "";
  };

  SEM.bind = function () {
    const st = state();
    st.items = Array.isArray(st.items) ? st.items : [];

    [["companyName","name"],["companyVat","vat"],["companyPhone","phone"],["companyEmail","email"],["companyAddress","address"]]
      .forEach(([id, key]) => { const el = getEl(id); if (!el) return;
        el.value = st.company[key] || "";
        if (SEM.COMPANY_LOCKED) { el.readOnly = true; el.classList.add("locked"); el.setAttribute("tabindex", "-1"); }
      });

    const seal = st.company?.seal || {};
    const sealCb = getEl("sealEnabled");
    if (sealCb) sealCb.checked = !!seal.enabled;
    SEM.toggleSealFields(!!seal.enabled);
    SEM.refreshSealPreview();

    setVal("docType", st.meta.docType || "facture");
    setVal("invNumber", st.meta.number);
    // Currency UI removed; always TND
    setVal("invDate", st.meta.date);
    setVal("invDue", st.meta.due);

    setVal("clientType", st.client.type || "societe");
    setVal("clientName", st.client.name);
    setVal("clientEmail", st.client.email);
    setVal("clientPhone", st.client.phone);
    setVal("clientVat", st.client.vat);
    setVal("clientAddress", st.client.address);

    const wh = st.meta.withholding || { enabled:false, rate:1.5, base:"ht", label:"Retenue a la source", threshold:1000 };
    if (getEl("whEnabled")) getEl("whEnabled").checked = !!wh.enabled;
    setVal("whRate", String(wh.rate ?? 1.5));
    setVal("whBase", String(wh.base ?? "ht"));
    setVal("whLabel", String(wh.label ?? "Retenue a la source"));
    setVal("whThreshold", String(wh.threshold ?? 0));

    const ex = st.meta.extras || {};
    const s = ex.shipping || {};
    const t = ex.stamp || {};
    const f = ex.fodec || {};

    if (getEl("shipEnabled")) getEl("shipEnabled").checked = !!s.enabled;
    setVal("shipLabel", String(s.label ?? "Frais de livraison"));
    setVal("shipAmount", String(s.amount ?? 7));
    setVal("shipTva", String(s.tva ?? 19));

    if (getEl("stampEnabled")) getEl("stampEnabled").checked = !!t.enabled;
    setVal("stampLabel", String(t.label ?? "Timbre fiscal"));
    setVal("stampAmount", String(t.amount ?? 1));
    setVal("stampTva", String(t.tva ?? 0));

    if (getEl("fodecEnabled")) getEl("fodecEnabled").checked = !!f.enabled;
    setVal("fodecLabel", String(f.label ?? "FODEC"));
    setVal("fodecRate", String(f.rate ?? 1));
    setVal("fodecBase", String(f.base ?? "ht"));
    setVal("fodecTva", String(f.tva ?? 19));

    // make the blocks match the checkboxes **now**
    forceExtrasVisibility();

    const bundled = "./assets/logoIMG.png";
    const logo = w.SoukElMeuble?.assets?.logo || st.company.logo || bundled;
    setSrc("companyLogo", logo);
    if (!st.company.logo) st.company.logo = bundled;

    setVal("notes", st.notes);
    setText("year", new Date().getFullYear());

    ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"]
      .forEach(id => { const el = getEl(id); if (el && el.checked === false) el.checked = true; });

    // ensure the visibility toggles are active
    SEM.wireColumnToggles?.();

    SEM.renderItems();
    SEM.computeTotals();
    SEM.applyColumnHiding();
    SEM.updateWHAmountPreview();
    SEM.updateExtrasMiniRows();
    SEM.updateClientIdPlaceholder();
  };

  SEM.computeTotals = function () {
    SEM.readInputs();
    const currency = state().meta.currency || "TND";
    const totals = SEM.computeTotalsReturn();

    setText("miniHT",  formatMoney(totals.totalHT, currency));
    setText("miniTVA", formatMoney(totals.tax,     currency));
    setText("miniTTC", formatMoney(totals.totalTTC,currency));

    const whRow = getEl("miniWHRow");
    const netRow = getEl("miniNETRow");
    const wh = state().meta.withholding || {};
    if (whRow)  whRow.style.display  = wh.enabled ? "" : "none";
    if (netRow) netRow.style.display = wh.enabled ? "" : "none";
    if (wh.enabled) {
      const lbl = wh.label?.trim() || "Retenue a la source";
      setText("miniWHLabel", lbl);
      setText("miniWH", "- " + formatMoney(totals.whAmount, currency));
      setText("miniNET", formatMoney(totals.net, currency));
    }

    const fodecAuto = getEl("fodecAmount");
    const fodecEnabled = !!state().meta.extras?.fodec?.enabled;
    if (fodecAuto) fodecAuto.value = fodecEnabled ? formatMoney(totals.extras.fodecHT, currency) : "";

    SEM.updateExtrasMiniRows();
  };

  SEM.clearAddForm = function () {
    setVal("addRef",""); setVal("addProduct",""); setVal("addDesc","");
    setVal("addQty","1"); setVal("addPrice","0"); setVal("addTva","19"); setVal("addDiscount","0");
  };

  SEM.fillAddFormFromItem = function (it) {
    setVal("addRef", it.ref ?? "");
    setVal("addProduct", it.product ?? "");
    setVal("addDesc", it.desc ?? "");
    setVal("addQty", String(it.qty ?? 1));
    setVal("addPrice", String(it.price ?? 0));
    setVal("addTva", String(it.tva ?? 19));
    setVal("addDiscount", String(it.discount ?? 0));
  };

  SEM.setSubmitMode = function (mode) {
    const submitBtn = getEl("btnSubmitItem");
    const newBtn = getEl("btnNewItem");
    if (!submitBtn || !newBtn) return;
    if (mode === "update") { submitBtn.textContent = "Mettre a jour"; submitBtn.dataset.mode = "update"; newBtn.disabled = false; }
    else { submitBtn.textContent = "+ Ajouter"; submitBtn.dataset.mode = "add"; newBtn.disabled = true; }
  };

  SEM.clearAddFormAndMode = function () {
    SEM.selectedItemIndex = null;
    SEM.clearAddForm();
    SEM.setSubmitMode("add");
  };

  SEM.enterUpdateMode = function (i) {
    SEM.selectedItemIndex = i;
    SEM.fillAddFormFromItem(state().items[i]);
    SEM.setSubmitMode("update");
  };

  SEM.submitItemForm = async function () {
    const item = {
      ref: getStr("addRef"),
      product: getStr("addProduct"),
      desc: getStr("addDesc"),
      qty: getNum("addQty",1),
      price: getNum("addPrice",0),
      tva: getNum("addTva",19),
      discount: getNum("addDiscount",0)
    };
    if (!item.product && !item.desc) {
      await showDialog("Veuillez saisir au moins un Produit ou une Description.", { title: "Article incomplet" });
      return;
    }
    const mode = getEl("btnSubmitItem")?.dataset.mode || "add";
    if (mode === "update" && SEM.selectedItemIndex !== null) { state().items[SEM.selectedItemIndex] = item; }
    else { state().items.push(item); }
    SEM.renderItems();
    SEM.clearAddFormAndMode();
  };

  SEM.invalidateStockSearchPool = invalidateStockSearchPool;
  SEM.ensureStockPoolFromFilesystem = ensureStockPoolFromFilesystem;

  SEM.addItemFromStock = function (stockItem) {
    const normalized = normalizeStockCandidate(stockItem);
    if (!normalized) return;
    const st = state();
    if (!Array.isArray(st.items)) st.items = [];
    const invoiceItem = {
      ref: normalized.ref || "",
      product: normalized.name || "",
      desc: normalized.desc || "",
      qty: Number.isFinite(normalized.qty) && normalized.qty > 0 ? normalized.qty : 1,
      price: Number.isFinite(normalized.price) ? normalized.price : 0,
      tva: Number.isFinite(normalized.tva) ? normalized.tva : 0,
      discount: Number.isFinite(normalized.discount) ? normalized.discount : 0,
    };
    st.items.push(invoiceItem);
    SEM.renderItems?.();
  };

  SEM.attachItemSearch = function () {
    const input = getEl("itemSearchInput");
    const results = getEl("itemSearchResults");
    if (!input || !results) return;
    if (input.dataset.bound === "1") return;
    input.dataset.bound = "1";

    let currentResults = [];
    let currentTerm = "";

    const hideResults = () => {
      results.innerHTML = "";
      results.classList.remove("is-visible");
    };

    const renderResults = () => {
      if (!currentResults.length) {
        results.innerHTML = `<div class="item-search__empty">Aucun article trouve.</div>`;
        results.classList.add("is-visible");
        return;
      }
      results.innerHTML = currentResults
        .map((item, idx) => {
          const title = escapeHtmlLite(item.name || item.ref || "Article");
          const badge = item.ref ? `<span class="item-search__badge">${escapeHtmlLite(item.ref)}</span>` : "";
          const desc = item.desc ? `<span class="item-search__desc">${escapeHtmlLite(item.desc)}</span>` : "";
          const subtitleParts = [];
          if (badge) subtitleParts.push(badge);
          if (desc) subtitleParts.push(desc);
          const subtitle = subtitleParts.length ? `<div class="item-search__subtitle">${subtitleParts.join("")}</div>` : "";
          const priceLabel = escapeHtmlLite(formatMoneyForSearch(item.price));
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
    };

    const updateResults = () => {
      currentTerm = input.value.trim();
      if (currentTerm.length < 2) {
        currentResults = [];
        hideResults();
        return;
      }
      currentResults = filterStockMatches(currentTerm, 10);
      if (!currentResults.length) {
        results.innerHTML = `<div class="item-search__empty">Aucun article trouve.</div>`;
        results.classList.add("is-visible");
        const maybeReload = ensureStockPoolFromFilesystem();
        if (maybeReload && typeof maybeReload.then === "function") {
          const requestedTerm = currentTerm;
          maybeReload
            .then(() => {
              if (input.value.trim() !== requestedTerm) return;
              currentResults = filterStockMatches(requestedTerm, 10);
              if (currentResults.length) renderResults();
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
          if (typeof w.showDialog === "function") w.showDialog("Aucun article ne correspond a votre recherche.", { title: "Stock" });
          else if (typeof w.alert === "function") w.alert("Aucun article ne correspond a votre recherche.");
        }
        return;
      }
      SEM.addItemFromStock(entry);
      input.value = "";
      currentTerm = "";
      currentResults = [];
      hideResults();
      input.focus();
    };

    const maybeInitialLoad = ensureStockPoolFromFilesystem();
    if (maybeInitialLoad && typeof maybeInitialLoad.then === "function") {
      maybeInitialLoad.then(() => {
        if (input.value.trim().length >= 2) {
          currentTerm = input.value.trim();
          currentResults = filterStockMatches(currentTerm, 10);
          if (currentResults.length) renderResults();
        }
      }).catch(() => {});
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
  };

  SEM.renderItems = function () {
    const body = getEl("itemBody"); if (!body) return;
    body.innerHTML = "";
    const currency = state().meta.currency || "TND";

    let items = state().items;
    if (!Array.isArray(items)) {
      items = [];
      state().items = items;
    }
    if (items.length === 0) {
      SEM.computeTotals(); SEM.applyColumnHiding(); SEM.updateWHAmountPreview(); SEM.updateExtrasMiniRows();
      return;
    }

    items.forEach((raw, i) => {
      const it = {
        ref: raw.ref ?? "",
        product: raw.product ?? (raw.desc ? String(raw.desc) : ""),
        desc: raw.product ? (raw.desc ?? "") : (raw.desc ?? ""),
        qty: Number(raw.qty ?? 0),
        price: Number(raw.price ?? 0),
        tva: Number(raw.tva ?? 0),
        discount: Number(raw.discount ?? 0)
      };
      const base = it.qty * it.price;
      const disc = base * (it.discount / 100);
      const taxedBase = Math.max(0, base - disc);
      const tax = taxedBase * (it.tva / 100);
      const lineTotal = taxedBase + tax;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="cell-ref">${escapeHTML(it.ref)}</td>
        <td class="cell-product">${escapeHTML(it.product)}</td>
        <td class="cell-desc">${escapeHTML(it.desc)}</td>
        <td class="cell-qty right">${formatInt(it.qty)}</td>
        <td class="cell-price right">${formatMoney(it.price, currency)}</td>
        <td class="cell-tva right">${formatPct(it.tva)}</td>
        <td class="cell-discount right">${formatPct(it.discount)}</td>
        <td class="cell-ttc right">${formatMoney(lineTotal, currency)}</td>
        <td class="add-actions">
          <button class="btn tiny sel" data-sel="${i}">Editer</button>
          <button class="del" data-del="${i}">Supprimer</button>
        </td>`;
      body.appendChild(tr);
    });

    body.querySelectorAll("button.del").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = Number(e.currentTarget.dataset.del);
        state().items.splice(idx, 1);
        if (SEM.selectedItemIndex === idx) SEM.clearAddFormAndMode();
        SEM.renderItems();
      });
    });
    body.querySelectorAll("button.sel").forEach(btn => {
      btn.addEventListener("click", (e) => SEM.enterUpdateMode(Number(e.currentTarget.dataset.sel)));
    });

    SEM.computeTotals();
    SEM.applyColumnHiding();
    SEM.updateWHAmountPreview();
    SEM.updateExtrasMiniRows();
  };

  function setColumnVisibility(table, oneBasedIndex, visible) {
    if (!table) return;
    const th = table.tHead?.rows?.[0]?.cells?.[oneBasedIndex - 1];
    if (th) th.style.display = visible ? "" : "none";
    const rows = table.tBodies[0]?.rows || [];
    for (const r of rows) {
      const cell = r.cells[oneBasedIndex - 1];
      if (cell) cell.style.display = visible ? "" : "none";
    }
  }

  function setAddInputVisibility({ ref, product, desc, qty, price, tva, discount }) {
    const bySel = [
      [".field-ref", ref],
      [".field-product", product],
      [".field-desc", desc],
      [".field-qty", qty],
      [".field-price", price],
      [".field-tva", tva],
      [".field-discount", discount],
    ];
    bySel.forEach(([sel, vis]) => {
      document.querySelectorAll(sel).forEach(node => { node.style.display = vis ? "" : "none"; });
    });
  }

  SEM.applyColumnHiding = function () {
    const checkedOrTrue = (el) => (el == null ? true : !!el.checked);
    const refVis      = checkedOrTrue(getEl('colToggleRef'));
    const productVis  = checkedOrTrue(getEl('colToggleProduct'));
    const descVis     = checkedOrTrue(getEl('colToggleDesc'));
    const qtyVis      = checkedOrTrue(getEl('colToggleQty'));
    const priceVis    = checkedOrTrue(getEl('colTogglePrice'));
    const tvaVis      = checkedOrTrue(getEl('colToggleTva'));
    const discountVis = checkedOrTrue(getEl('colToggleDiscount'));

    document.body.classList.toggle('hide-col-ref',      !refVis);
    document.body.classList.toggle('hide-col-product',  !productVis);
    document.body.classList.toggle('hide-col-desc',     !descVis);
    document.body.classList.toggle('hide-col-qty',      !qtyVis);
    document.body.classList.toggle('hide-col-price',    !priceVis);
    document.body.classList.toggle('hide-col-tva',      !tvaVis);
    document.body.classList.toggle('hide-col-discount', !discountVis);
    document.body.classList.toggle('hide-col-ttc', !priceVis);

    const itemsTable = getEl('items');
    setColumnVisibility(itemsTable, 8, priceVis);

    const mini = document.querySelector('.mini-sum');
    if (mini) mini.style.display = priceVis ? '' : 'none';

    setAddInputVisibility({ ref: refVis, product: productVis, desc: descVis, qty: qtyVis, price: priceVis, tva: tvaVis, discount: discountVis });
  };

  SEM.wireColumnToggles = function () {
    const ids = ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"];
    ids.forEach(id => { const el = getEl(id); if (el) el.checked = true; });
    SEM.applyColumnHiding();
    ids.forEach(id => getEl(id)?.addEventListener("change", () => {
      SEM.applyColumnHiding();
      SEM.computeTotals();
      SEM.updateWHAmountPreview();
      SEM.updateExtrasMiniRows();
    }));
  };

  SEM.wireLiveBindings = function () {
    if (!SEM.COMPANY_LOCKED) {
      const map = [
        ["companyName",   v => state().company.name = v],
        ["companyVat",    v => state().company.vat = v],
        ["companyPhone",  v => state().company.phone = v],
        ["companyEmail",  v => state().company.email = v],
        ["companyAddress",v => state().company.address = v],
      ];
      map.forEach(([id, set]) => getEl(id)?.addEventListener("input", () => { set(getStr(id, "")); SEM.saveCompanyToLocal?.(); }));
    }

    const sealCb = getEl("sealEnabled");
    if (sealCb) {
      sealCb.addEventListener("change", () => {
        const st = state();
        st.company.seal = st.company.seal || {};
        st.company.seal.enabled = !!sealCb.checked;
        SEM.toggleSealFields(st.company.seal.enabled);
        SEM.refreshSealPreview();
      });
    }

    const pickBtn = getEl("btnPickSeal");
    if (pickBtn) {
      pickBtn.addEventListener("click", async () => {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*,application/pdf";
        inp.onchange = async () => { const f = inp.files && inp.files[0]; await SEM.loadSealFromFile(f); };
        inp.click();
      });
    }

    getEl("docType") ?.addEventListener("change", () => { state().meta.docType  = getStr("docType",  state().meta.docType); });
    getEl("invNumber")?.addEventListener("input",  () => { state().meta.number  = getStr("invNumber",state().meta.number); });
    getEl("invDate")  ?.addEventListener("input",  () => { state().meta.date    = getStr("invDate",  state().meta.date); });
    getEl("invDue")   ?.addEventListener("input",  () => { state().meta.due     = getStr("invDue",   state().meta.due); });
    // Currency control removed; default currency is TND

    document.addEventListener("change", (e) => {
      if ((e.target)?.id === "clientType") { state().client.type = getStr("clientType", state().client.type || "societe"); SEM.updateClientIdPlaceholder(); }
      if ((e.target)?.id === "fodecEnabled" || (e.target)?.id === "shipEnabled" || (e.target)?.id === "stampEnabled" || (e.target)?.id === "whEnabled") {
        forceExtrasVisibility();
      }
    });
    document.addEventListener("input", (e) => {
      if ((e.target)?.id === "clientType") { state().client.type = getStr("clientType", state().client.type || "societe"); SEM.updateClientIdPlaceholder(); }
    });

    getEl("clientName")   ?.addEventListener("input", () => { state().client.name    = getStr("clientName",    state().client.name); });
    getEl("clientEmail")  ?.addEventListener("input", () => { state().client.email   = getStr("clientEmail",   state().client.email); });
    getEl("clientPhone")  ?.addEventListener("input", () => { state().client.phone   = getStr("clientPhone",   state().client.phone); });
    getEl("clientVat")    ?.addEventListener("input", () => { state().client.vat     = getStr("clientVat",     state().client.vat); });
    getEl("clientAddress")?.addEventListener("input", () => { state().client.address = getStr("clientAddress", state().client.address); });
    getEl("notes")?.addEventListener("input", () => { state().notes = getStr("notes", state().notes); });

    ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"]
      .forEach(id => getEl(id)?.addEventListener("change", SEM.applyColumnHiding));

    getEl("whEnabled")?.addEventListener("change", () => {
      state().meta.withholding.enabled = !!getEl("whEnabled").checked;
      SEM.toggleWHFields(state().meta.withholding.enabled);
      SEM.computeTotals(); SEM.updateWHAmountPreview();
    });
    getEl("whRate")?.addEventListener("input", () => { state().meta.withholding.rate = getNum("whRate", state().meta.withholding.rate); SEM.computeTotals(); SEM.updateWHAmountPreview(); });
    getEl("whBase")?.addEventListener("change", () => { state().meta.withholding.base = getStr("whBase", state().meta.withholding.base); SEM.computeTotals(); SEM.updateWHAmountPreview(); });
    getEl("whThreshold")?.addEventListener("input", () => { state().meta.withholding.threshold = getNum("whThreshold", state().meta.withholding.threshold ?? 0); SEM.computeTotals(); SEM.updateWHAmountPreview(); });
    getEl("whLabel")?.addEventListener("input", () => { state().meta.withholding.label = getStr("whLabel", state().meta.withholding.label); SEM.updateWHAmountPreview(); });

    getEl("shipEnabled")?.addEventListener("change", () => {
      state().meta.extras.shipping.enabled = !!getEl("shipEnabled").checked;
      SEM.toggleShipFields(state().meta.extras.shipping.enabled);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("shipLabel")?.addEventListener("input", () => { state().meta.extras.shipping.label = getStr("shipLabel", state().meta.extras.shipping.label); SEM.updateExtrasMiniRows(); });
    getEl("shipAmount")?.addEventListener("input", () => { state().meta.extras.shipping.amount = getNum("shipAmount", state().meta.extras.shipping.amount); SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview(); });
    getEl("shipTva")?.addEventListener("input", () => { state().meta.extras.shipping.tva = getNum("shipTva", state().meta.extras.shipping.tva); SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview(); });

    getEl("stampEnabled")?.addEventListener("change", () => {
      state().meta.extras.stamp.enabled = !!getEl("stampEnabled").checked;
      SEM.toggleStampFields(state().meta.extras.stamp.enabled);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("stampLabel")?.addEventListener("input", () => { state().meta.extras.stamp.label = getStr("stampLabel", state().meta.extras.stamp.label); SEM.updateExtrasMiniRows(); });
    getEl("stampAmount")?.addEventListener("input", () => { state().meta.extras.stamp.amount = getNum("stampAmount", state().meta.extras.stamp.amount); SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview(); });
    getEl("stampTva")?.addEventListener("input", () => { state().meta.extras.stamp.tva = getNum("stampTva", state().meta.extras.stamp.tva); SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview(); });

    getEl("fodecEnabled")?.addEventListener("change", () => {
      const f = state().meta.extras.fodec || (state().meta.extras.fodec = {});
      f.enabled = !!getEl("fodecEnabled").checked;
      SEM.toggleFodecFields(f.enabled);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("fodecLabel")?.addEventListener("input", () => { state().meta.extras.fodec.label = getStr("fodecLabel", state().meta.extras.fodec.label || "FODEC"); SEM.updateExtrasMiniRows(); });
    getEl("fodecRate")?.addEventListener("input", () => { state().meta.extras.fodec.rate = getNum("fodecRate", state().meta.extras.fodec.rate ?? 1); SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview(); });
    getEl("fodecBase")?.addEventListener("change", () => { state().meta.extras.fodec.base = getStr("fodecBase", state().meta.extras.fodec.base || "ht"); SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview(); });
    getEl("fodecTva")?.addEventListener("input", () => { state().meta.extras.fodec.tva = getNum("fodecTva", state().meta.extras.fodec.tva ?? 19); SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview(); });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { SEM.updateClientIdPlaceholder(); forceExtrasVisibility(); }, { once: true });
  } else {
    SEM.updateClientIdPlaceholder(); forceExtrasVisibility();
  }
})(window);

