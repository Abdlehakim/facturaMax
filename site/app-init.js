// ───────── app-init.js ─────────
(function (w) {
  const SEM = (w.SEM = w.SEM || {});

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
        suppressNextMouseUp = true; firstClickDone = true;
      } else {
        suppressNextMouseUp = false;
      }
    });
    input.addEventListener("mouseup", (e) => {
      if (suppressNextMouseUp) { e.preventDefault(); suppressNextMouseUp = false; }
    }, true);
    input.addEventListener("blur", () => { firstClickDone = false; suppressNextMouseUp = false; });
  }

  function killOverlays(){
    document.body.classList.remove("printing","print-mode");
    const pdfRoot = document.getElementById("pdfRoot");
    if (pdfRoot) {
      pdfRoot.style.display = "none";
      pdfRoot.style.pointerEvents = "none";
      pdfRoot.setAttribute("aria-hidden","true");
    }
  }
  function unlockAddInputs(){
    ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach(id=>{
      const el = getEl(id);
      if (el) { el.disabled = false; el.readOnly = false; }
    });
  }
  function recoverFocus(){ killOverlays(); try { window.focus(); } catch {} unlockAddInputs(); }
  function installFocusGuards(){
    const handler = () => recoverFocus();
    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("keydown", handler, true);
    document.addEventListener("focusin", handler, true);
    window.addEventListener("focus", recoverFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverFocus();
    });
  }

  function init(){
    if (!SEM.COMPANY_LOCKED && typeof SEM.loadCompanyFromLocal === "function") {
      SEM.loadCompanyFromLocal();
    }

    if (typeof SEM.bind === "function") SEM.bind();
    if (typeof SEM.wireLiveBindings === "function") SEM.wireLiveBindings();
    if (typeof SEM.setSubmitMode === "function") SEM.setSubmitMode("add");

    installFocusGuards();

    ["addPrice", "addQty", "addTva", "addDiscount"]
      .forEach(id => enableFirstClickSelectSecondClickCaret(getEl(id)));

    getEl("btnNew")?.addEventListener("click", () => {
      if (typeof SEM.newInvoice === "function") SEM.newInvoice();
      if (typeof SEM.clearAddFormAndMode === "function") SEM.clearAddFormAndMode();
      if (typeof SEM.bind === "function") SEM.bind();
    });

    getEl("btnOpen")?.addEventListener("click", () => {
      if (typeof onOpenInvoiceClick === "function") onOpenInvoiceClick();
    });

    // Always push DOM -> state before saving
    // ───────── app-init.js (snippet: save button wiring) ─────────
getEl("btnSave")?.addEventListener("click", () => {
  try { window.__includeCompanyForSave = true; } catch {}
  // Make sure inputs are read before capturing:
  if (window.SEM?.readInputs) window.SEM.readInputs();
  else if (typeof readInputs === "function") readInputs();
  saveInvoiceJSON();
});


    getEl("btnPDF")?.addEventListener("click", () => {
      if (typeof exportCurrentPDF === "function") exportCurrentPDF();
    });

    getEl("btnSubmitItem")?.addEventListener("click", () => {
      if (typeof SEM.submitItemForm === "function") SEM.submitItemForm();
    });
    getEl("btnNewItem")?.addEventListener("click", () => {
      if (typeof SEM.clearAddFormAndMode === "function") SEM.clearAddFormAndMode();
    });

    ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach(id=>{
      const el = getEl(id);
      el?.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ e.preventDefault(); if (typeof SEM.submitItemForm === "function") SEM.submitItemForm(); } });
      if (el) {
        el.addEventListener("focus", () => { try { el.select(); } catch {} });
        el.addEventListener("click", () => { try { el.select(); } catch {} });
      }
    });

    getEl("companyLogo")?.addEventListener("click", async () => {
      if (!window.SoukElMeuble?.pickLogo) return;
      const res = await window.SoukElMeuble.pickLogo();
      if (res?.dataUrl) { SEM.state.company.logo = res.dataUrl; setSrc("companyLogo", res.dataUrl); }
    });

    const addFieldset = getEl("addRef")?.closest("fieldset.section-box");
    if (addFieldset) { addFieldset.addEventListener("mousedown", recoverFocus, true); }

    window.SoukElMeuble?.onEnterPrintMode?.(() => {
      window.PDFView?.show?.(SEM.state, window.SoukElMeuble?.assets || {});
    });
    window.SoukElMeuble?.onExitPrintMode?.(() => {
      window.PDFView?.hide?.();
      recoverFocus();
    });

    getEl('colToggleRef')  ?.addEventListener('change', () => { if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding(); });
    getEl('colTogglePrice')?.addEventListener('change', () => { if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding(); });
    if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
  }

  onReady(init);
})(window);
