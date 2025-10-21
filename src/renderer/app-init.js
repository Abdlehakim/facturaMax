// ───────── app-init.js (DESKTOP/ELECTRON) ─────────
(function (w) {
  const SEM = (w.SEM = w.SEM || {});

  // pdf.js worker (for PDF stamp import inside renderer)
  if (w.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdfs/pdf.worker.min.js";
  }

  // ——— Column toggle map ———
  const fieldToggleMap = {
    ref: "colToggleRef",
    product: "colToggleProduct",
    desc: "colToggleDesc",
    qty: "colToggleQty",
    price: "colTogglePrice",
    tva: "colToggleTva",
    discount: "colToggleDiscount",
  };

  // ============== FORM HELPERS ==============
  function isEnabled(key) {
    const el = getEl(fieldToggleMap[key]);
    if (!el) return true;
    return !!el.checked;
  }
  function setEnabled(key, enabled) {
    const el = getEl(fieldToggleMap[key]);
    if (!el) return;
    el.checked = !!enabled;
  }

  function captureArticleFromForm() {
    const use = {
      ref: isEnabled("ref"),
      product: isEnabled("product"),
      desc: isEnabled("desc"),
      qty: isEnabled("qty"),
      price: isEnabled("price"),
      tva: isEnabled("tva"),
      discount: isEnabled("discount"),
    };
    return {
      ref: getStr("addRef"),
      product: getStr("addProduct"),
      desc: getStr("addDesc"),
      qty: getNum("addQty", 1),
      price: getNum("addPrice", 0),
      tva: getNum("addTva", 19),
      discount: getNum("addDiscount", 0),
      use,
    };
  }
  function fillArticleToForm(a = {}) {
    setVal("addRef", a.ref ?? "");
    setVal("addProduct", a.product ?? "");
    setVal("addDesc", a.desc ?? "");
    setVal("addQty", String(a.qty ?? 1));
    setVal("addPrice", String(a.price ?? 0));
    setVal("addTva", String(a.tva ?? 19));
    setVal("addDiscount", String(a.discount ?? 0));
    if (a.use && typeof a.use === "object") {
      Object.keys(fieldToggleMap).forEach((k) => {
        const enabled = a.use[k];
        if (typeof enabled === "boolean") setEnabled(k, enabled);
      });
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    }
  }
  function pickSuggestedName(a) {
    const u = { ref: isEnabled("ref"), product: isEnabled("product"), desc: isEnabled("desc") };
    const ref = String(a.ref || "").trim();
    const product = String(a.product || "").trim();
    const desc = String(a.desc || "").trim();
    const first = (u.ref && ref) || (u.product && product) || (u.desc && desc) || "article";
    return first;
  }

  // ===== Clients (capture + naming) =====
  function captureClientFromForm() {
    return {
      type: getStr("clientType"),
      name: getStr("clientName"),
      vat: getStr("clientVat"),
      phone: getStr("clientPhone"),
      email: getStr("clientEmail"),
      address: getStr("clientAddress"),
    };
  }
  function fillClientToForm(c = {}) {
    setVal("clientType", c.type ?? "societe");
    setVal("clientName", c.name ?? "");
    setVal("clientVat", c.vat ?? "");
    setVal("clientPhone", c.phone ?? "");
    setVal("clientEmail", c.email ?? "");
    setVal("clientAddress", c.address ?? "");
    if (typeof SEM.updateClientIdLabel === "function") SEM.updateClientIdLabel();
  }
  function safeClientName(s = "client") {
    return String(s).trim().replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 80) || "client";
  }
  function pickSuggestedClientName(c) {
    const n = String(c.name || "").trim();
    const v = String(c.vat || "").trim();
    const e = String(c.email || "").trim();
    const p = String(c.phone || "").trim();
    return safeClientName(n || v || e || p || "client");
  }

  // ============== UI FOCUS GUARDS ==============
  function enableFirstClickSelectSecondClickCaret(input) {
    if (!input) return;
    let suppressNextMouseUp = false;
    let firstClickDone = false;
    input.addEventListener("mousedown", () => {
      if (document.activeElement !== input || !firstClickDone) {
        setTimeout(() => {
          input.select();
          try { input.setSelectionRange(0, input.value.length); } catch {}
        }, 0);
        suppressNextMouseUp = true;
        firstClickDone = true;
      } else {
        suppressNextMouseUp = false;
      }
    });
    input.addEventListener("mouseup", (e) => {
      if (suppressNextMouseUp) { e.preventDefault(); suppressNextMouseUp = false; }
    }, true);
    input.addEventListener("blur", () => {
      firstClickDone = false;
      suppressNextMouseUp = false;
    });
  }

  function killOverlays() {
    document.body.classList.remove("printing", "print-mode");
    const pdfRoot = document.getElementById("pdfRoot");
    if (pdfRoot) {
      pdfRoot.style.display = "none";
      pdfRoot.style.pointerEvents = "none";
      pdfRoot.setAttribute("aria-hidden", "true");
    }
  }
  function unlockAddInputs() {
    ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach((id) => {
      const el = getEl(id);
      if (el) { el.disabled = false; el.readOnly = false; }
    });
  }
  function recoverFocus() {
    killOverlays();
    try { window.focus(); } catch {}
    unlockAddInputs();
  }
  function installFocusGuards() {
    const handler = () => recoverFocus();
    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("keydown", handler, true);
    document.addEventListener("focusin", handler, true);
    window.addEventListener("focus", recoverFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverFocus();
    });
  }

  // ============== INIT ==============
  function init() {
    if (!SEM.COMPANY_LOCKED && typeof SEM.loadCompanyFromLocal === "function") {
      SEM.loadCompanyFromLocal();
    }
    if (typeof SEM.bind === "function") SEM.bind();
    if (typeof SEM.wireLiveBindings === "function") SEM.wireLiveBindings();
    if (typeof SEM.setSubmitMode === "function") SEM.setSubmitMode("add");

    installFocusGuards();
    ["addPrice", "addQty", "addTva", "addDiscount"].forEach((id) =>
      enableFirstClickSelectSecondClickCaret(getEl(id))
    );

    // ===== Toolbar
    getEl("btnOpen")?.addEventListener("click", () => {
      if (typeof onOpenInvoiceClick === "function") onOpenInvoiceClick();
    });

    getEl("btnSave")?.addEventListener("click", async () => {
      try { window.__includeCompanyForSave = true; } catch {}
      if (w.SEM?.readInputs) w.SEM.readInputs();
      else if (typeof readInputs === "function") readInputs();
      // Use Electron bridge for JSON invoice save (shows system dialog; cancel-safe)
      const payload = { data: SEM.captureForm?.({ includeCompany: true }) || null };
      const res = await window.SoukElMeuble.saveInvoiceJSON(payload);
      if (res?.ok) await showDialog("Facture enregistrée.", { title: "Succès" });
    });

    getEl("btnPDF")?.addEventListener("click", () => {
      if (typeof exportCurrentPDF === "function") exportCurrentPDF();
    });

    // ===== Items form actions
    getEl("btnSubmitItem")?.addEventListener("click", () => {
      if (typeof SEM.submitItemForm === "function") SEM.submitItemForm();
    });
    getEl("btnNewItem")?.addEventListener("click", () => {
      if (typeof SEM.clearAddFormAndMode === "function") SEM.clearAddFormAndMode();
    });

    // Enter-to-submit in add fields
    ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach((id) => {
      const el = getEl(id);
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (typeof SEM.submitItemForm === "function") SEM.submitItemForm();
        }
      });
      if (el) {
        el.addEventListener("focus", () => { try { el.select(); } catch {} });
        el.addEventListener("click", () => { try { el.select(); } catch {} });
      }
    });

    // ===== Logo picker (desktop)
    getEl("companyLogo")?.addEventListener("click", async () => {
      if (!window.SoukElMeuble?.pickLogo) return;
      const res = await window.SoukElMeuble.pickLogo();
      if (res?.dataUrl) {
        SEM.state.company.logo = res.dataUrl;
        setSrc("companyLogo", res.dataUrl);
      }
    });

    // Keep add form inputs focusable even after print overlay
    const addFieldset = getEl("addRef")?.closest("fieldset.section-box");
    if (addFieldset) addFieldset.addEventListener("mousedown", recoverFocus, true);

    // Print hooks (desktop)
    window.SoukElMeuble?.onEnterPrintMode?.(() => {
      window.PDFView?.show?.(SEM.state, window.SoukElMeuble?.assets || {});
    });
    window.SoukElMeuble?.onExitPrintMode?.(() => {
      window.PDFView?.hide?.();
      recoverFocus();
    });

    // Column visibility
    ["colToggleRef","colTogglePrice","colToggleProduct","colToggleDesc","colToggleQty","colToggleTva","colToggleDiscount"]
      .forEach(id => getEl(id)?.addEventListener("change", () => {
        if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
      }));
    if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();

    // ===== Articles (use Electron dialogs)
    getEl("btnSaveArticle")?.addEventListener("click", async () => {
      const article = captureArticleFromForm();
      const hasProduct = article.use?.product && String(article.product || "").trim().length > 0;
      const hasDesc    = article.use?.desc    && String(article.desc    || "").trim().length > 0;
      if (!hasProduct && !hasDesc) {
        await showDialog("Veuillez saisir au moins un Produit ou une Description.", { title: "Article incomplet" });
        return;
      }
      const suggested = pickSuggestedName(article);
      const res = await window.SoukElMeuble.saveArticle({ article, suggestedName: suggested });
      if (res?.ok) await showDialog("Article enregistré.", { title: "Succès" });
      else if (!res?.canceled) await showDialog(res?.error || "Échec de l’enregistrement.", { title: "Erreur" });
    });

    getEl("btnLoadArticle")?.addEventListener("click", async () => {
      try {
        const data = await window.SoukElMeuble.openArticle();
        if (data) {
          fillArticleToForm(data);
          getEl("addProduct")?.focus();
        }
      } catch {
        await showDialog("Ouverture impossible.", { title: "Erreur" });
      }
    });

    // ===== Clients (Program Files\FacturaMax\Clients – via Electron)
    getEl("btnSaveClient")?.addEventListener("click", async () => {
      const client = captureClientFromForm();
      if (!client.name && !client.email && !client.phone) {
        await showDialog("Veuillez saisir au moins un Nom, un E-mail ou un Téléphone.", { title: "Client incomplet" });
        return;
      }
      const suggested = pickSuggestedClientName(client);

      if (window.SoukElMeuble?.ensureClientsSystemFolder && window.SoukElMeuble?.saveClientDirect) {
        const ensured = await window.SoukElMeuble.ensureClientsSystemFolder();
        if (!ensured?.ok) {
          await showDialog(ensured?.message || "Impossible de préparer le dossier Clients (droits administrateur requis).", { title: "Erreur" });
          return;
        }
        const res = await window.SoukElMeuble.saveClientDirect({ client, suggestedName: suggested });
        if (res?.ok) {
          await showDialog("Client enregistré.", { title: "Succès" });
        } else if (res?.canceled) {
          // user canceled the dialog -> no message
        } else {
          await showDialog(res?.error || "Échec de l’enregistrement du client.", { title: "Erreur" });
        }
        return;
      }

      // Should not happen in desktop, but keep a graceful fallback (browser-style)
      await showDialog("Fonctionnalité indisponible dans cette version.", { title: "Info" });
    });

    getEl("btnLoadClient")?.addEventListener("click", async () => {
      // No dedicated IPC to pick from Clients folder; keep a simple file picker fallback.
      try {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = ".json,application/json";
        inp.onchange = async () => {
          const f = inp.files?.[0];
          if (!f) return;
          const txt = await f.text();
          const c = JSON.parse(txt);
          fillClientToForm(c || {});
        };
        inp.click();
      } catch {
        await showDialog("Ouverture impossible.", { title: "Erreur" });
      }
    });
  }

  onReady(init);
})(window);
