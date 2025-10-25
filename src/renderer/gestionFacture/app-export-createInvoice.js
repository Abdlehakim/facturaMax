// gestionFacture/app-export-CreateInvoice.js
(function () {
  async function saveInvoiceJSON() {
    if (window.SEM?.readInputs) window.SEM.readInputs();
    else if (typeof readInputs === "function") readInputs();

    const snapshot = (window.SEM?.captureForm
      ? window.SEM.captureForm({ includeCompany: true })
      : captureForm({ includeCompany: true })
    );

    const st = (window.SEM?.state || window.state);

    const typeLbl = docTypeLabel(st.meta.docType);
    const invRaw  = String(st.meta.number || "").trim();
    const invNum  = invRaw ? slugForFile(invRaw) : "";
    const dateStr = slugForFile(st.meta.date || new Date().toISOString().slice(0, 10));
    const base    = invNum ? `${typeLbl} ${invNum} - ${dateStr}` : `${typeLbl} ${dateStr}`;
    const filename = ensureJsonExt(base || "Document");

    if (window.SoukElMeuble?.saveInvoiceJSON) {
      try {
        const res = await window.SoukElMeuble.saveInvoiceJSON({
          ...snapshot,
          meta: snapshot.meta || {},
          filename,
        });
        if (res && res.path) {
          await showDialog("Document enregistre :\n" + res.path, { title: "Enregistrer" });
        } else {
          await showDialog("Enregistrement annule.", { title: "Enregistrer" });
        }
      } catch {
        await showDialog("Impossible d'enregistrer via l'app. Telechargement via le navigateur...", { title: "Enregistrer" });
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
        downloadBlob(filename, blob);
      }
      return;
    }

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    downloadBlob(filename, blob);
    await showDialog("Fichier telecharge.", { title: "Enregistrer" });
  }

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

  function mergeInvoiceDataIntoState(data){
    if (!data || typeof data !== "object") return;

    const src = data.data && typeof data.data === "object" ? data.data : data;
    const st = (window.SEM?.state || window.state);

    if (src.company) st.company = { ...st.company, ...src.company };
    if (src.client)  st.client  = { ...st.client,  ...src.client  };

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

      st.meta = { ...cur, ...incoming, withholding: mergedWH, extras: mergedExtras };
    }

    if (Array.isArray(src.items)) st.items = src.items.map(x => ({ ...x }));
    if (typeof src.notes === "string") st.notes = src.notes;
  }

  async function onOpenInvoiceClick(){
    let raw = null;
    if (window.SoukElMeuble?.openInvoiceJSON) raw = await window.SoukElMeuble.openInvoiceJSON();
    else raw = await openInvoiceFromFilePicker();
    if (!raw) return;

    mergeInvoiceDataIntoState(raw);

    const st = (window.SEM?.state || window.state);
    const data = raw.data && typeof raw.data === "object" ? raw.data : raw;
    if (!data.company && st.company && !st.company.logo) {
      st.company.logo = getEl("companyLogo")?.src || st.company.logo || "";
    }

    (window.SEM?.bind ? window.SEM.bind() : bind());
  }

  async function exportCurrentPDF(){
    (window.SEM?.readInputs ? window.SEM.readInputs() : readInputs());
    (window.SEM?.computeTotals ? window.SEM.computeTotals() : computeTotals());

    const st = (window.SEM?.state || window.state);
    const assets  = window.SoukElMeuble?.assets || {};
    const htmlInv = window.PDFView.build(st, assets);
    const cssInv  = window.PDFView.css;

    const typeLbl = docTypeLabel(st.meta.docType);
    const invRaw  = String(st.meta.number || "").trim();
    const invNum  = invRaw ? slugForFile(invRaw) : "";
    const dateStr = slugForFile(st.meta.date || new Date().toISOString().slice(0, 10));
    const base    = invNum ? `${typeLbl} ${invNum} - ${dateStr}` : `${typeLbl} ${dateStr}`;
    const fileName = ensurePdfExt(base);

    const resInv = await window.SoukElMeuble?.exportPDFFromHTML?.({
      html: htmlInv,
      css: cssInv,
      meta: { number: st.meta.number, docType: st.meta.docType, filename: fileName, deferOpen: true }
    });
    if (!resInv || resInv.ok !== true) return;

    let resWH = null;
    if (st.meta?.withholding?.enabled && window.PDFWH) {
      const htmlWH = window.PDFWH.build(st, assets);
      const cssWH  = window.PDFWH.css;
      const baseWH = ensurePdfExt(`${base} - Retenue a la source`);
      const tryWH = await window.SoukElMeuble?.exportPDFFromHTML?.({
        html: htmlWH,
        css: cssWH,
        meta: { number: st.meta.number, docType: "retenue", filename: baseWH, deferOpen: true }
      });
      if (tryWH && tryWH.ok === true) resWH = tryWH;
    }

    const invLabel = resInv?.name || fileName;
    const whLabel  = resWH ? (resWH?.name || "Retenue a la source.pdf") : null;

    const msg =
      "PDF exporte : " + invLabel +
      (whLabel ? "\nCertificat exporte : " + whLabel : "");

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

  window.saveInvoiceJSON = saveInvoiceJSON;
  window.openInvoiceFromFilePicker = openInvoiceFromFilePicker;
  window.mergeInvoiceDataIntoState = mergeInvoiceDataIntoState;
  window.onOpenInvoiceClick = onOpenInvoiceClick;
  window.exportCurrentPDF = exportCurrentPDF;
})();
