// createInvoice/app-state-CreateInvoice.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  const IS_DESKTOP = !!(w.SoukElMeuble && (w.SoukElMeuble.isDesktop ?? true));

  const getEl  = w.getEl  || ((id) => document.getElementById(id));
  const setVal = w.setVal || ((id, v) => { const el = getEl(id); if (el) el.value = v; });
  const getStr = w.getStr || ((id, def = "") => { const el = getEl(id); return el ? String(el.value ?? "").trim() : def; });
  const getNum = w.getNum || ((id, def = 0) => {
    const el = getEl(id); if (!el) return def;
    const raw = String(el.value ?? "").replace(",", ".").trim();
    const n = Number(raw); return Number.isFinite(n) ? n : def;
  });

  const round3 = (x) => Math.round((Number(x) + Number.EPSILON) * 1000) / 1000;
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const plusDaysISO = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

  const fmt3 = (v) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v) || 0);
  const fmtMoney = (cur, v) => `${cur} ${fmt3(v)}`;

  SEM.state = SEM.state || {};
  SEM.state.company = SEM.state.company || {
    name: "SoukElMeuble",
    vat: "1891628/W/A/M/000",
    phone: "+216 27 673 561",
    email: "contact@SoukElMeuble.com",
    address: "Rue Mahbouba Soussia 2080 Teboulba",
    logo: "",
    seal: { enabled: false, image: "", maxWidthMm: 38, maxHeightMm: 38, opacity: 0.88, rotateDeg: -2 }
  };
  SEM.state.client = SEM.state.client || { type: "societe", name: "", email: "", phone: "", address: "", vat: "" };
  SEM.state.meta = SEM.state.meta || {
    number: "",
    currency: "TND",
    date: todayISO(),
    due: plusDaysISO(7),
    docType: "facture",
    withholding: { enabled: false, rate: 1.5, base: "ht", label: "Retenue à la source", threshold: 1000 },
    extras: {
      shipping: { enabled: false, label: "Frais de livraison", amount: 7, tva: 19 },
      stamp:    { enabled: false, label: "Timbre fiscal", amount: 1, tva: 0 },
      fodec:    { enabled: false, label: "FODEC", rate: 1, base: "ht", tva: 19, amount: 0, tvaAmount: 0 }
    }
  };
  SEM.state.notes = SEM.state.notes || "";

  // One demo line if empty
  SEM.state.items = Array.isArray(SEM.state.items) && SEM.state.items.length
    ? SEM.state.items
    : [{ ref: "SKU-001", product: "Ordinateur portable", desc: "Garantie 2 ans", qty: 1, price: 1000, tva: 19, discount: 0 }];

  SEM.COMPANY_LOCKED = true;
  SEM.selectedItemIndex = null;
  SEM.IS_DESKTOP = IS_DESKTOP;
  SEM.IS_WEB = !IS_DESKTOP;

  // ---- helper to guarantee a seed row for first render ----
  SEM.ensureItemsSeed = function () {
    if (!Array.isArray(SEM.state.items) || SEM.state.items.length === 0) {
      SEM.newInvoice?.();
    }
  };

  // =================== Totals ===================
  SEM.computeTotalsReturn = function () {
    const st = SEM.state;
    const items = Array.isArray(st.items) ? st.items : [];

    let htLines = 0;
    let tvaLines = 0;
    for (const it of items) {
      const qty = n(it.qty);
      const pht = n(it.price);
      const disc = n(it.discount) / 100;
      const t = n(it.tva) / 100;
      const base = qty * pht * (1 - disc);
      htLines  += base;
      tvaLines += base * t;
    }
    htLines = round3(htLines);
    tvaLines = round3(tvaLines);

    const ex = st.meta.extras = (st.meta.extras || {});
    const ship  = ex.shipping = (ex.shipping || {});
    const stamp = ex.stamp    = (ex.stamp || {});
    const fodec = ex.fodec    = (ex.fodec || {});

    const shipHT  = ship.enabled ? n(ship.amount) : 0;
    const shipTVA = ship.enabled ? round3(shipHT * (n(ship.tva)/100)) : 0;

    const stampHT  = stamp.enabled ? n(stamp.amount) : 0;
    const stampTVA = stamp.enabled ? round3(stampHT * (n(stamp.tva)/100)) : 0;

    const fEnabled = !!fodec.enabled;
    const fRate  = n(fodec.rate)/100;
    const fTvaR  = n(fodec.tva)/100;
    const baseSel = String(fodec.base || "ht").toLowerCase();

    let baseForFODEC = 0;
    if (baseSel === "ht") baseForFODEC = htLines;
    else if (baseSel === "ht_plus") baseForFODEC = htLines + shipHT;
    else baseForFODEC = htLines + tvaLines + shipHT + shipTVA + stampHT + stampTVA;

    const fodecHT   = fEnabled ? round3(baseForFODEC * fRate) : 0;
    const fodecTVA  = fEnabled ? round3(fodecHT * fTvaR)     : 0;

    fodec.amount    = fodecHT;
    fodec.tvaAmount = fodecTVA;

    const totalHT = round3(htLines + shipHT + fodecHT);
    const tax     = round3(tvaLines + shipTVA + stampTVA + fodecTVA);
    const totalTTC= round3(totalHT + tax + stampHT);

    const wh = st.meta.withholding || {};
    let whAmount = 0, net = totalTTC;
    if (wh.enabled) {
      const base = (wh.base === "ttc") ? totalTTC : (htLines + shipHT + fodecHT);
      const threshold = n(wh.threshold);
      if (base > threshold) {
        whAmount = round3(base * (n(wh.rate)/100));
        net = round3(totalTTC - whAmount);
      }
    }

    return {
      currency: st.meta.currency || "TND",
      subtotal: htLines,
      discount: 0,
      tax,
      totalHT,
      totalTTC,
      grand: totalTTC,
      whAmount,
      net,
      extras: {
        shipHT, shipTVA, shipTT: round3(shipHT + shipTVA),
        stampHT, stampTVA, stampTT: round3(stampHT + stampTVA),
        fodecHT, fodecTVA, fodecTT: round3(fodecHT + fodecTVA)
      }
    };
  };

  // =================== Read inputs back into state ===================
  SEM.readInputs = function () {
    const st = SEM.state;

    if (!SEM.COMPANY_LOCKED) {
      st.company.name    = getStr("companyName", st.company.name);
      st.company.vat     = getStr("companyVat", st.company.vat);
      st.company.phone   = getStr("companyPhone", st.company.phone);
      st.company.email   = getStr("companyEmail", st.company.email);
      st.company.address = getStr("companyAddress", st.company.address);
    }
    const sealCb = getEl("sealEnabled");
    st.company.seal = st.company.seal || {};
    if (sealCb) st.company.seal.enabled = !!sealCb.checked;

    st.meta.docType  = getStr("docType", st.meta.docType) || st.meta.docType;
    st.meta.number   = getStr("invNumber", st.meta.number);
    st.meta.currency = getStr("currency", st.meta.currency) || st.meta.currency;
    st.meta.date     = getStr("invDate", st.meta.date);
    st.meta.due      = getStr("invDue", st.meta.due);

    st.client.type    = getStr("clientType", st.client.type || "societe");
    st.client.name    = getStr("clientName", st.client.name);
    st.client.email   = getStr("clientEmail", st.client.email);
    st.client.phone   = getStr("clientPhone", st.client.phone);
    st.client.vat     = getStr("clientVat", st.client.vat);
    st.client.address = getStr("clientAddress", st.client.address);

    const wh = st.meta.withholding || (st.meta.withholding = { enabled:false, rate:1.5, base:"ht", label:"Retenue à la source", threshold:1000 });
    wh.enabled   = !!getEl("whEnabled")?.checked;
    wh.rate      = getNum("whRate", wh.rate);
    wh.base      = getStr("whBase", wh.base);
    wh.label     = getStr("whLabel", wh.label);
    wh.threshold = getNum("whThreshold", wh.threshold ?? 0);

    const ex = st.meta.extras || (st.meta.extras = { shipping:{}, stamp:{}, fodec:{} });
    const s = ex.shipping || (ex.shipping = {});
    const t = ex.stamp    || (ex.stamp = {});
    const f = ex.fodec    || (ex.fodec = {});

    s.enabled = !!getEl("shipEnabled")?.checked;
    s.label   = getStr("shipLabel", s.label || "Frais de livraison");
    s.amount  = getNum("shipAmount", s.amount ?? 7);
    s.tva     = getNum("shipTva", s.tva ?? 19);

    t.enabled = !!getEl("stampEnabled")?.checked;
    t.label   = getStr("stampLabel", t.label || "Timbre fiscal");
    t.amount  = getNum("stampAmount", t.amount ?? 1);
    t.tva     = getNum("stampTva", t.tva ?? 0);

    f.enabled = !!getEl("fodecEnabled")?.checked;
    f.label   = getStr("fodecLabel", f.label || "FODEC");
    f.rate    = getNum("fodecRate", f.rate ?? 1);
    f.base    = getStr("fodecBase", f.base || "ht");
    f.tva     = getNum("fodecTva",  f.tva ?? 19);
  };

  SEM.captureForm = function (opts = {}) {
    const { includeCompany = true } = opts;
    SEM.readInputs();
    const st = SEM.state;
    return {
      ...(includeCompany ? { company: { ...st.company } } : {}),
      client: { ...st.client },
      meta:   { ...st.meta },
      notes:  st.notes,
      items:  (st.items || []).map(x => ({ ...x })),
      totals: SEM.computeTotalsReturn(),
      _schemaVersion: 1
    };
  };

  SEM.newInvoice = function () {
    const st = SEM.state;
    st.client = { type:"societe", name:"", email:"", phone:"", address:"", vat:"" };
    st.meta.number = "";
    st.meta.date = todayISO();
    st.meta.due  = plusDaysISO(7);
    st.meta.docType = "facture";
    st.meta.withholding = { enabled:false, rate:1.5, base:"ht", label:"Retenue à la source", threshold:1000 };
    st.meta.extras = {
      shipping: { enabled: false, label: "Frais de livraison", amount: 7, tva: 19 },
      stamp:    { enabled: false, label: "Timbre fiscal", amount: 1, tva: 0 },
      fodec:    { enabled: false, label: "FODEC", rate: 1, base: "ht", tva: 19, amount: 0, tvaAmount: 0 }
    };
    st.notes = "";
    st.items = [
      { ref: "SKU-001", product: "Ordinateur portable", desc: "Garantie 2 ans", qty: 1, price: 1000, tva: 19, discount: 0 }
    ];
  };

  // ============== Optional simple renderer (fallback) ==============
  function renderInputsFromState() {
    const st = SEM.state;

    setVal("companyName",   st.company.name);
    setVal("companyVat",    st.company.vat);
    setVal("companyPhone",  st.company.phone);
    setVal("companyEmail",  st.company.email);
    setVal("companyAddress",st.company.address);

    const sealCb = getEl("sealEnabled"); if (sealCb) sealCb.checked = !!st.company.seal?.enabled;

    setVal("docType",   st.meta.docType);
    setVal("invNumber", st.meta.number);
    setVal("currency",  st.meta.currency);
    setVal("invDate",   st.meta.date);
    if (getEl("invDue")) setVal("invDue", st.meta.due);

    setVal("clientType",  st.client.type || "societe");
    setVal("clientName",  st.client.name || "");
    setVal("clientEmail", st.client.email || "");
    setVal("clientPhone", st.client.phone || "");
    setVal("clientVat",   st.client.vat || "");
    setVal("clientAddress", st.client.address || "");

    const wh = st.meta.withholding || {};
    const whCb = getEl("whEnabled"); if (whCb) whCb.checked = !!wh.enabled;
    setVal("whRate",       wh.rate ?? 1.5);
    setVal("whBase",       wh.base || "ht");
    setVal("whLabel",      wh.label || "Retenue à la source");
    setVal("whThreshold",  wh.threshold ?? 0);

    const ex = st.meta.extras || {};
    const s = ex.shipping || {};
    const t = ex.stamp || {};
    const f = ex.fodec || {};

    if (getEl("shipEnabled")) getEl("shipEnabled").checked = !!s.enabled;
    setVal("shipLabel",  s.label  ?? "Frais de livraison");
    setVal("shipAmount", s.amount ?? 7);
    setVal("shipTva",    s.tva    ?? 19);

    if (getEl("stampEnabled")) getEl("stampEnabled").checked = !!t.enabled;
    setVal("stampLabel",  t.label  ?? "Timbre fiscal");
    setVal("stampAmount", t.amount ?? 1);
    setVal("stampTva",    t.tva    ?? 0);

    if (getEl("fodecEnabled")) getEl("fodecEnabled").checked = !!f.enabled;
    setVal("fodecLabel", f.label ?? "FODEC");
    setVal("fodecRate",  f.rate  ?? 1);
    setVal("fodecBase",  f.base  || "ht");
    setVal("fodecTva",   f.tva   ?? 19);

    setVal("notes", st.notes || "");
  }

  function renderItemsTable() {
    const st = SEM.state;
    const tbody = document.getElementById("itemBody");
    if (!tbody) return;

    if (!Array.isArray(st.items) || !st.items.length) {
      st.items = [{ ref: "SKU-001", product: "Ordinateur portable", desc: "Garantie 2 ans", qty: 1, price: 1000, tva: 19, discount: 0 }];
    }

    let html = "";
    const cur = st.meta.currency || "TND";

    st.items.forEach((it, idx) => {
      const qty = n(it.qty);
      const pht = n(it.price);
      const disc = n(it.discount) / 100;
      const t = n(it.tva) / 100;
      const base = qty * pht * (1 - disc);
      const lineTTC = round3(base * (1 + t));

      html += `
        <tr data-index="${idx}">
          <td>${it.ref ?? ""}</td>
          <td>${it.product ?? ""}</td>
          <td>${it.desc ?? ""}</td>
          <td>${qty}</td>
          <td>${fmtMoney(cur, pht)}</td>
          <td>${n(it.tva)}</td>
          <td>${n(it.discount)}</td>
          <td>${fmtMoney(cur, lineTTC)}</td>
          <td>
            <button class="btn btn-light" data-action="edit">Éditer</button>
            <button class="del" data-action="delete">Supprimer</button>
          </td>
        </tr>`;
    });

    tbody.innerHTML = html;
  }

  function renderMiniSummary() {
    const t = SEM.computeTotalsReturn();
    const cur = t.currency || "TND";

    const setTxt = (id, val) => { const el = getEl(id); if (el) el.textContent = val; };

    setTxt("miniHT",  fmtMoney(cur, t.totalHT));
    setTxt("miniTVA", fmtMoney(cur, t.tax));
    setTxt("miniTTC", fmtMoney(cur, t.totalTTC));

    const shipRow  = getEl("miniShipRow");
    const stampRow = getEl("miniStampRow");
    const fodecRow = getEl("miniFODECRow");
    const whRow    = getEl("miniWHRow");
    const netRow   = getEl("miniNETRow");

    if (shipRow)  shipRow.style.display  = t.extras.shipHT  ? "" : "none";
    if (stampRow) stampRow.style.display = t.extras.stampHT ? "" : "none";
    if (fodecRow) fodecRow.style.display = t.extras.fodecHT ? "" : "none";

    setTxt("miniShip",  fmtMoney(cur, t.extras.shipHT));
    setTxt("miniStamp", fmtMoney(cur, t.extras.stampHT));
    setTxt("miniFODEC", fmtMoney(cur, t.extras.fodecHT));

    if (t.whAmount && t.whAmount > 0) {
      if (whRow)  whRow.style.display  = "";
      if (netRow) netRow.style.display = "";
      setTxt("miniWH",  fmtMoney(cur, t.whAmount));
      setTxt("miniNET", fmtMoney(cur, t.net));
    } else {
      if (whRow)  whRow.style.display  = "none";
      if (netRow) netRow.style.display = "none";
    }
  }

  // Public bind: populate inputs + table + mini-sum (fallback renderer)
  SEM.bind = function () {
    renderInputsFromState();
    renderItemsTable();
    renderMiniSummary();
  };

  // Column hiding hook (no-op here; wired in bindings file)
  SEM.applyColumnHiding = SEM.applyColumnHiding || function () {};
})(window);
