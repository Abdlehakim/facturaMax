// ===== helpers.js 
(function (global) {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const getEl = (id) => document.getElementById(id);

  const setVal  = (id, v) => { const el = getEl(id); if (el) el.value = v; };
  const getStr  = (id, def = "") => { const el = getEl(id); return el ? String(el.value ?? "").trim() : def; };
  const setText = (id, v) => { const el = getEl(id); if (el) el.textContent = v; };
  const setSrc  = (id, v) => { const el = getEl(id); if (el) el.src = v; };

  const getNum = (id, def = 0) => {
    let raw = getStr(id, String(def));
    if (!raw) return Number(def);
    raw = String(raw).replace(/\u00A0/g, " ").replace(/['\s]/g, "").replace(/[^\d.,\-]/g, "");
    const lastDot = raw.lastIndexOf(".");
    const lastCom = raw.lastIndexOf(",");
    if (lastDot > -1 && lastCom > -1) {
      if (lastDot > lastCom) raw = raw.replace(/,/g, "");
      else { raw = raw.replace(/\./g, ""); raw = raw.replace(/,/, "."); }
    } else if (lastCom > -1) raw = raw.replace(/,/g, ".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : Number(def);
  };

  function slugForFile(s = "") {
    let out = String(s ?? "")
      .replace(/[\/\\:*?"<>|]/g, "-")
      .replace(/[\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const base = out.split(".")[0]?.trim().toUpperCase();
    if (!base || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(base)) out = `file-${Date.now()}`;
    out = out.replace(/[.\s]+$/g, "");
    if (out.length > 120) out = out.slice(0, 120).trim();
    return out || "file";
  }
  const sanitizeFilename = slugForFile;
  const ensurePdfExt  = (name="document") => name.toLowerCase().endsWith(".pdf")  ? name : (name + ".pdf");
  const ensureJsonExt = (name="data")     => name.toLowerCase().endsWith(".json") ? name : (name + ".json");

  function docTypeLabel(t){
    const map = { facture:"Facture", devis:"Devis", bl:"Bon de livraison", bc:"Bon de commande" };
    return map[String(t || "").toLowerCase()] || "Document";
  }

  function formatMoney(v, currency){
    const n = Number(v || 0);
    try {
      if (currency) return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
      return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    } catch {
      return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + (currency ? (" " + currency) : "");
    }
  }
  const formatInt = (v) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(v || 0));
  const formatPct = (v) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(v || 0));

  function enableFirstClickSelectSecondClickCaret(input){
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

  function ensureDialog(){
    let overlay = getEl("swbDialog");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "swbDialog";
    overlay.className = "swbDialog";
    overlay.setAttribute("aria-hidden", "true");

    const panel  = document.createElement("div"); panel.className = "swbDialog__panel";
    const header = document.createElement("div"); header.className = "swbDialog__header";
    const title  = document.createElement("div"); title.id = "swbDialogTitle"; title.className = "swbDialog__title";
    const closeX = document.createElement("button"); closeX.type = "button"; closeX.className = "swbDialog__close"; closeX.textContent = "×";
    header.appendChild(title); header.appendChild(closeX);

    const msg    = document.createElement("div"); msg.id = "swbDialogMsg"; msg.className = "swbDialog__msg";
    const actions= document.createElement("div"); actions.className = "swbDialog__actions";
    const groupLeft  = document.createElement("div"); groupLeft.className  = "swbDialog__group swbDialog__group--left";
    const groupRight = document.createElement("div"); groupRight.className = "swbDialog__group swbDialog__group--right";
    const cancel = document.createElement("button"); cancel.id="swbDialogCancel"; cancel.type="button"; cancel.className="swbDialog__cancel"; cancel.textContent="Fermer";
    const ok     = document.createElement("button"); ok.id="swbDialogOk"; ok.type="button"; ok.className="swbDialog__ok"; ok.textContent="OK";
    const extra  = document.createElement("button"); extra.id="swbDialogExtra"; extra.type="button"; extra.className="swbDialog__ok"; extra.style.display="none";

    groupLeft.appendChild(cancel);
    groupRight.appendChild(ok); groupRight.appendChild(extra);
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

  function toFileURL(p){
    if (!p) return null;
    if (/^(file|https?):\/\//i.test(p)) return p;
    let normalized = String(p).replace(/\\/g, "/");
    if (normalized.startsWith("//")) return "file:" + encodeURI(normalized);
    if (/^[a-zA-Z]:\//.test(normalized)) return "file:///" + encodeURI(normalized);
    if (normalized.startsWith("/")) return "file://" + encodeURI(normalized);
    return "file://" + encodeURI("/" + normalized);
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
      async function runOpeners(){
        try { onOk && onOk(); } catch {}
        for (const raw of urls) {
          try {
            const url = toFileURL(raw);
            if (window.SoukElMeuble?.openExternal) {
              await window.SoukElMeuble.openExternal(url);
            }
          } catch {}
        }
      }
      async function onOkClick(){ await runOpeners(); if (!okKeepsOpen) close(true); }
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

  async function openPDFFile(path){
    if (!path) return false;
    if (window.SoukElMeuble?.openPath)      { try { return !!(await window.SoukElMeuble.openPath(path)); } catch {} }
    if (window.SoukElMeuble?.showInFolder)  { try { await window.SoukElMeuble.showInFolder(path); return true; } catch {} }
    if (window.SoukElMeuble?.openExternal)  { try { const url = toFileURL(path); await window.SoukElMeuble.openExternal(url); return true; } catch {} }
    return false;
  }

  function onReady(fn){
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  const escapeHTML = (str="") => String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const helpers = {
    $, $$, getEl, setVal, getStr, getNum, setText, setSrc,
    slugForFile, sanitizeFilename, ensurePdfExt, ensureJsonExt, docTypeLabel,
    formatMoney, formatInt, formatPct,
    enableFirstClickSelectSecondClickCaret,
    ensureDialog, showDialog, showConfirm,
    toFileURL, openPDFFile,
    onReady, escapeHTML
  };

  Object.assign(global, helpers);
  global.SEM = global.SEM || {};
  global.SEM.helpers = helpers;
})(window);
