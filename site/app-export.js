// ===== app-export.js =====

// Save EVERYTHING (company included) so the file is fully restorable
async function saveInvoiceJSON() {
  // 1) Make sure DOM -> state is up to date
  if (window.SEM?.readInputs) window.SEM.readInputs();
  else if (typeof readInputs === "function") readInputs();

  // 2) Build a full flat snapshot
  const snapshot = (window.SEM?.captureForm
    ? window.SEM.captureForm({ includeCompany: true })
    : captureForm({ includeCompany: true })
  );

  const st = (window.SEM?.state || window.state);
  const invNum   = slugForFile(st.meta.number || "");
  const base     = [docTypeLabel(st.meta.docType), invNum].filter(Boolean).join(" ");
  const filename = ensureJsonExt(base || "Document");

  // 3) Ask the desktop bridge to save the *flat* snapshot
  if (window.SoukElMeuble?.saveInvoiceJSON) {
    try {
      const res = await window.SoukElMeuble.saveInvoiceJSON({
        ...snapshot,                 // <- flat data (company, client, meta, items, notes, totals)
        meta: snapshot.meta || {},   // <- ensure meta exists for naming
        filename,                    // <- suggested filename (used by main if needed)
      });

      if (res && res.path) {
        await showDialog("Document enregistré :\n" + res.path, { title: "Enregistrer" });
      } else {
        await showDialog("Enregistrement annulé.", { title: "Enregistrer" });
      }
    } catch {
      // Fallback: browser download
      await showDialog("Impossible d’enregistrer via l’app. Téléchargement via le navigateur…", { title: "Enregistrer" });
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      downloadBlob(filename, blob);
    }
    return;
  }

  // 4) Web fallback
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
  await showDialog("Fichier téléchargé.", { title: "Enregistrer" });
}

// === OPEN (browser fallback + desktop bridge) ===
async function openInvoiceFromFilePicker(){
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json";
    inp.addEventListener("change", () => {
      const file = inp.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(String(reader.result || "null"))); }
        catch { resolve(null); }
      };
      reader.readAsText(file, "utf-8");
    });
    inp.click();
  });
}

// Small helper to deep-merge without dropping defaults
function mergeInvoiceDataIntoState(data){
  if (!data || typeof data !== "object") return;

  // Accept both shapes: {data:{...}} or flat
  const src = data.data && typeof data.data === "object" ? data.data : data;

  const st = (window.SEM?.state || window.state);

  // company
  if (src.company) {
    st.company = { ...st.company, ...src.company };
  }

  // client
  if (src.client) {
    st.client = { ...st.client, ...src.client };
  }

  // meta (with some nested blocks)
  if (src.meta) {
    const cur = st.meta || {};
    const incoming = src.meta;

    const mergedWH = { ...(cur.withholding || {}), ...(incoming.withholding || {}) };
    const curExtras = cur.extras || {};
    const incExtras = incoming.extras || {};
    const mergedExtras = {
      ...curExtras,
      shipping: { ...(curExtras.shipping || {}), ...(incExtras.shipping || {}) },
      stamp:    { ...(curExtras.stamp    || {}), ...(incExtras.stamp    || {}) },
      fodec:    { ...(curExtras.fodec    || {}), ...(incExtras.fodec    || {}) },
    };

    st.meta = {
      ...cur,
      ...incoming,
      withholding: mergedWH,
      extras: mergedExtras,
    };
  }

  // items (replace array if provided)
  if (Array.isArray(src.items)) {
    st.items = src.items.map(x => ({ ...x }));
  }

  // notes
  if (typeof src.notes === "string") {
    st.notes = src.notes;
  }
}

async function onOpenInvoiceClick(){
  const raw = (await window.SoukElMeuble?.openInvoiceJSON?.()) || (await openInvoiceFromFilePicker());
  if (!raw) return;

  mergeInvoiceDataIntoState(raw);

  const st = (window.SEM?.state || window.state);

  // Back-compat: if older file had no company and you want to keep current logo, this preserves it
  const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
  if (!data.company && st.company && !st.company.logo) {
    st.company.logo = getEl("companyLogo")?.src || st.company.logo || "";
  }

  (window.SEM?.bind ? window.SEM.bind() : bind());
}

// === EXPORT PDF (invoice + optional WH certificate) ===
async function exportCurrentPDF(){
  (window.SEM?.readInputs ? window.SEM.readInputs() : readInputs());
  (window.SEM?.computeTotals ? window.SEM.computeTotals() : computeTotals());

  const st = (window.SEM?.state || window.state);
  const assets  = window.SoukElMeuble?.assets || {};
  const htmlInv = window.PDFView.build(st, assets);
  const cssInv  = window.PDFView.css;

  const invNum    = slugForFile(st.meta.number || "");
  const typeLabel = docTypeLabel(st.meta.docType);
  const fileName  = ensurePdfExt([typeLabel, invNum].filter(Boolean).join(" "));

  const resInv = await window.SoukElMeuble?.exportPDFFromHTML?.({
    html: htmlInv,
    css: cssInv,
    meta: { number: st.meta.number, docType: st.meta.docType, filename: fileName, deferOpen: true }
  });
  if (!resInv) return;

  let resWH = null;
  if (st.meta?.withholding?.enabled && window.PDFWH) {
    const htmlWH = window.PDFWH.build(st, assets);
    const cssWH  = window.PDFWH.css;
    const baseWH = ensurePdfExt(invNum ? `Retenue à la source - ${invNum}` : `Retenue à la source`);
    resWH = await window.SoukElMeuble?.exportPDFFromHTML?.({
      html: htmlWH,
      css: cssWH,
      meta: { number: st.meta.number, docType: "retenue", filename: baseWH, deferOpen: true }
    });
  }

  const invLabel = resInv?.name || fileName;
  const whLabel  = resWH ? (resWH?.name || "Retenue à la source.pdf") : null;

  const msg =
    "PDF exporté : " + invLabel +
    (whLabel ? "\nCertificat exporté : " + whLabel : "");

  const okBtnText = (() => {
    const t = String(st.meta.docType || "").toLowerCase();
    if (t === "facture") return "Ouvrir la facture";
    if (t === "devis")   return "Ouvrir le devis";
    if (t === "bl")      return "Ouvrir le bon de livraison";
    if (t === "bc")      return "Ouvrir le bon de commande";
    return "Ouvrir le document";
  })();

  const openViaAnchor = (url) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  };

  await showConfirm(msg, {
    title: "Ouvrir les documents",
    okText: okBtnText,
    cancelText: "Fermer",
    okKeepsOpen: true,
    extra: resWH?.url ? {
      text: "Ouvrir le certificat",
      onClick: () => { try { openViaAnchor(resWH.url); } catch {} }
    } : undefined,
    onOk: () => {
      const invUrl = resInv?.url || null;
      if (invUrl) openViaAnchor(invUrl);
    }
  });
}
