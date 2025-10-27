// gestionFacture/app-init-CreateInvoice.js
/*
  Responsibilities (Create facture screen only):
  - Wire buttons & fields inside #invoice after CreateInvoice.js mounts
  - Manage recent invoices list (+ desktop integration)
  - Suggest next invoice number (desktop ledger first, else local registry)
  - Expose SEM.initCreateInvoice(root)
  - Guard against double-binding

  Assumptions: global helpers exist (getEl, setVal, showDialog, showConfirm, etc.)
*/
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  const IS_DESKTOP = !!(w.SoukElMeuble && (w.SoukElMeuble.isDesktop ?? true));
  SEM.IS_DESKTOP = IS_DESKTOP;
  SEM.WEB_FS_DISABLED = IS_DESKTOP;

  const getEl  = w.getEl  || ((id) => document.getElementById(id));
  const setVal = w.setVal || ((id, v) => { const el = getEl(id); if (el) el.value = v; });
  const getStr = w.getStr || ((id, def = "") => { const el = getEl(id); return el ? String(el.value ?? "").trim() : def; });

  const REGISTRY_KEY = "sem_recent_invoices_v1";
  const REG_LIMIT = 4;

  function monthKeyFromDateStr(s) {
    const d = new Date(s || new Date().toISOString().slice(0, 10));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function readRegistry() { try { return JSON.parse(localStorage.getItem(REGISTRY_KEY) || "[]"); } catch { return []; } }
  function writeRegistry(arr) { try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(arr.slice(0, REG_LIMIT))); } catch {} }
  function pushRegistry(entry) {
    const arr = readRegistry();
    const filtered = [entry, ...arr.filter(x => !(x.monthKey === entry.monthKey && x.number === entry.number))];
    writeRegistry(filtered.slice(0, REG_LIMIT));
  }
  function removeRegistry(monthKey, number) { writeRegistry(readRegistry().filter(x => !(x.monthKey === monthKey && x.number === number))); }
  function computeNextNumberForMonth(monthKey) {
    const reg = readRegistry(); let max = 0;
    for (const r of reg) if (r.monthKey === monthKey && String(r.typeLabel || "").toLowerCase() === "facture") {
      const n = Number(r.number || 0); if (!Number.isNaN(n)) max = Math.max(max, n);
    }
    return String(max + 1).padStart(4, "0");
  }

  async function autoNumberFromRegistryIfEmpty() {
    const st = SEM.state || {};
    if ((st.meta?.docType || "facture").toLowerCase() !== "facture") return;
    const cur = String(st.meta?.number || "").trim();
    const key = monthKeyFromDateStr(st.meta?.date);
    if (cur) return;

    if (IS_DESKTOP && w.SoukElMeuble?.invoicesGetNextNumber) {
      try {
        const res = await w.SoukElMeuble.invoicesGetNextNumber({ date: st.meta?.date });
        if (res?.ok && res.number) { st.meta.number = res.number; setVal("invNumber", res.number); return; }
      } catch {}
    }
    const next = computeNextNumberForMonth(key);
    st.meta.number = next;
    setVal("invNumber", next);
  }
  SEM.autoNumberFromRegistryIfEmpty = autoNumberFromRegistryIfEmpty;
  w.autoNumberFromRegistryIfEmpty = autoNumberFromRegistryIfEmpty;

  function buildRegistryEntryFromSnapshot(snap, saveResult) {
    const st = snap || {}; const m = st.meta || {}; const cli = st.client || {};
    const monthKey = monthKeyFromDateStr(m.date);
    const typeLabel = (() => {
      const v = String(m.docType || "facture").toLowerCase();
      if (v === "devis") return "Devis";
      if (v === "bl") return "Bon de livraison";
      if (v === "bc") return "Bon de commande";
      return "Facture";
    })();
    return {
      monthKey,
      number: String(m.number || "").padStart(4, "0"),
      date: m.date || "",
      typeLabel,
      client: cli.name || "",
      savedPath: saveResult?.path || "",
      savedName: saveResult?.name || "",
      snapshot: st
    };
  }

  async function renderRecentList() {
    const wrap = getEl("recentInvoicesList");
    if (!wrap) return;
    wrap.innerHTML = "";

    if (IS_DESKTOP && w.SoukElMeuble?.invoicesListRecent) {
      try {
        const res = await w.SoukElMeuble.invoicesListRecent({ limit: 4 });
        const items = Array.isArray(res?.items) ? res.items : [];
        if (!items.length) {
          const d = document.createElement("div"); d.className = "muted"; d.textContent = "Aucune facture recente.";
          wrap.appendChild(d); return;
        }
        items.forEach((it) => {
          const row = document.createElement("div"); row.className = "recent-row";
          const meta = document.createElement("div"); meta.className = "meta";
          const strong = document.createElement("strong"); strong.textContent = `Facture ${String(it.number || "").padStart(4, "0")}`;
          const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = it.date || "";
          meta.appendChild(strong); meta.appendChild(tag);

          const info = document.createElement("div"); info.className = "muted"; info.textContent = it.clientShort || ""; if (it.clientFull) info.title = it.clientFull;

          const actions = document.createElement("div"); actions.className = "actions";
          const btnEdit = document.createElement("button"); btnEdit.className = "btn tiny"; btnEdit.textContent = "Editer";
          btnEdit.addEventListener("click", async () => {
            try {
              const r = await w.SoukElMeuble.invoicesRead({ path: it.path });
              if (r?.ok && r.data && typeof w.mergeInvoiceDataIntoState === "function") {
                w.mergeInvoiceDataIntoState({ data: r.data });
                (SEM.bind ? SEM.bind() : null);
                SEM.navigate?.("create-facture");
              }
            } catch {}
          });
          const btnDel = document.createElement("button"); btnDel.className = "btn tiny danger"; btnDel.textContent = "Supprimer";
          btnDel.addEventListener("click", async () => {
            const ok = await w.showConfirm?.(`Supprimer Facture ${String(it.number || "").padStart(4, "0")} ?`, { title: "Confirmer", okText: "Supprimer", cancelText: "Annuler" });
            if (!ok) return;
            try {
              const r = await w.SoukElMeuble.invoicesDelete({ path: it.path });
              if (r?.ok) renderRecentList(); else await w.showDialog?.(r?.error || "Suppression impossible.", { title: "Erreur" });
            } catch { await w.showDialog?.("Suppression impossible.", { title: "Erreur" }); }
          });
          actions.appendChild(btnEdit); actions.appendChild(btnDel);
          row.appendChild(meta); row.appendChild(info); row.appendChild(actions);
          wrap.appendChild(row);
        });
        return;
      } catch {}
    }

    // Fallback to browser registry (also used on desktop if no native list)
    const items = readRegistry().filter((r) => String(r.typeLabel || "").toLowerCase() === "facture");
    if (!items.length) { const d = document.createElement("div"); d.className = "muted"; d.textContent = "Aucune facture recente."; wrap.appendChild(d); return; }
    items.forEach((it) => {
      const row = document.createElement("div"); row.className = "recent-row";
      const meta = document.createElement("div"); meta.className = "meta";
      const strong = document.createElement("strong"); strong.textContent = `Facture ${String(it.number).padStart(4, "0")}`;
      const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = it.date || "";
      meta.appendChild(strong); meta.appendChild(tag);

      const info = document.createElement("div"); info.className = "muted"; info.textContent = it.client || "";

      const actions = document.createElement("div"); actions.className = "actions";
      const btnEdit = document.createElement("button"); btnEdit.className = "btn tiny"; btnEdit.textContent = "Editer";
      btnEdit.addEventListener("click", () => {
        try {
          if (it.snapshot && typeof w.mergeInvoiceDataIntoState === "function") {
            w.mergeInvoiceDataIntoState({ data: it.snapshot });
            (SEM.bind ? SEM.bind() : null);
            SEM.navigate?.("create-facture");
          }
        } catch {}
      });
      const btnDel = document.createElement("button"); btnDel.className = "btn tiny danger"; btnDel.textContent = "Supprimer";
      btnDel.addEventListener("click", async () => {
        const ok = await w.showConfirm?.(`Supprimer Facture ${String(it.number).padStart(4, "0")} ?`, { title: "Confirmer", okText: "Supprimer", cancelText: "Annuler" });
        if (!ok) return; removeRegistry(it.monthKey, it.number); renderRecentList();
      });
      actions.appendChild(btnEdit); actions.appendChild(btnDel);
      row.appendChild(meta); row.appendChild(info); row.appendChild(actions);
      wrap.appendChild(row);
    });
  }

  function wireCreateInvoice(root) {
    const host = root?.querySelector?.("#invoice") || document.getElementById("invoice");
    if (!host) return false;
    if (host.dataset.wired === "1") return true;   // double-bind guard
    host.dataset.wired = "1";

    // First render & wire live bindings/column toggles
    try { SEM.bind?.(); } catch {}
    try { SEM.wireLiveBindings?.(); } catch {}
    try { SEM.wireColumnToggles?.(); } catch {}
    try { SEM.attachItemSearch?.(); } catch {}

    getEl("btnNew")?.addEventListener("click", () => {
      if (typeof SEM.newInvoice === "function") {
        SEM.newInvoice();
        SEM.selectedItemIndex = null;
        SEM.bind?.();
        SEM.wireColumnToggles?.();   // reset toggles checked + apply
        SEM.attachItemSearch?.();
        autoNumberFromRegistryIfEmpty();
        SEM.navigate?.("create-facture");
      }
    });

    getEl("btnOpen")?.addEventListener("click", () => {
      if (typeof w.onOpenInvoiceClick === "function") w.onOpenInvoiceClick();
      SEM.navigate?.("create-facture");
    });

    getEl("btnSave")?.addEventListener("click", async () => {
      try { w.__includeCompanyForSave = true; } catch {}
      w.SEM?.readInputs?.();
      const snap = (SEM.captureForm ? SEM.captureForm({ includeCompany: true }) : null) || null;

      if (!w.SoukElMeuble?.saveInvoiceJSON) {
        await w.showDialog?.("Sauvegarde indisponible dans cette version.", { title: "Info" });
        return;
      }
      const res = await w.SoukElMeuble.saveInvoiceJSON({ data: snap });
      if (res?.ok) {
        await w.showDialog?.("Document enregistre.", { title: "Succes" });
        // Desktop: refresh native recent list; Browser: update registry
        if (IS_DESKTOP) {
          renderRecentList();
        } else if (String(snap?.meta?.docType || "facture").toLowerCase() === "facture") {
          const entry = buildRegistryEntryFromSnapshot(snap, res);
          entry.typeLabel = "Facture";
          pushRegistry(entry);
          renderRecentList();
        }
      }
    });

    getEl("btnPDF")?.addEventListener("click", () => {
      if (typeof w.exportCurrentPDF === "function") w.exportCurrentPDF();
    });

    // Auto-numbering hooks
    getEl("invDate")?.addEventListener("change", () => autoNumberFromRegistryIfEmpty());
    getEl("docType")?.addEventListener("change", () => {
      const v = getStr("docType", "facture").toLowerCase();
      if (v === "facture") {
        autoNumberFromRegistryIfEmpty();
      } else {
        // clear number for non-facture docs
        const st = SEM.state || {};
        if (st.meta) st.meta.number = "";
        setVal("invNumber", "");
      }
    });

    // Initial fills
    autoNumberFromRegistryIfEmpty();
    renderRecentList();
    return true;
  }

  SEM.initCreateInvoice = wireCreateInvoice;

  function tryAutoWire() {
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash && hash !== "create-facture") return;
    const ok = wireCreateInvoice(document);
    if (!ok) setTimeout(tryAutoWire, 60);
  }

  w.addEventListener("hashchange", () => {
    const route = (location.hash || "").replace(/^#/, "");
    if (route === "create-facture") tryAutoWire();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryAutoWire);
  else tryAutoWire();
})(window);
