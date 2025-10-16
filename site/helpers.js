const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const getEl = (id) => document.getElementById(id);
const setVal = (id, v) => { const el = getEl(id); if (el) el.value = v; };
const getStr = (id, def = "") => { const el = getEl(id); return el ? el.value.trim() : def; };
const getNum = (id, def = 0) => {
  const val = getStr(id, String(def));
  const n = Number(val.replace?.(",", ".") ?? val);
  return Number.isFinite(n) ? n : def;
};
const setText = (id, v) => { const el = getEl(id); if (el) el.textContent = v; };
const setSrc  = (id, v) => { const el = getEl(id); if (el) el.src = v; };

function slugForFile(s = "") {
  return String(s).trim()
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001f]/g, "")
    .trim();
}
function ensurePdfExt(name){ return name.toLowerCase().endsWith(".pdf") ? name : (name + ".pdf"); }
function ensureJsonExt(name){ return name.toLowerCase().endsWith(".json") ? name : (name + ".json"); }
function docTypeLabel(t){
  const map = { facture:"Facture", devis:"Devis", bl:"Bon de livraison", bc:"Bon de commande" };
  return map[String(t || "").toLowerCase()] || "Document";
}

function formatMoney(v, currency){
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " " + (currency || "");
  }
}
function formatInt(v){ return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(v || 0)); }
function formatPct(v){ return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(v || 0)); }

function enableFirstClickSelectSecondClickCaret(input){
  if (!input) return;
  let suppressNextMouseUp = false;
  let firstClickDone = false;
  input.addEventListener("mousedown", () => {
    if (document.activeElement !== input || !firstClickDone) {
      setTimeout(() => { input.select(); try { input.setSelectionRange(0, input.value.length); } catch {} }, 0);
      suppressNextMouseUp = true; firstClickDone = true;
    } else {
      suppressNextMouseUp = false;
    }
  });
  input.addEventListener("mouseup", (e) => { if (suppressNextMouseUp) { e.preventDefault(); suppressNextMouseUp = false; } }, true);
  input.addEventListener("blur", () => { firstClickDone = false; suppressNextMouseUp = false; });
}

function ensureDialog(){
  let overlay = getEl("swbDialog");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "swbDialog";
  overlay.className = "swbDialog";
  overlay.setAttribute("aria-hidden", "true");
  const panel = document.createElement("div"); panel.className = "swbDialog__panel";
  const header= document.createElement("div"); header.className = "swbDialog__header";
  const title = document.createElement("div"); title.id = "swbDialogTitle"; title.className = "swbDialog__title";
  const closeX= document.createElement("button"); closeX.type = "button"; closeX.className = "swbDialog__close"; closeX.textContent = "×";
  header.appendChild(title); header.appendChild(closeX);
  const msg   = document.createElement("div"); msg.id = "swbDialogMsg"; msg.className = "swbDialog__msg";
  const actions = document.createElement("div"); actions.className = "swbDialog__actions";
  const groupLeft  = document.createElement("div"); groupLeft.className  = "swbDialog__group swbDialog__group--left";
  const groupRight = document.createElement("div"); groupRight.className = "swbDialog__group swbDialog__group--right";
  const cancel= document.createElement("button"); cancel.id="swbDialogCancel"; cancel.type="button"; cancel.className="swbDialog__cancel"; cancel.textContent="Fermer";
  const ok    = document.createElement("button"); ok.id="swbDialogOk"; ok.type="button"; ok.className="swbDialog__ok"; ok.textContent="OK";
  const extra = document.createElement("button"); extra.id="swbDialogExtra"; extra.type="button"; extra.className="swbDialog__ok"; extra.style.display="none";
  groupLeft.appendChild(cancel); groupRight.appendChild(ok); groupRight.appendChild(extra);
  actions.appendChild(groupLeft); actions.appendChild(groupRight);
  panel.appendChild(header); panel.appendChild(msg); panel.appendChild(actions);
  overlay.appendChild(panel); document.body.appendChild(overlay);
  closeX.addEventListener("click", () => { const evt = new KeyboardEvent("keydown", { key: "Escape" }); document.dispatchEvent(evt); });
  return overlay;
}
function setSiblingsInert(exceptEl, inertOn){
  const kids = Array.from(document.body.children);
  for (const el of kids){ if (el === exceptEl) continue; if (inertOn) el.setAttribute('inert',''); else el.removeAttribute('inert'); }
}
function openOverlayA11y(overlay, focusEl){
  const panel = overlay.querySelector('.swbDialog__panel');
  if (panel){ panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); }
  overlay.style.display = 'flex';
  overlay.removeAttribute('aria-hidden');
  setSiblingsInert(overlay, true);
  if (focusEl) try { focusEl.focus(); } catch {}
}
function closeOverlayA11y(overlay, prevFocusEl, buttonsToBlur = []){
  buttonsToBlur.forEach(btn => { try { btn.blur(); } catch {} });
  overlay.setAttribute('aria-hidden','true');
  overlay.style.display = 'none';
  setSiblingsInert(overlay, false);
  if (prevFocusEl && typeof prevFocusEl.focus === 'function'){ try { prevFocusEl.focus(); } catch {} }
}

function showDialog(message, { title = "Information" } = {}){
  return new Promise((resolve) => {
    const overlay = ensureDialog();
    const msg = getEl("swbDialogMsg");
    const ok  = getEl("swbDialogOk");
    const ttl = getEl("swbDialogTitle");
    const cancel = overlay.querySelector("#swbDialogCancel");
    if (cancel) cancel.style.display = "none";
    const extra = overlay.querySelector("#swbDialogExtra");
    if (extra)  extra.style.display = "none";
    ok.textContent = "Fermer";
    const previouslyFocused = document.activeElement;
    msg.textContent = message || ""; ttl.textContent = title;
    function close(){
      ok.removeEventListener("click", onOk);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      closeOverlayA11y(overlay, previouslyFocused, [ok]);
      resolve();
    }
    function onOk(){ close(); }
    function onBackdrop(e){ if (e.target === overlay) close(); }
    function onKey(e){ if (e.key === "Enter" || e.key === "Escape") close(); }
    openOverlayA11y(overlay, ok);
    ok.addEventListener("click", onOk);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

function showConfirm(message, {
  title="Export terminé", okText="Ouvrir", cancelText="Fermer",
  onOk, openUrls, extra, okKeepsOpen=false
} = {}){
  const overlay = ensureDialog();
  const msg   = getEl("swbDialogMsg");
  const ok    = getEl("swbDialogOk");
  const ttl   = getEl("swbDialogTitle");
  const cancel= getEl("swbDialogCancel");
  const extraBtn = getEl("swbDialogExtra");
  ok.textContent = okText; cancel.textContent = cancelText; cancel.style.display = "";
  if (extra && extra.text){ extraBtn.textContent = extra.text; extraBtn.style.display = ""; } else { extraBtn.style.display = "none"; }
  const previouslyFocused = document.activeElement;
  msg.textContent = message || ""; ttl.textContent = title;
  const urls = Array.isArray(openUrls) ? openUrls.filter(Boolean) : (openUrls ? [openUrls] : []);
  return new Promise((resolve) => {
    function close(result){
      ok.removeEventListener("click", onOkClick);
      cancel.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      extraBtn.removeEventListener("click", onExtraClick);
      closeOverlayA11y(overlay, previouslyFocused, [ok, cancel, extraBtn]);
      resolve(result);
    }
    function runOpeners(){ try { onOk && onOk(); } catch {} urls.forEach((u)=>{ try{ window.open(u,"_blank","noopener,noreferrer"); }catch{} }); }
    function onOkClick(){ runOpeners(); if (!okKeepsOpen) close(true); }
    function onCancel(){ close(false); }
    function onBackdrop(e){ if (e.target === overlay) close(false); }
    function onKey(e){ if (e.key === "Enter") onOkClick(); else if (e.key === "Escape") close(false); }
    function onExtraClick(){ try { extra?.onClick && extra.onClick(); } catch {} }
    if (extra && extra.text) extraBtn.addEventListener("click", onExtraClick);
    openOverlayA11y(overlay, ok);
    ok.addEventListener("click", onOkClick);
    cancel.addEventListener("click", onCancel);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

function downloadBlob(filename, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function toFileURL(p){
  if (!p) return null;
  if (/^(file|https?):\/\//i.test(p)) return p;
  const normalized = String(p).replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) return "file:///" + encodeURI(normalized);
  if (normalized.startsWith("//")) return "file:" + normalized;
  return "file://" + encodeURI(normalized.startsWith("/") ? normalized : "/" + normalized);
}
async function openPDFFile(path){
  if (!path) return false;
  if (window.SoukElMeuble?.openPath)      { try { return !!(await window.SoukElMeuble.openPath(path)); } catch {} }
  if (window.SoukElMeuble?.showInFolder)  { try { await window.SoukElMeuble.showInFolder(path); return true; } catch {} }
  if (window.SoukElMeuble?.openExternal)  { try { const url = toFileURL(path); await window.SoukElMeuble.openExternal(url); return true; } catch {} }
  try { const _ = toFileURL(path); return true; } catch { return false; }
}

function onReady(fn){
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
  else fn();
}

function escapeHTML(str=""){
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}