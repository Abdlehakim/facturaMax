
const state = {
  company: { name: "SoukElMeuble", vat: "1891628/W/A/M/000", phone: "+216 27 673 561", email: "contact@SoukElMeuble.com", address: "Rue Mahbouba Soussia 2080 Teboulba", logo: "" },
  client: { type: "societe", name: "", email: "", phone: "", address: "", vat: "" },
  meta: {
    number: "",
    currency: "TND",
    date: new Date().toISOString().slice(0,10),
    due: new Date(Date.now()+7*86400000).toISOString().slice(0,10),
    docType: "facture",
    withholding: { enabled: false, rate: 1.5, base: "ht", label: "Retenue à la source", threshold: 1000 },
    extras: {
      shipping: { enabled:false, label:"Frais de livraison", amount:7, tva:19 },
      stamp:    { enabled:false, label:"Timbre fiscal", amount:1, tva:0 },
      fodec:    { enabled:false, label:"FODEC", rate:1, base:"ht", tva:19 }
    }
  },
  notes: "",
  items: [ { ref: "SKU-001", product: "Ordinateur portable", desc: "Garantie 2 ans", qty: 1, price: 1000, tva: 19, discount: 0 } ],
};

const COMPANY_LOCKED = true;
let selectedItemIndex = null;
const IS_DESKTOP = !!(window.SoukElMeuble && typeof window.SoukElMeuble.openPath === "function");
const IS_WEB = !IS_DESKTOP;

function saveCompanyToLocal(){ if (COMPANY_LOCKED) return; try{ localStorage.setItem("swb_company", JSON.stringify(state.company)); }catch{} }
function loadCompanyFromLocal(){ if (COMPANY_LOCKED) return; try{ const c = JSON.parse(localStorage.getItem("swb_company")||"null"); if(c) state.company = {...state.company, ...c}; }catch{} }

function updateClientIdLabel(){
  const type = state.client?.type === "particulier" ? "particulier" : "societe";
  const labelText = type === "particulier" ? "CIN / passeport" : "Identifiant fiscal / TVA";
  const placeholder = type === "particulier" ? "CIN ou Passeport" : "XXXXXXXXX";
  setText("clientIdLabel", labelText);
  const idInput = getEl("clientVat");
  if (idInput) idInput.placeholder = placeholder;
}

function bind(){
  [["companyName","name"],["companyVat","vat"],["companyPhone","phone"],["companyEmail","email"],["companyAddress","address"]]
    .forEach(([id,key])=>{
      const el = getEl(id); if(!el) return;
      el.value = state.company[key] || "";
      if (COMPANY_LOCKED) { el.readOnly = true; el.classList.add("locked"); el.setAttribute("tabindex","-1"); }
    });

  setVal("docType",  state.meta.docType || "facture");
  setVal("invNumber", state.meta.number);
  setVal("currency",  state.meta.currency);
  setVal("invDate",   state.meta.date);
  setVal("invDue",    state.meta.due);

  setVal("clientType", state.client.type || "societe");
  setVal("clientName", state.client.name);
  setVal("clientEmail", state.client.email);
  setVal("clientPhone", state.client.phone);
  setVal("clientVat", state.client.vat);
  setVal("clientAddress", state.client.address);
  updateClientIdLabel();

  const wh = state.meta.withholding || { enabled:false, rate:1.5, base:"ht", label:"Retenue à la source", threshold:1000 };
  if (getEl("whEnabled")) getEl("whEnabled").checked = !!wh.enabled;
  setVal("whRate",  String(wh.rate ?? 1.5));
  setVal("whBase",  String(wh.base ?? "ht"));
  setVal("whLabel", String(wh.label ?? "Retenue à la source"));
  setVal("whThreshold", String(wh.threshold ?? 0));
  toggleWHFields(!!wh.enabled);

  const ex = state.meta.extras || {};
  const s  = ex.shipping || {};
  const t  = ex.stamp    || {};
  const f  = ex.fodec    || {};
  if (getEl("shipEnabled"))  getEl("shipEnabled").checked = !!s.enabled;
  setVal("shipLabel",  String(s.label ?? "Frais de livraison"));
  setVal("shipAmount", String(s.amount ?? 7));
  setVal("shipTva",    String(s.tva ?? 19));
  toggleShipFields(!!s.enabled);

  if (getEl("stampEnabled")) getEl("stampEnabled").checked = !!t.enabled;
  setVal("stampLabel",  String(t.label ?? "Timbre fiscal"));
  setVal("stampAmount", String(t.amount ?? 1));
  setVal("stampTva",    String(t.tva   ?? 0));
  toggleStampFields(!!t.enabled);

  if (getEl("fodecEnabled")) getEl("fodecEnabled").checked = !!f.enabled;
  setVal("fodecLabel", String(f.label ?? "FODEC"));
  setVal("fodecRate",  String(f.rate  ?? 1));
  setVal("fodecBase",  String(f.base  ?? "ht"));
  setVal("fodecTva",   String(f.tva   ?? 19));
  toggleFodecFields(!!f.enabled);

  const bundled = "./assets/logoIMG.png";
  const logo = window.SoukElMeuble?.assets?.logo || state.company.logo || bundled;
  setSrc("companyLogo", logo);
  if (!state.company.logo) state.company.logo = bundled;

  setVal("notes", state.notes);
  setText("year", new Date().getFullYear());

  ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"]
    .forEach(id => { const el = getEl(id); if (el) el.checked = true; });

  renderItems();
  computeTotals();
  applyColumnHiding();
  updateWHAmountPreview();
  updateExtrasMiniRows();
}

function wireLiveBindings(){
  if (!COMPANY_LOCKED) {
    const map = [
      ["companyName", v => state.company.name = v],
      ["companyVat", v => state.company.vat = v],
      ["companyPhone", v => state.company.phone = v],
      ["companyEmail", v => state.company.email = v],
      ["companyAddress", v => state.company.address = v],
    ];
    map.forEach(([id, set]) => getEl(id)?.addEventListener("input", () => { set(getStr(id, "")); saveCompanyToLocal(); }));
  }

  getEl("docType") ?.addEventListener("change", () => { state.meta.docType = getStr("docType", state.meta.docType); });
  getEl("invNumber")?.addEventListener("input",  () => { state.meta.number  = getStr("invNumber", state.meta.number); });
  getEl("invDate")  ?.addEventListener("input",  () => { state.meta.date    = getStr("invDate",   state.meta.date); });
  getEl("invDue")   ?.addEventListener("input",  () => { state.meta.due     = getStr("invDue",    state.meta.due); });
  getEl("currency") ?.addEventListener("change", () => {
    state.meta.currency = getStr("currency", state.meta.currency);
    renderItems(); computeTotals(); updateWHAmountPreview(); updateExtrasMiniRows();
  });

  getEl("clientType")  ?.addEventListener("change", () => { state.client.type = getStr("clientType", state.client.type || "societe"); updateClientIdLabel(); });
  getEl("clientName")   ?.addEventListener("input", () => { state.client.name    = getStr("clientName",    state.client.name); });
  getEl("clientEmail")  ?.addEventListener("input", () => { state.client.email   = getStr("clientEmail",   state.client.email); });
  getEl("clientPhone")  ?.addEventListener("input", () => { state.client.phone   = getStr("clientPhone",   state.client.phone); });
  getEl("clientVat")    ?.addEventListener("input", () => { state.client.vat     = getStr("clientVat",     state.client.vat); });
  getEl("clientAddress")?.addEventListener("input", () => { state.client.address = getStr("clientAddress", state.client.address); });
  getEl("notes")?.addEventListener("input", () => { state.notes = getStr("notes", state.notes); });

  ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"]
    .forEach(id => getEl(id)?.addEventListener("change", applyColumnHiding));

  getEl("whEnabled")?.addEventListener("change", () => { state.meta.withholding.enabled = !!getEl("whEnabled").checked; toggleWHFields(state.meta.withholding.enabled); computeTotals(); updateWHAmountPreview(); });
  getEl("whRate")?.addEventListener("input", () => { state.meta.withholding.rate = getNum("whRate", state.meta.withholding.rate); computeTotals(); updateWHAmountPreview(); });
  getEl("whBase")?.addEventListener("change", () => { state.meta.withholding.base = getStr("whBase", state.meta.withholding.base); computeTotals(); updateWHAmountPreview(); });
  getEl("whThreshold")?.addEventListener("input", () => { state.meta.withholding.threshold = getNum("whThreshold", state.meta.withholding.threshold ?? 0); computeTotals(); updateWHAmountPreview(); });
  getEl("whLabel")?.addEventListener("input", () => { state.meta.withholding.label = getStr("whLabel", state.meta.withholding.label); updateWHAmountPreview(); });

  // Shipping / Stamp
  getEl("shipEnabled")?.addEventListener("change", () => { state.meta.extras.shipping.enabled = !!getEl("shipEnabled").checked; toggleShipFields(state.meta.extras.shipping.enabled); computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview(); });
  getEl("shipLabel")?.addEventListener("input", () => { state.meta.extras.shipping.label = getStr("shipLabel", state.meta.extras.shipping.label); updateExtrasMiniRows(); });
  getEl("shipAmount")?.addEventListener("input", () => { state.meta.extras.shipping.amount = getNum("shipAmount", state.meta.extras.shipping.amount); computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview(); });
  getEl("shipTva")?.addEventListener("input", () => { state.meta.extras.shipping.tva = getNum("shipTva", state.meta.extras.shipping.tva); computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview(); });

  getEl("stampEnabled")?.addEventListener("change", () => { state.meta.extras.stamp.enabled = !!getEl("stampEnabled").checked; toggleStampFields(state.meta.extras.stamp.enabled); computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview(); });
  getEl("stampLabel")?.addEventListener("input", () => { state.meta.extras.stamp.label = getStr("stampLabel", state.meta.extras.stamp.label); updateExtrasMiniRows(); });
  getEl("stampAmount")?.addEventListener("input", () => { state.meta.extras.stamp.amount = getNum("stampAmount", state.meta.extras.stamp.amount); computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview(); });
  getEl("stampTva")?.addEventListener("input", () => { state.meta.extras.stamp.tva = getNum("stampTva", state.meta.extras.stamp.tva); computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview(); });

  // FODEC
  getEl("fodecEnabled")?.addEventListener("change", () => {
    const f = state.meta.extras.fodec || (state.meta.extras.fodec = {});
    f.enabled = !!getEl("fodecEnabled").checked;
    toggleFodecFields(f.enabled); computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview();
  });
  getEl("fodecLabel")?.addEventListener("input", () => {
    state.meta.extras.fodec.label = getStr("fodecLabel", state.meta.extras.fodec.label || "FODEC");
    updateExtrasMiniRows();
  });
  getEl("fodecRate")?.addEventListener("input", () => {
    state.meta.extras.fodec.rate = getNum("fodecRate", state.meta.extras.fodec.rate ?? 1);
    computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview();
  });
  getEl("fodecBase")?.addEventListener("change", () => {
    state.meta.extras.fodec.base = getStr("fodecBase", state.meta.extras.fodec.base || "ht");
    computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview();
  });
  getEl("fodecTva")?.addEventListener("input", () => {
    state.meta.extras.fodec.tva = getNum("fodecTva", state.meta.extras.fodec.tva ?? 19);
    computeTotals(); updateExtrasMiniRows(); updateWHAmountPreview();
  });

  const selectAllIds = ["shipLabel","shipAmount","shipTva","stampLabel","stampAmount","stampTva","whRate","whThreshold","whLabel","fodecRate","fodecTva"];
  selectAllIds.forEach(id => {
    const el = getEl(id); if (!el) return;
    el.addEventListener("focus", () => { try { el.select(); } catch {} });
    el.addEventListener("click",  () => { try { el.select(); } catch {} });
  });
}

function toggleWHFields(enabled){
  const fields = getEl("whFields"); if (fields) fields.style.display = enabled ? "" : "none";
  const r1 = getEl("miniWHRow"); const r2 = getEl("miniNETRow");
  if (r1) r1.style.display = enabled ? "" : "none";
  if (r2) r2.style.display = enabled ? "" : "none";
}
function toggleShipFields(enabled){
  const f = getEl("shipFields"); if (f) f.style.display = enabled ? "" : "none";
  const r = getEl("miniShipRow"); if (r) r.style.display = enabled ? "" : "none";
}
function toggleStampFields(enabled){
  const f = getEl("stampFields"); if (f) f.style.display = enabled ? "" : "none";
  const r = getEl("miniStampRow"); if (r) r.style.display = enabled ? "" : "none";
}
function toggleFodecFields(enabled){
  const f = getEl("fodecFields"); if (f) f.style.display = enabled ? "" : "none";
  const r = getEl("miniFODECRow"); if (r) r.style.display = enabled ? "" : "none";
}

function updateWHAmountPreview(){
  const { whAmount } = computeTotalsReturn();
  setVal("whAmount", formatMoney(whAmount, state.meta.currency || "TND"));
  const lbl = state.meta.withholding?.label?.trim() || "Retenue à la source";
  setText("miniWHLabel", lbl);
}
function updateExtrasMiniRows(){
  const ex = state.meta.extras || {};
  const cur = state.meta.currency || "TND";
  const { fodecHT } = computeTotalsReturn();

  const shipTT = (ex.shipping?.enabled) ? (Number(ex.shipping.amount||0) * (1 + Number(ex.shipping.tva||0)/100)) : 0;
  if (getEl("miniShipLabel")) setText("miniShipLabel", ex.shipping?.label?.trim() || "Frais de livraison");
  if (getEl("miniShip")) setText("miniShip", formatMoney(shipTT, cur));
  if (getEl("miniShipRow")) getEl("miniShipRow").style.display = ex.shipping?.enabled ? "" : "none";

  const stampTT = (ex.stamp?.enabled) ? (Number(ex.stamp.amount||0) * (1 + Number(ex.stamp.tva||0)/100)) : 0;
  if (getEl("miniStampLabel")) setText("miniStampLabel", ex.stamp?.label?.trim() || "Timbre fiscal");
  if (getEl("miniStamp")) setText("miniStamp", formatMoney(stampTT, cur));
  if (getEl("miniStampRow")) getEl("miniStampRow").style.display = ex.stamp?.enabled ? "" : "none";
}

function readInputs(){
  if (!COMPANY_LOCKED) {
    state.company.name    = getStr("companyName", state.company.name);
    state.company.vat     = getStr("companyVat", state.company.vat);
    state.company.phone   = getStr("companyPhone", state.company.phone);
    state.company.email   = getStr("companyEmail", state.company.email);
    state.company.address = getStr("companyAddress", state.company.address);
  }
  state.meta.docType  = getStr("docType", state.meta.docType) || state.meta.docType;
  state.meta.number   = getStr("invNumber", state.meta.number);
  state.meta.currency = getStr("currency", state.meta.currency) || state.meta.currency;
  state.meta.date     = getStr("invDate", state.meta.date);
  state.meta.due      = getStr("invDue", state.meta.due);

  state.client.type    = getStr("clientType", state.client.type || "societe");
  state.client.name    = getStr("clientName", state.client.name);
  state.client.email   = getStr("clientEmail", state.client.email);
  state.client.phone   = getStr("clientPhone", state.client.phone);
  state.client.vat     = getStr("clientVat", state.client.vat);
  state.client.address = getStr("clientAddress", state.client.address);

  const wh = state.meta.withholding || (state.meta.withholding = { enabled:false, rate:1.5, base:"ht", label:"Retenue à la source", threshold:1000 });
  wh.enabled   = !!getEl("whEnabled")?.checked;
  wh.rate      = getNum("whRate", wh.rate);
  wh.base      = getStr("whBase", wh.base);
  wh.label     = getStr("whLabel", wh.label);
  wh.threshold = getNum("whThreshold", wh.threshold ?? 0);

  const ex = state.meta.extras || (state.meta.extras = { shipping:{}, stamp:{}, fodec:{} });
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
}

function unlockAddInputs(){ ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach(id=>{ const el = getEl(id); if (el) { el.disabled = false; el.readOnly = false; } }); }
function focusFirstEmptyAddField(){
  const order = ["addProduct","addDesc","addRef"];
  const target = order.map(getEl).find(el => el && !el.value.trim()) || getEl("addProduct") || getEl("addDesc") || getEl("addRef");
  if (target) { target.focus(); try { target.select(); } catch {} }
}
function killOverlays(){
  document.body.classList.remove("printing","print-mode");
  const pdfRoot = document.getElementById("pdfRoot");
  if (pdfRoot) { pdfRoot.style.display = "none"; pdfRoot.style.pointerEvents = "none"; pdfRoot.setAttribute("aria-hidden","true"); }
}
function recoverFocus(){ killOverlays(); try { window.focus(); } catch {} unlockAddInputs(); }
function installFocusGuards(){
  const handler = () => recoverFocus();
  document.addEventListener("pointerdown", handler, true);
  document.addEventListener("keydown", handler, true);
  document.addEventListener("focusin", handler, true);
  window.addEventListener("focus", recoverFocus);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recoverFocus(); });
}

function clearAddForm(){ setVal("addRef", ""); setVal("addProduct", ""); setVal("addDesc",""); setVal("addQty","1"); setVal("addPrice","0"); setVal("addTva","19"); setVal("addDiscount","0"); }
function fillAddFormFromItem(it){ setVal("addRef", it.ref ?? ""); setVal("addProduct", it.product ?? ""); setVal("addDesc", it.desc ?? ""); setVal("addQty", String(it.qty ?? 1)); setVal("addPrice", String(it.price ?? 0)); setVal("addTva", String(it.tva ?? 19)); setVal("addDiscount", String(it.discount ?? 0)); }
function setSubmitMode(mode){
  const submitBtn = getEl("btnSubmitItem"); const newBtn = getEl("btnNewItem"); if(!submitBtn || !newBtn) return;
  if(mode === "update"){ submitBtn.textContent = "Mettre à jour"; submitBtn.dataset.mode="update"; newBtn.disabled = false; }
  else { submitBtn.textContent = "+ Ajouter"; submitBtn.dataset.mode="add"; newBtn.disabled = true; }
}
function clearAddFormAndMode(){ selectedItemIndex=null; clearAddForm(); setSubmitMode("add"); }
function enterUpdateMode(i){ selectedItemIndex=i; fillAddFormFromItem(state.items[i]); setSubmitMode("update"); }

async function submitItemForm(){
  recoverFocus();
  const item = {
    ref: getStr("addRef"), product: getStr("addProduct"), desc: getStr("addDesc"),
    qty: getNum("addQty",1), price: getNum("addPrice",0), tva: getNum("addTva",19), discount: getNum("addDiscount",0)
  };
  if (!item.product && !item.desc) {
    await showDialog("Veuillez saisir au moins un Produit ou une Description.", { title: "Article incomplet" });
    focusFirstEmptyAddField(); return;
  }
  const mode = getEl("btnSubmitItem")?.dataset.mode || "add";
  if (mode === "update" && selectedItemIndex !== null) state.items[selectedItemIndex] = item;
  else state.items.push(item);
  renderItems(); clearAddFormAndMode(); focusFirstEmptyAddField();
}

function renderItems(){
  const body = getEl("itemBody"); if(!body) return;
  body.innerHTML = "";
  const currency = state.meta.currency || "TND";
  state.items.forEach((raw,i)=>{
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
  body.querySelectorAll("button.del").forEach(btn=>{
    btn.addEventListener("click",(e)=>{
      const idx = Number(e.currentTarget.dataset.del);
      state.items.splice(idx,1);
      if(selectedItemIndex===idx) clearAddFormAndMode();
      renderItems();
    });
  });
  body.querySelectorAll("button.sel").forEach(btn=>{
    btn.addEventListener("click",(e)=> enterUpdateMode(Number(e.currentTarget.dataset.sel)));
  });
  computeTotals();
  applyColumnHiding();
  updateWHAmountPreview();
  updateExtrasMiniRows();
}

function computeTotals(){
  readInputs();
  const currency = state.meta.currency || "TND";
  let subtotal = 0, totalTax = 0, totalDiscount = 0;
  state.items.forEach((it)=>{
    const qty = Number(it.qty||0);
    const price = Number(it.price||0);
    const tva = Number(it.tva||0);
    const discount = Number(it.discount||0);
    const base = qty * price;
    const disc = base * (discount/100);
    const taxedBase = Math.max(0, base - disc);
    const tax = taxedBase * (tva/100);
    subtotal += base; totalDiscount += disc; totalTax += tax;
  });

  const totalHT_items  = subtotal - totalDiscount;

  const ex = state.meta.extras || {};
  const shipHT  = (ex.shipping?.enabled) ? Number(ex.shipping.amount||0) : 0;
  const shipTVA = shipHT * (Number(ex.shipping?.tva||0)/100);
  const shipTT  = shipHT + shipTVA;

  const stampHT = (ex.stamp?.enabled) ? Number(ex.stamp.amount||0) : 0;
  const stampTVA= stampHT * (Number(ex.stamp?.tva||0)/100);
  const stampTT = stampHT + stampTVA;

  const f      = ex.fodec || {};
  const fEnabled = !!f.enabled;
  const fRate    = Number(f.rate || 0);
  const fBaseSel = String(f.base || "ht").toLowerCase();
  const fTvaRate = Number(f.tva || 0);

  const baseHT_simple = totalHT_items;
  const baseHT_plus   = totalHT_items + shipHT;
  const baseTTC_sansF = baseHT_plus + totalTax + shipTVA;

  let fodecBase = 0;
  if (fBaseSel === "ht")            fodecBase = baseHT_simple;
  else if (fBaseSel === "ht_plus")  fodecBase = baseHT_plus;
  else                              fodecBase = baseTTC_sansF;

  const fodecHT  = fEnabled ? (fodecBase * (fRate/100)) : 0;
  const fodecTVA = fEnabled ? (fodecHT   * (fTvaRate/100)) : 0;

  const displayHT  = totalHT_items + shipHT + (fEnabled ? fodecHT : 0);
  const displayTVA = totalTax + shipTVA + (fEnabled ? fodecTVA : 0);
  const totalTTC_all = displayHT + displayTVA + stampTT;

  const fodecAmountInput = getEl("fodecAmount");
  if (fodecAmountInput) fodecAmountInput.value = (fEnabled ? fodecHT : 0).toFixed(3);

  if (getEl("miniFODECLabel")) {
    const rateTxt = Number.isFinite(Number(fRate)) ? ` (${fRate || 0}%)` : "";
    setText("miniFODECLabel", (f.label?.trim() || "FODEC") + rateTxt);
  }
  if (getEl("miniFODEC")) setText("miniFODEC", formatMoney(fEnabled ? fodecHT : 0, state.meta.currency || "TND"));
  if (getEl("miniFODECRow")) getEl("miniFODECRow").style.display = fEnabled ? "" : "none";

  const rasBaseHT  = totalHT_items + shipHT + (fEnabled ? fodecHT : 0);
  const rasBaseTTC = totalTTC_all - stampTT;

  const wh = state.meta.withholding || {};
  const baseVal = (wh.base === "ttc") ? rasBaseTTC : rasBaseHT;
  const threshold = Number(wh.threshold || 0);
  const whAmount = (wh.enabled && baseVal > threshold) ? (Math.max(0, baseVal) * (Number(wh.rate||0)/100)) : 0;
  const netToPay = totalTTC_all - whAmount;

  if(getEl("miniHT"))  setText("miniHT",  formatMoney(displayHT,  currency));
  if(getEl("miniTVA")) setText("miniTVA", formatMoney(displayTVA, currency));
  if(getEl("miniTTC")) setText("miniTTC", formatMoney(totalTTC_all, currency));

  const whRow  = getEl("miniWHRow");
  const netRow = getEl("miniNETRow");
  if (whRow)  whRow.style.display  = wh.enabled ? "" : "none";
  if (netRow) netRow.style.display = wh.enabled ? "" : "none";
  if (wh.enabled) {
    const lbl = wh.label?.trim() || "Retenue à la source";
    setText("miniWHLabel", lbl);
    setText("miniWH",  "- " + formatMoney(whAmount, currency));
    setText("miniNET", formatMoney(netToPay, currency));
  }

  updateExtrasMiniRows();
}

function captureForm(opts = {}){
  const { forSave = false } = opts;
  readInputs();
  const snapshot = {
    ...(forSave ? {} : { company: { ...state.company } }),
    client: { ...state.client },
    meta:   { ...state.meta },
    notes:  state.notes,
    items:  state.items.map(x => ({ ...x })),
    totals: computeTotalsReturn()
  };
  return snapshot;
}

function computeTotalsReturn(){
  const currency = state.meta.currency || "TND";
  let subtotal=0,totalTax=0,totalDiscount=0;
  state.items.forEach((it)=>{
    const base = Number(it.qty||0) * Number(it.price||0);
    const disc = base * (Number(it.discount||0)/100);
    const taxedBase = Math.max(0, base - disc);
    const tax = taxedBase * (Number(it.tva||0)/100);
    subtotal += base; totalDiscount += disc; totalTax += tax;
  });
  const totalHT_items  = subtotal - totalDiscount;
  const ex = state.meta.extras || {};
  const shipHT  = (ex.shipping?.enabled) ? Number(ex.shipping.amount||0) : 0;
  const shipTVA = shipHT * (Number(ex.shipping?.tva||0)/100);
  const shipTT  = shipHT + shipTVA;
  const stampHT = (ex.stamp?.enabled) ? Number(ex.stamp.amount||0) : 0;
  const stampTVA= stampHT * (Number(ex.stamp.tva||0)/100);
  const stampTT = stampHT + stampTVA;

  const f      = ex.fodec || {};
  const fEnabled = !!f.enabled;
  const fRate    = Number(f.rate || 0);
  const fBaseSel = String(f.base || "ht").toLowerCase();
  const fTvaRate = Number(f.tva || 0);

  const baseHT_simple = totalHT_items;
  const baseHT_plus   = totalHT_items + shipHT;
  const baseTTC_sansF = baseHT_plus + totalTax + shipTVA;

  let fodecBase = 0;
  if (fBaseSel === "ht")            fodecBase = baseHT_simple;
  else if (fBaseSel === "ht_plus")  fodecBase = baseHT_plus;
  else                              fodecBase = baseTTC_sansF;

  const fodecHT  = fEnabled ? (fodecBase * (fRate/100)) : 0;
  const fodecTVA = fEnabled ? (fodecHT   * (fTvaRate/100)) : 0;
  const fodecTT  = fodecHT + fodecTVA;

  const totalHT_display  = totalHT_items + shipHT + (fEnabled ? fodecHT : 0);
  const totalTVA_display = totalTax + shipTVA + (fEnabled ? fodecTVA : 0);
  const totalTTC_all     = totalHT_display + totalTVA_display + stampTT;

  const rasBaseHT  = totalHT_items + shipHT + (fEnabled ? fodecHT : 0);
  const rasBaseTTC = totalTTC_all - stampTT;

  const wh = state.meta.withholding || {};
  const baseVal   = (wh.base === "ttc") ? rasBaseTTC : rasBaseHT;
  const threshold = Number(wh.threshold || 0);
  const whAmount  = (wh.enabled && baseVal > threshold) ? (Math.max(0, baseVal) * (Number(wh.rate||0)/100)) : 0;
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
}

function newInvoice(){
  state.client = { type:"societe", name:"", email:"", phone:"", address:"", vat:"" };
  state.meta.number = "";
  state.meta.date = new Date().toISOString().slice(0,10);
  state.meta.due  = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  state.meta.withholding = { enabled:false, rate:1.5, base:"ht", label:"Retenue à la source", threshold:1000 };
  state.meta.extras = {
    shipping: { enabled: false, label: "Frais de livraison", amount: 7, tva: 19 },
    stamp:    { enabled:false, label:"Timbre fiscal", amount:1, tva:0 },
    fodec:    { enabled:false, label:"FODEC", rate:1, base:"ht", tva:19 }
  };
  state.notes = "";
  state.items = [ { ref: "SKU-001", product: "Ordinateur portable", desc: "Garantie 2 ans", qty: 1, price: 1000, tva: 19, discount: 0 } ];
  clearAddFormAndMode(); bind();
}

function setColumnVisibility(table, oneBasedIndex, visible){
  if (!table) return;
  const th = table.tHead?.rows?.[0]?.cells?.[oneBasedIndex - 1];
  if (th) th.style.display = visible ? "" : "none";
  const rows = table.tBodies[0]?.rows || [];
  for (const r of rows) {
    const cell = r.cells[oneBasedIndex - 1];
    if (cell) cell.style.display = visible ? "" : "none";
  }
}
function setAddInputVisibility({ref, product, desc, qty, price, tva, discount}){
  const map = { addRef: ref, addProduct: product, addDesc: desc, addQty: qty, addPrice: price, addTva: tva, addDiscount: discount };
  Object.entries(map).forEach(([id, vis]) => {
    const el = getEl(id);
    if (el) el.style.display = vis ? "" : "none";
  });
}
function applyColumnHiding(){
  const refVis      = !!getEl('colToggleRef')?.checked;
  const productVis  = !!getEl('colToggleProduct')?.checked;
  const descVis     = !!getEl('colToggleDesc')?.checked;
  const qtyVis      = !!getEl('colToggleQty')?.checked;
  const priceVis    = !!getEl('colTogglePrice')?.checked;
  const tvaVis      = !!getEl('colToggleTva')?.checked;
  const discountVis = !!getEl('colToggleDiscount')?.checked;

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
}

function init(){
  if (!COMPANY_LOCKED) loadCompanyFromLocal();
  bind();
  wireLiveBindings();
  setSubmitMode("add");
  installFocusGuards();

  ["addPrice", "addQty", "addTva", "addDiscount"].forEach(id => enableFirstClickSelectSecondClickCaret(getEl(id)));

  getEl("btnNew") ?.addEventListener("click", newInvoice);

  // NOTE: handlers for Open/Save/PDF are defined in app-export.js (global functions):
  getEl("btnOpen")?.addEventListener("click", onOpenInvoiceClick);
  getEl("btnSave")?.addEventListener("click", saveInvoiceJSON);
  getEl("btnPDF") ?.addEventListener("click", exportCurrentPDF);

  getEl("btnSubmitItem")?.addEventListener("click", () => { submitItemForm(); });
  getEl("btnNewItem")   ?.addEventListener("click", () => { clearAddFormAndMode(); focusFirstEmptyAddField(); });

  ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach(id=>{
    getEl(id)?.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); submitItemForm(); } });
    const el = getEl(id);
    if (el) {
      el.addEventListener("focus", () => { try { el.select(); } catch {} });
      el.addEventListener("click", () => { try { el.select(); } catch {} });
    }
  });

  getEl("companyLogo")?.addEventListener("click", async () => {
    if (!window.SoukElMeuble?.pickLogo) return;
    const res = await window.SoukElMeuble.pickLogo();
    if (res?.dataUrl) { state.company.logo = res.dataUrl; setSrc("companyLogo", res.dataUrl); }
  });

  const addFieldset = getEl("addRef")?.closest("fieldset.section-box");
  if (addFieldset) { addFieldset.addEventListener("mousedown", recoverFocus, true); }

  window.SoukElMeuble?.onEnterPrintMode?.(() => { window.PDFView?.show?.(state, window.SoukElMeuble?.assets || {}); });
  window.SoukElMeuble?.onExitPrintMode?.(() => { window.PDFView?.hide?.(); recoverFocus(); });
}

// first column toggle listeners for SSR safety
getEl('colToggleRef')  ?.addEventListener('change', applyColumnHiding);
getEl('colTogglePrice')?.addEventListener('change', applyColumnHiding);
applyColumnHiding();
onReady(init);