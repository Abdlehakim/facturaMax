// ───────── app-state.js ─────────
(function (w) {
  const SEM = (w.SEM = w.SEM || {});

  SEM.state = {
    company: {
      name: "SoukElMeuble",
      vat: "1891628/W/A/M/000",
      phone: "+216 27 673 561",
      email: "contact@SoukElMeuble.com",
      address: "Rue Mahbouba Soussia 2080 Teboulba",
      logo: "",
      // Unified seal structure
      seal: {
        enabled: false,
        image: "",        // data URL
        maxWidthMm: 38,
        maxHeightMm: 38,
        opacity: 0.88,
        rotateDeg: -2
      }
    },
    client: { type: "societe", name: "", email: "", phone: "", address: "", vat: "" },
    meta: {
      number: "",
      currency: "TND",
      date: new Date().toISOString().slice(0, 10),
      due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      docType: "facture",
      withholding: { enabled: false, rate: 1.5, base: "ht", label: "Retenue à la source", threshold: 1000 },
      extras: {
        shipping: { enabled: false, label: "Frais de livraison", amount: 7, tva: 19 },
        stamp:    { enabled: false, label: "Timbre fiscal", amount: 1, tva: 0 },
        fodec:    { enabled: false, label: "FODEC", rate: 1, base: "ht", tva: 19 }
      }
    },
    notes: "",
    items: []
  };

  SEM.COMPANY_LOCKED = true;
  SEM.selectedItemIndex = null;
  SEM.IS_DESKTOP = !!(w.SoukElMeuble && typeof w.SoukElMeuble.openPath === "function");
  SEM.IS_WEB = !SEM.IS_DESKTOP;

  SEM.saveCompanyToLocal = function () {
    if (SEM.COMPANY_LOCKED) return;
    try { localStorage.setItem("swb_company", JSON.stringify(SEM.state.company)); } catch {}
  };

  SEM.loadCompanyFromLocal = function () {
    if (SEM.COMPANY_LOCKED) return;
    try {
      const c = JSON.parse(localStorage.getItem("swb_company") || "null");
      if (c) SEM.state.company = { ...SEM.state.company, ...c };
    } catch {}
  };

  SEM.computeTotalsReturn = function () {
    const st = SEM.state;
    const currency = st.meta.currency || "TND";

    let subtotal = 0, totalTax = 0, totalDiscount = 0;
    st.items.forEach((it) => {
      const base = Number(it.qty || 0) * Number(it.price || 0);
      const disc = base * (Number(it.discount || 0) / 100);
      const taxedBase = Math.max(0, base - disc);
      const tax = taxedBase * (Number(it.tva || 0) / 100);
      subtotal += base; totalDiscount += disc; totalTax += tax;
    });

    const totalHT_items = subtotal - totalDiscount;

    const ex = st.meta.extras || {};
    const shipHT  = (ex.shipping?.enabled) ? Number(ex.shipping.amount || 0) : 0;
    const shipTVA = shipHT * (Number(ex.shipping?.tva || 0) / 100);
    const shipTT  = shipHT + shipTVA;

    const stampHT = (ex.stamp?.enabled) ? Number(ex.stamp.amount || 0) : 0;
    const stampTVA = stampHT * (Number(ex.stamp?.tva || 0) / 100);
    const stampTT = stampHT + stampTVA;

    const f = ex.fodec || {};
    const fEnabled = !!f.enabled;
    const fRate = Number(f.rate || 0);
    const fBaseSel = String(f.base || "ht").toLowerCase();
    const fTvaRate = Number(f.tva || 0);

    const baseHT_simple = totalHT_items;
    const baseHT_plus = totalHT_items + shipHT;
    const baseTTC_sansF = baseHT_plus + totalTax + shipTVA;

    let fodecBase = 0;
    if (fBaseSel === "ht") fodecBase = baseHT_simple;
    else if (fBaseSel === "ht_plus") fodecBase = baseHT_plus;
    else fodecBase = baseTTC_sansF;

    const fodecHT = fEnabled ? (fodecBase * (fRate / 100)) : 0;
    const fodecTVA = fEnabled ? (fodecHT * (fTvaRate / 100)) : 0;
    const fodecTT = fodecHT + fodecTVA;

    const totalHT_display = totalHT_items + shipHT + (fEnabled ? fodecHT : 0);
    const totalTVA_display = totalTax + shipTVA + (fEnabled ? fodecTVA : 0);
    const totalTTC_all = totalHT_display + totalTVA_display + stampTT;

    const rasBaseHT = totalHT_items + shipHT + (fEnabled ? fodecHT : 0);
    const rasBaseTTC = totalTTC_all - stampTT;

    const wh = st.meta.withholding || {};
    const baseVal = (wh.base === "ttc") ? rasBaseTTC : rasBaseHT;
    const threshold = Number(wh.threshold || 0);
    const whAmount = (wh.enabled && baseVal > threshold) ? (Math.max(0, baseVal) * (Number(wh.rate || 0) / 100)) : 0;
    const net = totalTTC_all - whAmount;

    return {
      currency,
      subtotal,
      discount: totalDiscount,
      tax: totalTVA_display,
      totalHT: totalHT_display,
      grand: totalTTC_all,
      totalTTC: totalTTC_all,
      whAmount,
      net,
      extras: {
        shipHT, shipTT, shipTVA,
        stampHT, stampTT, stampTVA,
        fodecHT, fodecTT, fodecTVA
      }
    };
  };

  SEM.readInputs = function () {
    const st = SEM.state;

    if (!SEM.COMPANY_LOCKED) {
      st.company.name    = getStr("companyName", st.company.name);
      st.company.vat     = getStr("companyVat", st.company.vat);
      st.company.phone   = getStr("companyPhone", st.company.phone);
      st.company.email   = getStr("companyEmail", st.company.email);
      st.company.address = getStr("companyAddress", st.company.address);
    }
    // Seal toggle always syncs from UI if present
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
      items:  st.items.map(x => ({ ...x })),
      totals: SEM.computeTotalsReturn(),
      _schemaVersion: 1
    };
  };

  SEM.newInvoice = function () {
    const st = SEM.state;
    st.client = { type:"societe", name:"", email:"", phone:"", address:"", vat:"" };
    st.meta.number = "";
    st.meta.date = new Date().toISOString().slice(0,10);
    st.meta.due  = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    st.meta.withholding = { enabled:false, rate:1.5, base:"ht", label:"Retenue à la source", threshold:1000 };
    st.meta.extras = {
      shipping: { enabled: false, label: "Frais de livraison", amount: 7, tva: 19 },
      stamp:    { enabled:false, label:"Timbre fiscal", amount:1, tva:0 },
      fodec:    { enabled:false, label:"FODEC", rate:1, base:"ht", tva:19 }
    };
    st.notes = "";
    st.items = [];
    // Do not touch st.company or st.company.seal here.
  };

})(window);
