// ───────── app-state.js 
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  const IS_DESKTOP = !!(w.SoukElMeuble && (w.SoukElMeuble.isDesktop ?? true));
  SEM.IS_DESKTOP = IS_DESKTOP;
  SEM.IS_WEB = !IS_DESKTOP;

  const getEl  = w.getEl  || ((id) => document.getElementById(id));
  const setVal = w.setVal || ((id, v) => { const el = getEl(id); if (el) el.value = v; });
  const getStr = w.getStr || ((id, def = "") => { const el = getEl(id); return el ? String(el.value ?? "").trim() : def; });
  const getNum = w.getNum || ((id, def = 0) => {
    const el = getEl(id); if (!el) return def;
    const raw = String(el.value ?? "").replace(",", ".").trim();
    const n = Number(raw); return Number.isFinite(n) ? n : def;
  });

  if (typeof SEM.COMPANY_LOCKED === "undefined") SEM.COMPANY_LOCKED = true;

  SEM.saveCompanyToLocal = function () {
    if (SEM.COMPANY_LOCKED) return;
    try { localStorage.setItem("swb_company", JSON.stringify(SEM.state?.company || {})); } catch {}
  };

  SEM.loadCompanyFromLocal = function () {
    if (SEM.COMPANY_LOCKED) return;
    try {
      const c = JSON.parse(localStorage.getItem("swb_company") || "null");
      if (c && typeof c === "object") {
        SEM.state = SEM.state || {};
        SEM.state.company = { ...(SEM.state.company || {}), ...c };
      }
    } catch {}
  };

  if (typeof SEM.bind !== "function") {
    SEM.bind = function () {};
  }

  SEM.applyColumnHiding = SEM.applyColumnHiding || function () {};
})(window);
