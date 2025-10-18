// ───────── app-init.js ─────────
(function (w) {
  const SEM = (w.SEM = w.SEM || {});

  // If pdf.js is present (used for importing cachet from PDF), point to local worker
  if (w.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdfs/pdf.worker.min.js";
  }

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

    input.addEventListener(
      "mouseup",
      (e) => {
        if (suppressNextMouseUp) {
          e.preventDefault();
          suppressNextMouseUp = false;
        }
      },
      true
    );

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
    [
      "addRef",
      "addProduct",
      "addDesc",
      "addQty",
      "addPrice",
      "addTva",
      "addDiscount",
    ].forEach((id) => {
      const el = getEl(id);
      if (el) {
        el.disabled = false;
        el.readOnly = false;
      }
    });
  }

  function recoverFocus() {
    killOverlays();
    try {
      window.focus();
    } catch {}
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

  function init() {
    // Load saved company (if not locked)
    if (!SEM.COMPANY_LOCKED && typeof SEM.loadCompanyFromLocal === "function") {
      SEM.loadCompanyFromLocal();
    }

    // Initial binding + listeners
    if (typeof SEM.bind === "function") SEM.bind();
    if (typeof SEM.wireLiveBindings === "function") SEM.wireLiveBindings();
    if (typeof SEM.setSubmitMode === "function") SEM.setSubmitMode("add");

    installFocusGuards();

    // Numeric inputs: select-on-first-click, caret-on-second
    ["addPrice", "addQty", "addTva", "addDiscount"].forEach((id) =>
      enableFirstClickSelectSecondClickCaret(getEl(id))
    );

    // New document
    getEl("btnNew")?.addEventListener("click", () => {
      if (typeof SEM.newInvoice === "function") SEM.newInvoice();
      if (typeof SEM.clearAddFormAndMode === "function")
        SEM.clearAddFormAndMode();
      if (typeof SEM.bind === "function") SEM.bind();
    });

    // Open document
    getEl("btnOpen")?.addEventListener("click", () => {
      if (typeof onOpenInvoiceClick === "function") onOpenInvoiceClick();
    });

    // Save JSON (always read inputs first so state is up-to-date)
    getEl("btnSave")?.addEventListener("click", () => {
      try {
        window.__includeCompanyForSave = true;
      } catch {}
      if (w.SEM?.readInputs) w.SEM.readInputs();
      else if (typeof readInputs === "function") readInputs();
      saveInvoiceJSON();
    });

    // Export PDF
    getEl("btnPDF")?.addEventListener("click", () => {
      if (typeof exportCurrentPDF === "function") exportCurrentPDF();
    });

    // Add/Update item
    getEl("btnSubmitItem")?.addEventListener("click", () => {
      if (typeof SEM.submitItemForm === "function") SEM.submitItemForm();
    });

    // New item form
    getEl("btnNewItem")?.addEventListener("click", () => {
      if (typeof SEM.clearAddFormAndMode === "function")
        SEM.clearAddFormAndMode();
    });

    // Enter to submit item, select-on-focus
    [
      "addRef",
      "addProduct",
      "addDesc",
      "addQty",
      "addPrice",
      "addTva",
      "addDiscount",
    ].forEach((id) => {
      const el = getEl(id);
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (typeof SEM.submitItemForm === "function") SEM.submitItemForm();
        }
      });
      if (el) {
        el.addEventListener("focus", () => {
          try {
            el.select();
          } catch {}
        });
        el.addEventListener("click", () => {
          try {
            el.select();
          } catch {}
        });
      }
    });

    // Logo picker (desktop app)
    getEl("companyLogo")?.addEventListener("click", async () => {
      if (!window.SoukElMeuble?.pickLogo) return;
      const res = await window.SoukElMeuble.pickLogo();
      if (res?.dataUrl) {
        SEM.state.company.logo = res.dataUrl;
        setSrc("companyLogo", res.dataUrl);
      }
    });

    // Keep focus when clicking inside "Ajouter un article"
    const addFieldset = getEl("addRef")?.closest("fieldset.section-box");
    if (addFieldset) {
      addFieldset.addEventListener("mousedown", recoverFocus, true);
    }

    // Print mode hooks (desktop app)
    window.SoukElMeuble?.onEnterPrintMode?.(() => {
      window.PDFView?.show?.(SEM.state, window.SoukElMeuble?.assets || {});
    });
    window.SoukElMeuble?.onExitPrintMode?.(() => {
      window.PDFView?.hide?.();
      recoverFocus();
    });

    // Column visibility toggles
    getEl("colToggleRef")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    getEl("colTogglePrice")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
  }

  onReady(init);
})(window);
