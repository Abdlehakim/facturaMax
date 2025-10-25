// createInvoice/app-bindings-CreateInvoice.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  const state = () => SEM.state;

  // ===== Cachet (SEAL) helpers =====
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
    if (seal.enabled && seal.image) {
      img.src = seal.image;
      wrap.style.display = "";
    } else {
      img.src = "";
      wrap.style.display = "none";
    }
  };

  SEM.setSealImage = function (dataUrl) {
    const st = state();
    st.company = st.company || {};
    st.company.seal = st.company.seal || {
      enabled: false,
      image: "",
      maxWidthMm: 38,
      maxHeightMm: 38,
      opacity: 0.88,
      rotateDeg: -2
    };
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
      if (!w.pdfjsLib) {
        await showDialog(
          "Impossible de lire le PDF sans pdf.js. Veuillez l’installer/charger localement, ou joignez une image.",
          { title: "Cachet PDF" }
        );
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/png", 0.92);
        SEM.setSealImage(dataUrl);
      } catch {
        await showDialog(
          "Échec du chargement du PDF. Essayez un autre fichier ou convertissez-le en image.",
          { title: "Cachet PDF" }
        );
      }
      return;
    }
    await showDialog("Format de fichier non supporté. Joignez une image ou un PDF.", { title: "Cachet" });
  };

  // ===== Client ID placeholder =====
  SEM.updateClientIdPlaceholder = function () {
    const typeSel = getEl("clientType");
    const type = (typeSel?.value || state().client?.type || "societe").toLowerCase();
    const idInput = getEl("clientVat");
    if (!idInput) return;
    idInput.placeholder = type === "particulier" ? "CIN ou Passeport" : "XXXXXXXXX";
  };

  // ===== Toggle blocks =====
  SEM.toggleWHFields = function (enabled) {
    const fields = getEl("whFields"); if (fields) fields.style.display = enabled ? "" : "none";
    const r1 = getEl("miniWHRow"); const r2 = getEl("miniNETRow");
    if (r1) r1.style.display = enabled ? "" : "none";
    if (r2) r2.style.display = enabled ? "" : "none";
  };
  SEM.toggleShipFields = function (enabled) {
    const f = getEl("shipFields"); if (f) f.style.display = enabled ? "" : "none";
    const r = getEl("miniShipRow"); if (r) r.style.display = enabled ? "" : "none";
  };
  SEM.toggleStampFields = function (enabled) {
    const f = getEl("stampFields"); if (f) f.style.display = enabled ? "" : "none";
    const r = getEl("miniStampRow"); if (r) r.style.display = enabled ? "" : "none";
  };
  SEM.toggleFodecFields = function (enabled) {
    const f = getEl("fodecFields"); if (f) f.style.display = enabled ? "" : "none";
    const r = getEl("miniFODECRow"); if (r) r.style.display = enabled ? "" : "none";
  };

  // ===== Mini summary =====
  SEM.updateWHAmountPreview = function () {
    const { whAmount } = SEM.computeTotalsReturn();
    setVal("whAmount", formatMoney(whAmount, state().meta.currency || "TND"));
    const lbl = state().meta.withholding?.label?.trim() || "Retenue à la source";
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
    const rateStr = (Number.isInteger(Math.abs(fRate)) ? String(Math.abs(fRate))
      : String(Math.abs(fRate)).replace(/\.?0+$/, "")) + "%";
    const miniRow = getEl("miniFODECRow");
    const miniLbl = getEl("miniFODECLabel");
    const miniVal = getEl("miniFODEC");
    if (miniRow) miniRow.style.display = fEnabled ? "" : "none";
    if (miniLbl) miniLbl.textContent = fEnabled ? `${fLabel} (${rateStr})` : fLabel;
    if (miniVal) miniVal.textContent = formatMoney(fodecHT, cur);

    const fodecAuto = getEl("fodecAmount");
    if (fodecAuto) fodecAuto.value = fEnabled ? formatMoney(fodecHT, cur) : "";
  };

  // ===== Bind form from state =====
  SEM.bind = function () {
    const st = state();
    st.items = Array.isArray(st.items) ? st.items : [];

    [["companyName","name"],["companyVat","vat"],["companyPhone","phone"],["companyEmail","email"],["companyAddress","address"]]
      .forEach(([id, key]) => {
        const el = getEl(id); if (!el) return;
        el.value = st.company[key] || "";
        if (SEM.COMPANY_LOCKED) { el.readOnly = true; el.classList.add("locked"); el.setAttribute("tabindex", "-1"); }
      });

    const seal = st.company?.seal || {};
    const sealCb = getEl("sealEnabled");
    if (sealCb) sealCb.checked = !!seal.enabled;
    SEM.toggleSealFields(!!seal.enabled);
    SEM.refreshSealPreview();

    setVal("docType",  st.meta.docType || "facture");
    setVal("invNumber", st.meta.number);
    setVal("currency",  st.meta.currency);
    setVal("invDate",   st.meta.date);
    setVal("invDue",    st.meta.due);

    setVal("clientType",    st.client.type || "societe");
    setVal("clientName",    st.client.name);
    setVal("clientEmail",   st.client.email);
    setVal("clientPhone",   st.client.phone);
    setVal("clientVat",     st.client.vat);
    setVal("clientAddress", st.client.address);

    const wh = st.meta.withholding || { enabled:false, rate:1.5, base:"ht", label:"Retenue à la source", threshold:1000 };
    if (getEl("whEnabled")) getEl("whEnabled").checked = !!wh.enabled;
    setVal("whRate",  String(wh.rate ?? 1.5));
    setVal("whBase",  String(wh.base ?? "ht"));
    setVal("whLabel", String(wh.label ?? "Retenue à la source"));
    setVal("whThreshold", String(wh.threshold ?? 0));
    SEM.toggleWHFields(!!wh.enabled);

    const ex = st.meta.extras || {};
    const s = ex.shipping || {};
    const t = ex.stamp || {};
    const f = ex.fodec || {};

    if (getEl("shipEnabled")) getEl("shipEnabled").checked = !!s.enabled;
    setVal("shipLabel",  String(s.label ?? "Frais de livraison"));
    setVal("shipAmount", String(s.amount ?? 7));
    setVal("shipTva",    String(s.tva ?? 19));
    SEM.toggleShipFields(!!s.enabled);

    if (getEl("stampEnabled")) getEl("stampEnabled").checked = !!t.enabled;
    setVal("stampLabel",  String(t.label ?? "Timbre fiscal"));
    setVal("stampAmount", String(t.amount ?? 1));
    setVal("stampTva",    String(t.tva ?? 0));
    SEM.toggleStampFields(!!t.enabled);

    if (getEl("fodecEnabled")) getEl("fodecEnabled").checked = !!f.enabled;
    setVal("fodecLabel", String(f.label ?? "FODEC"));
    setVal("fodecRate",  String(f.rate  ?? 1));
    setVal("fodecBase",  String(f.base  ?? "ht"));
    setVal("fodecTva",   String(f.tva   ?? 19));
    SEM.toggleFodecFields(!!f.enabled);

    const bundled = "./assets/logoIMG.png";
    const logo = w.SoukElMeuble?.assets?.logo || st.company.logo || bundled;
    setSrc("companyLogo", logo);
    if (!st.company.logo) st.company.logo = bundled;

    setVal("notes", st.notes);
    setText("year", new Date().getFullYear());

    // ensure all toggles default to checked
    ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"]
      .forEach(id => { const el = getEl(id); if (el && el.checked === false) el.checked = true; });

    SEM.renderItems();
    SEM.computeTotals();
    SEM.applyColumnHiding();
    SEM.updateWHAmountPreview();
    SEM.updateExtrasMiniRows();
    SEM.updateClientIdPlaceholder();
  };

  // ===== Totals =====
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
      const lbl = wh.label?.trim() || "Retenue à la source";
      setText("miniWHLabel", lbl);
      setText("miniWH", "- " + formatMoney(totals.whAmount, currency));
      setText("miniNET", formatMoney(totals.net, currency));
    }

    const fodecAuto = getEl("fodecAmount");
    const fodecEnabled = !!state().meta.extras?.fodec?.enabled;
    if (fodecAuto) fodecAuto.value = fodecEnabled ? formatMoney(totals.extras.fodecHT, currency) : "";

    SEM.updateExtrasMiniRows();
  };

  // ===== Add/Edit items =====
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
    if (mode === "update") {
      submitBtn.textContent = "Mettre à jour";
      submitBtn.dataset.mode = "update";
      newBtn.disabled = false;
    } else {
      submitBtn.textContent = "+ Ajouter";
      submitBtn.dataset.mode = "add";
      newBtn.disabled = true;
    }
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
    if (mode === "update" && SEM.selectedItemIndex !== null) {
      state().items[SEM.selectedItemIndex] = item;
    } else {
      state().items.push(item);
    }
    SEM.renderItems();
    SEM.clearAddFormAndMode();
  };

  // ===== Render table =====
  SEM.renderItems = function () {
    const body = getEl("itemBody"); if (!body) return;
    body.innerHTML = "";
    const currency = state().meta.currency || "TND";

    const items = state().items || [];
    if (items.length === 0) {
      const tr = document.createElement("tr");
      tr.className = "demo-row";
      tr.innerHTML = `
        <td style="color:#64748b;">EX-001</td>
        <td style="color:#64748b;">Chaise (exemple)</td>
        <td style="color:#64748b;">Ligne de démonstration — ajoutez votre premier article.</td>
        <td class="right" style="color:#64748b;">1</td>
        <td class="right" style="color:#64748b;">${formatMoney(100, currency)}</td>
        <td class="right" style="color:#64748b;">${formatPct(19)}</td>
        <td class="right" style="color:#64748b;">${formatPct(0)}</td>
        <td class="right" style="color:#64748b;">${formatMoney(119, currency)}</td>
        <td class="add-actions" style="color:#64748b;">—</td>`;
      body.appendChild(tr);

      SEM.computeTotals();
      SEM.applyColumnHiding();
      SEM.updateWHAmountPreview();
      SEM.updateExtrasMiniRows();
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
          <button class="btn tiny sel" data-sel="${i}">Éditer</button>
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

  // ===== Column visibility =====
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

  // Hide/show full field blocks in “Ajouter un article”
  function setAddInputVisibility({ ref, product, desc, qty, price, tva, discount }) {
    const bySel = [
      [".field-ref",      ref],
      [".field-product",  product],
      [".field-desc",     desc],
      [".field-qty",      qty],
      [".field-price",    price],
      [".field-tva",      tva],
      [".field-discount", discount],
    ];
    bySel.forEach(([sel, vis]) => {
      document.querySelectorAll(sel).forEach(node => {
        node.style.display = vis ? "" : "none";
      });
    });
  }

  SEM.applyColumnHiding = function () {
    const refVis      = !!getEl('colToggleRef')?.checked;
    const productVis  = !!getEl('colToggleProduct')?.checked;
    const descVis     = !!getEl('colToggleDesc')?.checked;
    const qtyVis      = !!getEl('colToggleQty')?.checked;
    const priceVis    = !!getEl('colTogglePrice')?.checked;
    const tvaVis      = !!getEl('colToggleTva')?.checked;
    const discountVis = !!getEl('colToggleDiscount')?.checked;

    // classes used by your CSS rules (.hide-col-*)
    document.body.classList.toggle('hide-col-ref',      !refVis);
    document.body.classList.toggle('hide-col-product',  !productVis);
    document.body.classList.toggle('hide-col-desc',     !descVis);
    document.body.classList.toggle('hide-col-qty',      !qtyVis);
    document.body.classList.toggle('hide-col-price',    !priceVis);
    document.body.classList.toggle('hide-col-tva',      !tvaVis);
    document.body.classList.toggle('hide-col-discount', !discountVis);

    // hide Total TTC column if price hidden (keeps layout consistent)
    document.body.classList.toggle('hide-col-ttc', !priceVis);

    // table cells/headers (8th = Total TTC) – keep TTC aligned to price visibility
    const itemsTable = getEl('items');
    setColumnVisibility(itemsTable, 8, priceVis);

    // mini summary follows price visibility
    const mini = document.querySelector('.mini-sum');
    if (mini) mini.style.display = priceVis ? '' : 'none';

    // add-item field blocks
    setAddInputVisibility({
      ref: refVis, product: productVis, desc: descVis,
      qty: qtyVis, price: priceVis, tva: tvaVis, discount: discountVis
    });
  };

  // Exposed helper: initialize and wire the toggle checkboxes
  SEM.wireColumnToggles = function () {
    const ids = ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"];
    // default all checked
    ids.forEach(id => { const el = getEl(id); if (el) el.checked = true; });
    // initial apply
    SEM.applyColumnHiding();
    // listeners
    ids.forEach(id => getEl(id)?.addEventListener("change", () => {
      SEM.applyColumnHiding();
      // re-render bits that depend on visibility (safe no-ops if unchanged)
      SEM.computeTotals();
      SEM.updateWHAmountPreview();
      SEM.updateExtrasMiniRows();
    }));
  };

  // ===== Live wiring =====
  SEM.wireLiveBindings = function () {
    if (!SEM.COMPANY_LOCKED) {
      const map = [
        ["companyName",   v => state().company.name = v],
        ["companyVat",    v => state().company.vat = v],
        ["companyPhone",  v => state().company.phone = v],
        ["companyEmail",  v => state().company.email = v],
        ["companyAddress",v => state().company.address = v],
      ];
      map.forEach(([id, set]) =>
        getEl(id)?.addEventListener("input", () => { set(getStr(id, "")); SEM.saveCompanyToLocal?.(); })
      );
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
        inp.onchange = async () => {
          const f = inp.files && inp.files[0];
          await SEM.loadSealFromFile(f);
        };
        inp.click();
      });
    }

    getEl("docType") ?.addEventListener("change", () => { state().meta.docType  = getStr("docType",  state().meta.docType); });
    getEl("invNumber")?.addEventListener("input",  () => { state().meta.number  = getStr("invNumber",state().meta.number); });
    getEl("invDate")  ?.addEventListener("input",  () => { state().meta.date    = getStr("invDate",  state().meta.date); });
    getEl("invDue")   ?.addEventListener("input",  () => { state().meta.due     = getStr("invDue",   state().meta.due); });
    getEl("currency") ?.addEventListener("change", () => {
      state().meta.currency = getStr("currency", state().meta.currency);
      SEM.renderItems(); SEM.computeTotals(); SEM.updateWHAmountPreview(); SEM.updateExtrasMiniRows();
    });

    document.addEventListener("change", (e) => {
      if ((e.target)?.id === "clientType") {
        state().client.type = getStr("clientType", state().client.type || "societe");
        SEM.updateClientIdPlaceholder();
      }
    });
    document.addEventListener("input", (e) => {
      if ((e.target)?.id === "clientType") {
        state().client.type = getStr("clientType", state().client.type || "societe");
        SEM.updateClientIdPlaceholder();
      }
    });

    getEl("clientName")   ?.addEventListener("input", () => { state().client.name    = getStr("clientName",    state().client.name); });
    getEl("clientEmail")  ?.addEventListener("input", () => { state().client.email   = getStr("clientEmail",   state().client.email); });
    getEl("clientPhone")  ?.addEventListener("input", () => { state().client.phone   = getStr("clientPhone",   state().client.phone); });
    getEl("clientVat")    ?.addEventListener("input", () => { state().client.vat     = getStr("clientVat",     state().client.vat); });
    getEl("clientAddress")?.addEventListener("input", () => { state().client.address = getStr("clientAddress", state().client.address); });
    getEl("notes")?.addEventListener("input", () => { state().notes = getStr("notes", state().notes); });

    // Column toggles are also wired by SEM.wireColumnToggles(), but keep this as a backup.
    ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"]
      .forEach(id => getEl(id)?.addEventListener("change", SEM.applyColumnHiding));

    // Withholding
    getEl("whEnabled")?.addEventListener("change", () => {
      state().meta.withholding.enabled = !!getEl("whEnabled").checked;
      SEM.toggleWHFields(state().meta.withholding.enabled);
      SEM.computeTotals();
      SEM.updateWHAmountPreview();
    });
    getEl("whRate")?.addEventListener("input", () => {
      state().meta.withholding.rate = getNum("whRate", state().meta.withholding.rate);
      SEM.computeTotals(); SEM.updateWHAmountPreview();
    });
    getEl("whBase")?.addEventListener("change", () => {
      state().meta.withholding.base = getStr("whBase", state().meta.withholding.base);
      SEM.computeTotals(); SEM.updateWHAmountPreview();
    });
    getEl("whThreshold")?.addEventListener("input", () => {
      state().meta.withholding.threshold = getNum("whThreshold", state().meta.withholding.threshold ?? 0);
      SEM.computeTotals(); SEM.updateWHAmountPreview();
    });
    getEl("whLabel")?.addEventListener("input", () => {
      state().meta.withholding.label = getStr("whLabel", state().meta.withholding.label);
      SEM.updateWHAmountPreview();
    });

    // Shipping
    getEl("shipEnabled")?.addEventListener("change", () => {
      state().meta.extras.shipping.enabled = !!getEl("shipEnabled").checked;
      SEM.toggleShipFields(state().meta.extras.shipping.enabled);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("shipLabel")?.addEventListener("input", () => {
      state().meta.extras.shipping.label = getStr("shipLabel", state().meta.extras.shipping.label);
      SEM.updateExtrasMiniRows();
    });
    getEl("shipAmount")?.addEventListener("input", () => {
      state().meta.extras.shipping.amount = getNum("shipAmount", state().meta.extras.shipping.amount);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("shipTva")?.addEventListener("input", () => {
      state().meta.extras.shipping.tva = getNum("shipTva", state().meta.extras.shipping.tva);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });

    // Stamp
    getEl("stampEnabled")?.addEventListener("change", () => {
      state().meta.extras.stamp.enabled = !!getEl("stampEnabled").checked;
      SEM.toggleStampFields(state().meta.extras.stamp.enabled);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("stampLabel")?.addEventListener("input", () => {
      state().meta.extras.stamp.label = getStr("stampLabel", state().meta.extras.stamp.label);
      SEM.updateExtrasMiniRows();
    });
    getEl("stampAmount")?.addEventListener("input", () => {
      state().meta.extras.stamp.amount = getNum("stampAmount", state().meta.extras.stamp.amount);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("stampTva")?.addEventListener("input", () => {
      state().meta.extras.stamp.tva = getNum("stampTva", state().meta.extras.stamp.tva);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });

    // FODEC
    getEl("fodecEnabled")?.addEventListener("change", () => {
      const f = state().meta.extras.fodec || (state().meta.extras.fodec = {});
      f.enabled = !!getEl("fodecEnabled").checked;
      SEM.toggleFodecFields(f.enabled);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("fodecLabel")?.addEventListener("input", () => {
      state().meta.extras.fodec.label = getStr("fodecLabel", state().meta.extras.fodec.label || "FODEC");
      SEM.updateExtrasMiniRows();
    });
    getEl("fodecRate")?.addEventListener("input", () => {
      state().meta.extras.fodec.rate = getNum("fodecRate", state().meta.extras.fodec.rate ?? 1);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("fodecBase")?.addEventListener("change", () => {
      state().meta.extras.fodec.base = getStr("fodecBase", state().meta.extras.fodec.base || "ht");
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
    getEl("fodecTva")?.addEventListener("input", () => {
      state().meta.extras.fodec.tva = getNum("fodecTva", state().meta.extras.fodec.tva ?? 19);
      SEM.computeTotals(); SEM.updateExtrasMiniRows(); SEM.updateWHAmountPreview();
    });
  };

  // Placeholder init for the placeholder text
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      SEM.updateClientIdPlaceholder();
    }, { once: true });
  } else {
    SEM.updateClientIdPlaceholder();
  }
})(window);
