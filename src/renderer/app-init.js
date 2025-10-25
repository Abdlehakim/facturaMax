(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  if (SEM.__CORE_INIT_DONE) return;
  SEM.__CORE_INIT_DONE = true;

  const IS_DESKTOP = !!(w.SoukElMeuble && (w.SoukElMeuble.isDesktop ?? true));
  SEM.IS_DESKTOP = IS_DESKTOP;
  SEM.WEB_FS_DISABLED = IS_DESKTOP;

  if (w.pdfjsLib && pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdfs/pdf.worker.min.js";

  const getEl = w.getEl || function (id) { return document.getElementById(id); };

  function killOverlays() {
    document.body.classList.remove("printing", "print-mode");
    const pdfRoot = document.getElementById("pdfRoot");
    if (pdfRoot) { pdfRoot.style.display = "none"; pdfRoot.style.pointerEvents = "none"; pdfRoot.setAttribute("aria-hidden", "true"); }
  }
  function unlockAddInputs() { ["addRef","addProduct","addDesc","addQty","addPrice","addTva","addDiscount"].forEach((id)=>{ const el = getEl(id); if (el) { el.disabled = false; el.readOnly = false; } }); }
  function recoverFocus() { killOverlays(); try { window.focus(); } catch {} unlockAddInputs(); }
  function installFocusGuards() {
    const handler = () => recoverFocus();
    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("keydown", handler, true);
    document.addEventListener("focusin", handler, true);
    window.addEventListener("focus", recoverFocus);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recoverFocus(); });
  }
  SEM.recoverFocus = recoverFocus;

  function wirePrintHooks() {
    w.SoukElMeuble?.onEnterPrintMode?.(() => { try { w.PDFView?.show?.(SEM.state, w.SoukElMeuble?.assets || {}); } catch {} });
    w.SoukElMeuble?.onExitPrintMode?.(() => { try { w.PDFView?.hide?.(); } catch {} recoverFocus(); });
  }

  function safeLoadCompany() { if (!SEM.COMPANY_LOCKED && typeof SEM.loadCompanyFromLocal === "function") { try { SEM.loadCompanyFromLocal(); } catch {} } }
  function safeBind() { try { if (typeof SEM.bind === "function") SEM.bind(); if (typeof SEM.wireLiveBindings === "function") SEM.wireLiveBindings(); if (typeof SEM.setSubmitMode === "function") SEM.setSubmitMode("add"); } catch {} }

  function wireLightGlobalActions() {
    ["colToggleRef","colTogglePrice","colToggleProduct","colToggleDesc","colToggleQty","colToggleTva","colToggleDiscount"].forEach((id) => getEl(id)?.addEventListener("change", () => { if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding(); }));
    if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    getEl("companyLogo")?.addEventListener("click", async () => {
      if (!w.SoukElMeuble?.pickLogo) return;
      const res = await w.SoukElMeuble.pickLogo();
      if (res?.dataUrl) {
        SEM.state = SEM.state || {};
        SEM.state.company = SEM.state.company || {};
        SEM.state.company.logo = res.dataUrl;
        const setSrc = w.setSrc || ((id, v) => { const el = getEl(id); if (el) el.src = v; });
        setSrc("companyLogo", res.dataUrl);
      }
    });
  }

  function init() {
    installFocusGuards();
    wirePrintHooks();
    safeLoadCompany();
    safeBind();
    const yearEl = document.getElementById("year"); if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    wireLightGlobalActions();
  }

  const onReady = w.onReady || function (fn) { if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", fn, { once: true }); } else { fn(); } };
  onReady(init);
})(window);
