// renderer.js
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const getEl = (id) => document.getElementById(id);
const setVal = (id, v) => { const el = getEl(id); if (el) el.value = v; };
const getStr = (id, def = "") => { const el = getEl(id); return el ? el.value.trim() : def; };
const getNum = (id, def = 0) => { const val = getStr(id, String(def)); const n = Number(val.replace?.(",", ".") ?? val); return Number.isFinite(n) ? n : def; };
const setText = (id, v) => { const el = getEl(id); if (el) el.textContent = v; };
const setSrc  = (id, v) => { const el = getEl(id); if (el) el.src = v; };

const state = {
  company: { name: "Smartwebify", vat: "1891628/W/A/M/000", phone: "+216 27 673 561", email: "contact@smartwebify.com", address: "Rue Mahbouba Soussia 2080 Teboulba", logo: "" },
  client:  { name: "", email: "", phone: "", address: "", vat: "" },
  meta:    { number: "", currency: "TND", date: new Date().toISOString().slice(0,10), due: new Date(Date.now()+7*86400000).toISOString().slice(0,10), docType: "facture" },
  notes: "",
  items: [ { ref: "SKU-001", product: "Ordinateur portable", desc: "Garantie 2 ans", qty: 1, price: 1000, tva: 19, discount: 0 } ],
};

const COMPANY_LOCKED = true;
let selectedItemIndex = null;

function formatMoney(v, currency) {
  const n = Number(v || 0);
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n); }
  catch { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " " + (currency || ""); }
}
function formatInt(v) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(v || 0)); }
function formatPct(v) { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(v || 0)); }

function saveCompanyToLocal(){ if (COMPANY_LOCKED) return; try{ localStorage.setItem("swb_company", JSON.stringify(state.company)); }catch{} }
function loadCompanyFromLocal(){ if (COMPANY_LOCKED) return; try{ const c = JSON.parse(localStorage.getItem("swb_company")||"null"); if(c) state.company = {...state.company, ...c}; }catch{} }

function bind(){
  [["companyName","name"],["companyVat","vat"],["companyPhone","phone"],["companyEmail","email"],["companyAddress","address"]].forEach(([id,key])=>{
    const el = getEl(id); if(!el) return; el.value = state.company[key] || ""; if (COMPANY_LOCKED) { el.readOnly = true; el.classList.add("locked"); el.setAttribute("tabindex","-1"); }
  });
  setVal("docType",  state.meta.docType || "facture");
  setVal("invNumber", state.meta.number);
  setVal("currency",  state.meta.currency);
  setVal("invDate",   state.meta.date);
  setVal("invDue",    state.meta.due);
  setVal("clientName", state.client.name);
  setVal("clientEmail", state.client.email);
  setVal("clientPhone", state.client.phone);
  setVal("clientVat", state.client.vat);
  setVal("clientAddress", state.client.address);
  const logo = window.smartwebify?.assets?.logo || state.company.logo;
  if (logo) setSrc("companyLogo", logo);
  setVal("notes", state.notes);
  setText("year", new Date().getFullYear());
  renderItems();
  computeTotals();
  applyColumnHiding();
}

function wireLiveBindings() {
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
  getEl("currency") ?.addEventListener("change", () => { state.meta.currency = getStr("currency", state.meta.currency); renderItems(); });
  getEl("clientName")   ?.addEventListener("input", () => { state.client.name    = getStr("clientName",    state.client.name); });
  getEl("clientEmail")  ?.addEventListener("input", () => { state.client.email   = getStr("clientEmail",   state.client.email); });
  getEl("clientPhone")  ?.addEventListener("input", () => { state.client.phone   = getStr("clientPhone",   state.client.phone); });
  getEl("clientVat")    ?.addEventListener("input", () => { state.client.vat     = getStr("clientVat",     state.client.vat); });
  getEl("clientAddress")?.addEventListener("input", () => { state.client.address = getStr("clientAddress", state.client.address); });
  getEl("notes")?.addEventListener("input", () => { state.notes = getStr("notes", state.notes); });

  // column toggles → hide/show columns & mini totals box
  ["colToggleRef","colToggleProduct","colToggleDesc","colToggleQty","colTogglePrice","colToggleTva","colToggleDiscount"]
    .forEach(id => getEl(id)?.addEventListener("change", applyColumnHiding));
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
  state.meta.due      = getStr("invDue", state.meta.due) || state.meta.due;
  state.client.name    = getStr("clientName", state.client.name);
  state.client.email   = getStr("clientEmail", state.client.email);
  state.client.phone   = getStr("clientPhone", state.client.phone);
  state.client.vat     = getStr("clientVat", state.client.vat);
  state.client.address = getStr("clientAddress", state.client.address);
  state.notes = getStr("notes", state.notes);
}

function unlockAddInputs() { ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach(id=>{ const el = getEl(id); if (el) { el.disabled = false; el.readOnly = false; } }); }
function focusFirstEmptyAddField() { const order = ["addProduct","addDesc","addRef"]; const target = order.map(getEl).find(el => el && !el.value.trim()) || getEl("addProduct") || getEl("addDesc") || getEl("addRef"); if (target) { target.focus(); try { target.select(); } catch {} } }
function killOverlays() { document.body.classList.remove("printing","print-mode"); const pdfRoot = document.getElementById("pdfRoot"); if (pdfRoot) { pdfRoot.style.display = "none"; pdfRoot.style.pointerEvents = "none"; pdfRoot.setAttribute("aria-hidden","true"); } }
function recoverFocus() { killOverlays(); try { window.focus(); } catch {} unlockAddInputs(); }
function installFocusGuards() {
  const handler = () => recoverFocus();
  document.addEventListener("pointerdown", handler, true);
  document.addEventListener("keydown",     handler, true);
  document.addEventListener("focusin",     handler, true);
  window.addEventListener("focus", recoverFocus);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recoverFocus(); });
}

function clearAddForm(){ setVal("addRef", ""); setVal("addProduct", ""); setVal("addDesc",""); setVal("addQty","1"); setVal("addPrice","0"); setVal("addTva","19"); setVal("addDiscount","0"); }
function fillAddFormFromItem(it){ setVal("addRef", it.ref ?? ""); setVal("addProduct", it.product ?? ""); setVal("addDesc", it.desc ?? ""); setVal("addQty", String(it.qty ?? 1)); setVal("addPrice", String(it.price ?? 0)); setVal("addTva", String(it.tva ?? 19)); setVal("addDiscount", String(it.discount ?? 0)); }
function setSubmitMode(mode){ const submitBtn = getEl("btnSubmitItem"); const newBtn = getEl("btnNewItem"); if(!submitBtn || !newBtn) return; if(mode === "update"){ submitBtn.textContent = "Mettre à jour"; submitBtn.dataset.mode="update"; newBtn.disabled = false; } else { submitBtn.textContent = "+ Ajouter"; submitBtn.dataset.mode="add"; newBtn.disabled = true; } }
function clearAddFormAndMode(){ selectedItemIndex=null; clearAddForm(); setSubmitMode("add"); }
function enterUpdateMode(i){ selectedItemIndex=i; fillAddFormFromItem(state.items[i]); setSubmitMode("update"); }

function ensureDialog() {
  let overlay = getEl("swbDialog");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "swbDialog";
  overlay.className = "swbDialog";
  overlay.setAttribute("aria-hidden", "true");
  const panel = document.createElement("div");
  panel.className = "swbDialog__panel";
  const msg = document.createElement("div");
  msg.id = "swbDialogMsg";
  msg.className = "swbDialog__msg";
  const actions = document.createElement("div");
  actions.className = "swbDialog__actions";
  const ok = document.createElement("button");
  ok.id = "swbDialogOk";
  ok.type = "button";
  ok.className = "swbDialog__ok";
  ok.textContent = "OK";
  actions.appendChild(ok);
  panel.appendChild(msg);
  panel.appendChild(actions);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  return overlay;
}

function showDialog(message) {
  return new Promise((resolve) => {
    const overlay = ensureDialog();
    const msg = getEl("swbDialogMsg");
    const ok = getEl("swbDialogOk");

    // hide cancel button if it exists (from showConfirm)
    const cancel = overlay.querySelector("#swbDialogCancel");
    if (cancel) cancel.style.display = "none";

    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden","false");
    msg.textContent = message || "";
    function close() {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden","true");
      ok.removeEventListener("click", onOk);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve();
      recoverFocus();
    }
    function onOk() { close(); }
    function onBackdrop(e) { if (e.target === overlay) close(); }
    function onKey(e) { if (e.key === "Enter" || e.key === "Escape") close(); }
    ok.addEventListener("click", onOk);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    ok.focus();
  });
}

/** Styled confirm dialog sharing the same CSS/overlay as showDialog */
function showConfirm(message, { okText = "OK", cancelText = "Annuler" } = {}) {
  const overlay = ensureDialog();
  const msg = getEl("swbDialogMsg");
  const ok = getEl("swbDialogOk");

  // ensure a Cancel button exists
  let cancel = overlay.querySelector("#swbDialogCancel");
  if (!cancel) {
    cancel = document.createElement("button");
    cancel.id = "swbDialogCancel";
    cancel.type = "button";
    cancel.className = "swbDialog__Annuler";
    cancel.textContent = cancelText;
    ok.parentElement.insertBefore(cancel, ok);
  }
  // show both buttons for confirm
  cancel.style.display = "";
  ok.textContent = okText;
  cancel.textContent = cancelText;

  return new Promise((resolve) => {
    overlay.style.display = "flex";
    overlay.setAttribute("aria-hidden", "false");
    msg.textContent = message || "";

    function close(result) {
      overlay.style.display = "none";
      overlay.setAttribute("aria-hidden", "true");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      // keep cancel button for reuse; hide will be managed by showDialog next time
      recoverFocus();
      resolve(result);
    }
    function onOk() { close(true); }
    function onCancel() { close(false); }
    function onBackdrop(e) { if (e.target === overlay) close(false); }
    function onKey(e) {
      if (e.key === "Enter") close(true);
      else if (e.key === "Escape") close(false);
    }

    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    ok.focus();
  });
}

async function submitItemForm(){
  recoverFocus();
  const item = {
    ref: getStr("addRef"),
    product: getStr("addProduct"),
    desc: getStr("addDesc"),
    qty: getNum("addQty",1),
    price: getNum("addPrice",0),
    tva: getNum("addTva",19),
    discount: getNum("addDiscount",0),
  };
  if (!item.product && !item.desc) {
    await showDialog("Veuillez saisir au moins un Produit ou une Description.");
    focusFirstEmptyAddField();
    return;
  }
  const mode = getEl("btnSubmitItem")?.dataset.mode || "add";
  if (mode === "update" && selectedItemIndex !== null) { state.items[selectedItemIndex] = item; }
  else { state.items.push(item); }
  renderItems();
  clearAddFormAndMode();
  focusFirstEmptyAddField();
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
      discount: Number(raw.discount ?? 0),
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
    subtotal += base;
    totalDiscount += disc;
    totalTax += tax;
  });
  const totalHT  = subtotal - totalDiscount;
  const totalTTC = totalHT + totalTax;
  setText("subtotal", formatMoney(subtotal, currency));
  setText("tax",      formatMoney(totalTax, currency));
  setText("discount", formatMoney(totalDiscount, currency));
  setText("grand",    formatMoney(totalTTC, currency));
  if(getEl("miniHT"))  setText("miniHT",  formatMoney(totalHT,  currency));
  if(getEl("miniTVA")) setText("miniTVA", formatMoney(totalTax, currency));
  if(getEl("miniTTC")) setText("miniTTC", formatMoney(totalTTC, currency));
}

function captureForm(){
  readInputs();
  return { company:{...state.company}, client:{...state.client}, meta:{...state.meta}, notes:state.notes, items: state.items.map(x=>({...x})), totals: computeTotalsReturn() };
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
  return { currency, subtotal, discount: totalDiscount, tax: totalTax, grand: subtotal - totalDiscount + totalTax };
}
function newInvoice(){
  state.client = { name:"", email:"", phone:"", address:"", vat:"" };
  state.meta.number = "";
  state.meta.date = new Date().toISOString().slice(0,10);
  state.meta.due  = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  state.notes = "";
  state.items = [ { ref: "SKU-001", product: "Ordinateur portable", desc: "Garantie 2 ans", qty: 1, price: 1000, tva: 19, discount: 0 } ];
  clearAddFormAndMode(); bind();
}

function enableFirstClickSelectSecondClickCaret(input) {
  if (!input) return;
  let suppressNextMouseUp = false;
  let firstClickDone = false;
  input.addEventListener("mousedown", () => {
    if (document.activeElement !== input || !firstClickDone) {
      setTimeout(() => { input.select(); try { input.setSelectionRange(0, input.value.length); } catch {} }, 0);
      suppressNextMouseUp = true; firstClickDone = true;
    } else { suppressNextMouseUp = false; }
  });
  input.addEventListener("mouseup", (e) => { if (suppressNextMouseUp) { e.preventDefault(); suppressNextMouseUp = false; } }, true);
  input.addEventListener("blur", () => { firstClickDone = false; suppressNextMouseUp = false; });
}

function toFileURL(p) {
  if (!p) return null;
  if (/^(file|https?):\/\//i.test(p)) return p;
  const normalized = String(p).replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) return "file:///" + encodeURI(normalized);
  if (normalized.startsWith("//")) return "file:" + normalized;
  return "file://" + encodeURI(normalized.startsWith("/") ? normalized : "/" + normalized);
}
async function openPDFFile(path) {
  if (!path) return false;
  if (window.smartwebify?.openPath) { try { return !!(await window.smartwebify.openPath(path)); } catch {} }
  if (window.smartwebify?.showInFolder) { try { await window.smartwebify.showInFolder(path); return true; } catch {} }
  if (window.smartwebify?.openExternal) { try { const url = toFileURL(path); await window.smartwebify.openExternal(url); return true; } catch {} }
  try { const url = toFileURL(path); window.open(url, "_blank", "noopener"); return true; } catch { return false; }
}

function onReady(fn){ if(document.readyState === "loading") { document.addEventListener("DOMContentLoaded", fn, {once:true}); } else { fn(); } }

function init(){
  if (!COMPANY_LOCKED) loadCompanyFromLocal();
  bind();
  wireLiveBindings();
  setSubmitMode("add");
  installFocusGuards();
  ["addPrice", "addQty", "addTva", "addDiscount"].forEach(id => enableFirstClickSelectSecondClickCaret(getEl(id)));
  getEl("btnNew")?.addEventListener("click", newInvoice);
  getEl("btnOpen")?.addEventListener("click", async ()=>{ const data = await window.smartwebify?.openInvoiceJSON?.(); if(!data) return; Object.assign(state, data); bind(); });
  getEl("btnSave")?.addEventListener("click", async ()=>{ 
    const payload = captureForm(); 
    const saved = await window.smartwebify?.saveInvoiceJSON?.(payload); 
    if(saved){ 
      await showDialog(`Enregistré : ${saved}`); 
      // recoverFocus handled by showDialog
    } 
  });
  getEl("btnPDF")?.addEventListener("click", async () => {
    readInputs();
    computeTotals();
    const html = window.PDFView.build(state, window.smartwebify?.assets || {});
    const css  = window.PDFView.css;
    const meta = { number: state.meta.number, type: state.meta.docType };
    const out  = await window.smartwebify?.exportPDFFromHTML?.({ html, css, meta });
    if (!out) return;
    const openNow = await showConfirm(`PDF exporté :\n${out}\n\nVoulez-vous l'ouvrir maintenant ?`);
    if (openNow) {
      const ok = await openPDFFile(out);
      if (!ok) { await showDialog("Le PDF a été exporté, mais l'ouverture automatique a échoué."); }
    }
  });
  getEl("btnSubmitItem")?.addEventListener("click", () => { submitItemForm(); });
  getEl("btnNewItem")?.addEventListener("click", () => { clearAddFormAndMode(); focusFirstEmptyAddField(); });
  ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach(id=>{
    getEl(id)?.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); submitItemForm(); } });
  });
  getEl("companyLogo")?.addEventListener("click", async () => {
    if (!window.smartwebify?.pickLogo) return;
    const res = await window.smartwebify.pickLogo();
    if (res?.dataUrl) { state.company.logo = res.dataUrl; setSrc("companyLogo", res.dataUrl); }
  });
  const addFieldset = getEl("addRef")?.closest("fieldset.section-box");
  if (addFieldset) { addFieldset.addEventListener("mousedown", recoverFocus, true); }
  window.smartwebify?.onEnterPrintMode?.(() => { window.PDFView?.show?.(state, window.smartwebify?.assets || {}); });
  window.smartwebify?.onExitPrintMode?.(() => { window.PDFView?.hide?.(); recoverFocus(); });
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

function applyColumnHiding(){
  const ref      = getEl('colToggleRef')?.checked || false;
  const product  = getEl('colToggleProduct')?.checked || false;
  const desc     = getEl('colToggleDesc')?.checked || false;
  const qty      = getEl('colToggleQty')?.checked || false;
  const price    = getEl('colTogglePrice')?.checked || false;
  const tva      = getEl('colToggleTva')?.checked || false;
  const discount = getEl('colToggleDiscount')?.checked || false;

  document.body.classList.toggle('hide-col-ref', ref);
  document.body.classList.toggle('hide-col-product', product);
  document.body.classList.toggle('hide-col-desc', desc);
  document.body.classList.toggle('hide-col-qty', qty);
  document.body.classList.toggle('hide-col-price', price);
  document.body.classList.toggle('hide-col-tva', tva);
  document.body.classList.toggle('hide-col-discount', discount);

  // If Prix HT is hidden → hide Total TTC (column 8) and mini totals box
  document.body.classList.toggle('hide-col-ttc', price);
  const itemsTable = getEl('items');
  setColumnVisibility(itemsTable, 8, !price); // 8 = Total TTC
  const mini = document.querySelector('.mini-sum');
  if (mini) mini.style.display = price ? 'none' : '';
}

// ensure initial sync on load
getEl('colToggleRef')?.addEventListener('change', applyColumnHiding);
getEl('colTogglePrice')?.addEventListener('change', applyColumnHiding);
applyColumnHiding();

onReady(init);

function escapeHTML(str=""){ return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
