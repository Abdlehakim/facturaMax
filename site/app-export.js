async function saveInvoiceJSON(){
  const data = captureForm({ forSave: true });
  const invNum = slugForFile(state.meta.number || "");
  const base   = [docTypeLabel(state.meta.docType), invNum].filter(Boolean).join(" ");
  const filename = ensureJsonExt(base || "Document");

  if (window.SoukElMeuble?.saveInvoiceJSON) {
    try {
      const res = await window.SoukElMeuble.saveInvoiceJSON({ data, filename });
      await showDialog(res ? "Document enregistré." : "Enregistrement annulé.", { title: "Enregistrer" });
    } catch {
      await showDialog("Impossible d’enregistrer via l’app. Téléchargement via le navigateur…", { title: "Enregistrer" });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(filename, blob);
    }
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
  await showDialog("Fichier téléchargé.", { title: "Enregistrer" });
}

// OPEN
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

// Handler used by core init
async function onOpenInvoiceClick(){
  const data = (await window.SoukElMeuble?.openInvoiceJSON?.()) || (await openInvoiceFromFilePicker());
  if(!data) return;
  Object.assign(state, data); // keep current company if absent in file
  bind();
}

// EXPORT PDF (invoice + optional WH certificate)
async function exportCurrentPDF(){
  readInputs();
  computeTotals();

  const assets  = window.SoukElMeuble?.assets || {};
  const htmlInv = window.PDFView.build(state, assets);
  const cssInv  = window.PDFView.css;

  const invNum    = slugForFile(state.meta.number || "");
  const typeLabel = docTypeLabel(state.meta.docType);
  const fileName  = ensurePdfExt([typeLabel, invNum].filter(Boolean).join(" "));

  const resInv = await window.SoukElMeuble?.exportPDFFromHTML?.({
    html: htmlInv, css: cssInv,
    meta: { number: state.meta.number, type: state.meta.docType, filename: fileName, deferOpen: true }
  });
  if (!resInv) return;

  let resWH = null;
  if (state.meta?.withholding?.enabled && window.PDFWH) {
    const htmlWH = window.PDFWH.build(state, assets);
    const cssWH  = window.PDFWH.css;
    const baseWH = ensurePdfExt(invNum ? `Retenue à la source - ${invNum}` : `Retenue à la source`);
    resWH = await window.SoukElMeuble?.exportPDFFromHTML?.({
      html: htmlWH, css: cssWH,
      meta: { number: state.meta.number, type: "retenue", filename: baseWH, deferOpen: true }
    });
  }

  const invLabel = resInv?.name || fileName;
  const whLabel  = resWH ? (resWH?.name || "Retenue à la source.pdf") : null;

  const msg =
    "PDF exporté : " + invLabel +
    (whLabel ? "\nCertificat exporté : " + whLabel : "");

  const okBtnText = (() => {
    const t = String(state.meta.docType || "").toLowerCase();
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

