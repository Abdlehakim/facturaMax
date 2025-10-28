// gestionFacture/InvoiceExtrasController.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  if (SEM.__invoiceExtrasControllerReady) return;
  SEM.__invoiceExtrasControllerReady = true;

  const state = () => SEM.state;
  const getEl =
    w.getEl ||
    ((id) => (typeof document === "undefined" ? null : document.getElementById(id)));
  const setVal =
    w.setVal ||
    ((id, v) => {
      const el = getEl(id);
      if (el) el.value = v;
    });
  const setText =
    w.setText ||
    ((id, text) => {
      const el = getEl(id);
      if (el) el.textContent = text;
    });
  const formatMoney =
    w.formatMoney ||
    ((value, currency) => {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
        }).format(Number(value) || 0);
      } catch {
        const n = Number(value || 0);
        return `${Number.isFinite(n) ? n.toFixed(2) : "0.00"} ${currency}`.trim();
      }
    });

  function setBlockDisplay(id, on) {
    const el = getEl(id);
    if (el) el.style.display = on ? "grid" : "none";
  }

  function forceExtrasVisibility() {
    setBlockDisplay("fodecFields", !!getEl("fodecEnabled")?.checked);
    setBlockDisplay("shipFields", !!getEl("shipEnabled")?.checked);
    setBlockDisplay("stampFields", !!getEl("stampEnabled")?.checked);
    const whOn = !!getEl("whEnabled")?.checked;
    const whFields = getEl("whFields");
    if (whFields) whFields.style.display = whOn ? "grid" : "none";
  }

  function updateWHAmountPreview() {
    const totals = SEM.computeTotalsReturn?.();
    const currency = state().meta.currency || "TND";
    const whAmount = totals?.whAmount ?? 0;
    setVal("whAmount", formatMoney(whAmount, currency));
    const lbl = state().meta.withholding?.label?.trim() || "Retenue a la source";
    setText("miniWHLabel", lbl);
  }

  function formatRateLabel(rate) {
    const abs = Math.abs(Number(rate || 0));
    if (Number.isInteger(abs)) return `${abs}%`;
    return `${String(abs).replace(/\.?0+$/, "")}%`;
  }

  function updateExtrasMiniRows() {
    const st = state();
    const cur = st.meta.currency || "TND";
    const ex = st.meta.extras || {};
    const totals = SEM.computeTotalsReturn?.() || { extras: {} };

    const shipEnabled = !!ex.shipping?.enabled;
    const shipTT = shipEnabled
      ? (Number(ex.shipping.amount || 0) * (1 + Number(ex.shipping.tva || 0) / 100))
      : 0;
    setText("miniShipLabel", ex.shipping?.label?.trim() || "Frais de livraison");
    setText("miniShip", formatMoney(shipTT, cur));
    const shipRow = getEl("miniShipRow");
    if (shipRow) shipRow.style.display = shipEnabled ? "" : "none";

    const stampEnabled = !!ex.stamp?.enabled;
    const stampTT = stampEnabled
      ? (Number(ex.stamp.amount || 0) * (1 + Number(ex.stamp.tva || 0) / 100))
      : 0;
    setText("miniStampLabel", ex.stamp?.label?.trim() || "Timbre fiscal");
    setText("miniStamp", formatMoney(stampTT, cur));
    const stampRow = getEl("miniStampRow");
    if (stampRow) stampRow.style.display = stampEnabled ? "" : "none";

    const f = ex.fodec || {};
    const fEnabled = !!f.enabled;
    const miniRow = getEl("miniFODECRow");
    const miniLbl = getEl("miniFODECLabel");
    const miniVal = getEl("miniFODEC");
    if (miniRow) miniRow.style.display = fEnabled ? "" : "none";
    const label = (f.label || "FODEC").trim();
    const rateLabel = formatRateLabel(f.rate || 0);
    if (miniLbl) miniLbl.textContent = fEnabled ? `${label} (${rateLabel})` : label;
    if (miniVal) miniVal.textContent = formatMoney(totals.extras?.fodecHT || 0, cur);

    const fodecAuto = getEl("fodecAmount");
    if (fodecAuto) {
      fodecAuto.value = fEnabled ? formatMoney(totals.extras?.fodecHT || 0, cur) : "";
    }
  }

  SEM.forceExtrasVisibility = forceExtrasVisibility;
  SEM.toggleWHFields = (on) => setBlockDisplay("whFields", on);
  SEM.toggleShipFields = (on) => setBlockDisplay("shipFields", on);
  SEM.toggleStampFields = (on) => setBlockDisplay("stampFields", on);
  SEM.toggleFodecFields = (on) => setBlockDisplay("fodecFields", on);
  SEM.updateWHAmountPreview = updateWHAmountPreview;
  SEM.updateExtrasMiniRows = updateExtrasMiniRows;

  SEM.updateClientIdPlaceholder = function updateClientIdPlaceholder() {
    const typeSel = getEl("clientType");
    const type = (typeSel?.value || state().client?.type || "societe").toLowerCase();
    const idInput = getEl("clientVat");
    if (idInput) idInput.placeholder = type === "particulier" ? "CIN ou Passeport" : "XXXXXXXXX";
  };
})(window);
