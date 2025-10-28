// gestionFacture/app-bindings-CreateInvoice.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
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
  const setSrc =
    w.setSrc ||
    ((id, value) => {
      const el = getEl(id);
      if (el) el.src = value;
    });
  const getStr =
    w.getStr ||
    ((id, def = "") => {
      const el = getEl(id);
      return el ? String(el.value ?? "").trim() : def;
    });
  const getNum =
    w.getNum ||
    ((id, def = 0) => {
      const el = getEl(id);
      if (!el) return def;
      const value = Number(el.value);
      return Number.isFinite(value) ? value : def;
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

  SEM.setupInvoiceItemSearch?.(w);

  SEM.bind = function bind() {
    const st = state();
    st.items = Array.isArray(st.items) ? st.items : [];

    [
      ["companyName", "name"],
      ["companyVat", "vat"],
      ["companyPhone", "phone"],
      ["companyEmail", "email"],
      ["companyAddress", "address"],
    ].forEach(([id, key]) => {
      const el = getEl(id);
      if (!el) return;
      el.value = st.company[key] || "";
      if (SEM.COMPANY_LOCKED) {
        el.readOnly = true;
        el.classList.add("locked");
        el.setAttribute("tabindex", "-1");
      }
    });

    const seal = st.company?.seal || {};
    const sealCb = getEl("sealEnabled");
    if (sealCb) sealCb.checked = !!seal.enabled;
    SEM.toggleSealFields?.(!!seal.enabled);
    SEM.refreshSealPreview?.();

    setVal("docType", st.meta.docType || "facture");
    setVal("invNumber", st.meta.number);
    setVal("invDate", st.meta.date);
    setVal("invDue", st.meta.due);

    setVal("clientType", st.client.type || "societe");
    setVal("clientName", st.client.name);
    setVal("clientEmail", st.client.email);
    setVal("clientPhone", st.client.phone);
    setVal("clientVat", st.client.vat);
    setVal("clientAddress", st.client.address);

    const wh = st.meta.withholding || {
      enabled: false,
      rate: 1.5,
      base: "ht",
      label: "Retenue a la source",
      threshold: 1000,
    };
    if (getEl("whEnabled")) getEl("whEnabled").checked = !!wh.enabled;
    setVal("whRate", String(wh.rate ?? 1.5));
    setVal("whBase", String(wh.base ?? "ht"));
    setVal("whLabel", String(wh.label ?? "Retenue a la source"));
    setVal("whThreshold", String(wh.threshold ?? 0));

    const ex = st.meta.extras || {};
    const shipping = ex.shipping || {};
    const stamp = ex.stamp || {};
    const fodec = ex.fodec || {};

    if (getEl("shipEnabled")) getEl("shipEnabled").checked = !!shipping.enabled;
    setVal("shipLabel", String(shipping.label ?? "Frais de livraison"));
    setVal("shipAmount", String(shipping.amount ?? 7));
    setVal("shipTva", String(shipping.tva ?? 19));

    if (getEl("stampEnabled")) getEl("stampEnabled").checked = !!stamp.enabled;
    setVal("stampLabel", String(stamp.label ?? "Timbre fiscal"));
    setVal("stampAmount", String(stamp.amount ?? 1));
    setVal("stampTva", String(stamp.tva ?? 0));

    if (getEl("fodecEnabled")) getEl("fodecEnabled").checked = !!fodec.enabled;
    setVal("fodecLabel", String(fodec.label ?? "FODEC"));
    setVal("fodecRate", String(fodec.rate ?? 1));
    setVal("fodecBase", String(fodec.base ?? "ht"));
    setVal("fodecTva", String(fodec.tva ?? 19));

    SEM.forceExtrasVisibility?.();

    const bundled = "./assets/logoIMG.png";
    const logo = w.SoukElMeuble?.assets?.logo || st.company.logo || bundled;
    setSrc("companyLogo", logo);
    if (!st.company.logo) st.company.logo = bundled;

    setVal("notes", st.notes);
    setText("year", new Date().getFullYear());

    [
      "colToggleRef",
      "colToggleProduct",
      "colToggleDesc",
      "colToggleQty",
      "colTogglePrice",
      "colToggleTva",
      "colToggleDiscount",
    ].forEach((id) => {
      const el = getEl(id);
      if (el && el.checked === false) el.checked = true;
    });

    SEM.wireColumnToggles?.();
    SEM.renderItems?.();
    SEM.computeTotals?.();
    SEM.applyColumnHiding?.();
    SEM.updateWHAmountPreview?.();
    SEM.updateExtrasMiniRows?.();
    SEM.updateClientIdPlaceholder?.();
  };

  SEM.computeTotals = function computeTotals() {
    SEM.readInputs?.();
    const currency = state().meta.currency || "TND";
    const totals =
      SEM.computeTotalsReturn?.() || {
        totalHT: 0,
        tax: 0,
        totalTTC: 0,
        whAmount: 0,
        net: 0,
        extras: {},
      };

    setText("miniHT", formatMoney(totals.totalHT, currency));
    setText("miniTVA", formatMoney(totals.tax, currency));
    setText("miniTTC", formatMoney(totals.totalTTC, currency));

    const whRow = getEl("miniWHRow");
    const netRow = getEl("miniNETRow");
    const wh = state().meta.withholding || {};
    if (whRow) whRow.style.display = wh.enabled ? "" : "none";
    if (netRow) netRow.style.display = wh.enabled ? "" : "none";
    if (wh.enabled) {
      const label = wh.label?.trim() || "Retenue a la source";
      setText("miniWHLabel", label);
      setText("miniWH", "- " + formatMoney(totals.whAmount, currency));
      setText("miniNET", formatMoney(totals.net, currency));
    }

    const fodecAuto = getEl("fodecAmount");
    const fodecEnabled = !!state().meta.extras?.fodec?.enabled;
    if (fodecAuto) {
      fodecAuto.value = fodecEnabled
        ? formatMoney(totals.extras?.fodecHT || 0, currency)
        : "";
    }

    SEM.updateExtrasMiniRows?.();
  };

  SEM.clearAddFormAndMode = SEM.clearAddFormAndMode || function () {};
  SEM.renderItems = SEM.renderItems || function () {};
  SEM.updateWHAmountPreview = SEM.updateWHAmountPreview || function () {};
  SEM.updateExtrasMiniRows = SEM.updateExtrasMiniRows || function () {};

  SEM.wireLiveBindings = function wireLiveBindings() {
    if (!SEM.COMPANY_LOCKED) {
      const map = [
        ["companyName", (v) => (state().company.name = v)],
        ["companyVat", (v) => (state().company.vat = v)],
        ["companyPhone", (v) => (state().company.phone = v)],
        ["companyEmail", (v) => (state().company.email = v)],
        ["companyAddress", (v) => (state().company.address = v)],
      ];
      map.forEach(([id, setter]) =>
        getEl(id)?.addEventListener("input", () => {
          setter(getStr(id, ""));
          SEM.saveCompanyToLocal?.();
        })
      );
    }

    const sealCb = getEl("sealEnabled");
    if (sealCb) {
      sealCb.addEventListener("change", () => {
        const st = state();
        st.company.seal = st.company.seal || {};
        st.company.seal.enabled = !!sealCb.checked;
        SEM.toggleSealFields?.(st.company.seal.enabled);
        SEM.refreshSealPreview?.();
      });
    }

    const pickBtn = getEl("btnPickSeal");
    if (pickBtn) {
      pickBtn.addEventListener("click", async () => {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = "image/*,application/pdf";
        inp.onchange = async () => {
          const file = inp.files && inp.files[0];
          await SEM.loadSealFromFile?.(file);
        };
        inp.click();
      });
    }

    getEl("docType")?.addEventListener("change", () => {
      state().meta.docType = getStr("docType", state().meta.docType);
    });
    getEl("invNumber")?.addEventListener("input", () => {
      state().meta.number = getStr("invNumber", state().meta.number);
    });
    getEl("invDate")?.addEventListener("input", () => {
      state().meta.date = getStr("invDate", state().meta.date);
    });
    getEl("invDue")?.addEventListener("input", () => {
      state().meta.due = getStr("invDue", state().meta.due);
    });

    document.addEventListener("change", (event) => {
      const targetId = event.target?.id;
      if (targetId === "clientType") {
        state().client.type = getStr("clientType", state().client.type || "societe");
        SEM.updateClientIdPlaceholder?.();
      }
      if (
        targetId === "fodecEnabled" ||
        targetId === "shipEnabled" ||
        targetId === "stampEnabled" ||
        targetId === "whEnabled"
      ) {
        SEM.forceExtrasVisibility?.();
      }
    });
    document.addEventListener("input", (event) => {
      if (event.target?.id === "clientType") {
        state().client.type = getStr("clientType", state().client.type || "societe");
        SEM.updateClientIdPlaceholder?.();
      }
    });

    getEl("clientName")?.addEventListener("input", () => {
      state().client.name = getStr("clientName", state().client.name);
    });
    getEl("clientEmail")?.addEventListener("input", () => {
      state().client.email = getStr("clientEmail", state().client.email);
    });
    getEl("clientPhone")?.addEventListener("input", () => {
      state().client.phone = getStr("clientPhone", state().client.phone);
    });
    getEl("clientVat")?.addEventListener("input", () => {
      state().client.vat = getStr("clientVat", state().client.vat);
    });
    getEl("clientAddress")?.addEventListener("input", () => {
      state().client.address = getStr("clientAddress", state().client.address);
    });
    getEl("notes")?.addEventListener("input", () => {
      state().notes = getStr("notes", state().notes);
    });

    [
      "colToggleRef",
      "colToggleProduct",
      "colToggleDesc",
      "colToggleQty",
      "colTogglePrice",
      "colToggleTva",
      "colToggleDiscount",
    ].forEach((id) => getEl(id)?.addEventListener("change", SEM.applyColumnHiding));

    getEl("whEnabled")?.addEventListener("change", () => {
      state().meta.withholding.enabled = !!getEl("whEnabled").checked;
      SEM.toggleWHFields?.(state().meta.withholding.enabled);
      SEM.computeTotals?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("whRate")?.addEventListener("input", () => {
      state().meta.withholding.rate = getNum("whRate", state().meta.withholding.rate);
      SEM.computeTotals?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("whBase")?.addEventListener("change", () => {
      state().meta.withholding.base = getStr("whBase", state().meta.withholding.base);
      SEM.computeTotals?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("whThreshold")?.addEventListener("input", () => {
      state().meta.withholding.threshold = getNum(
        "whThreshold",
        state().meta.withholding.threshold ?? 0
      );
      SEM.computeTotals?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("whLabel")?.addEventListener("input", () => {
      state().meta.withholding.label = getStr("whLabel", state().meta.withholding.label);
      SEM.updateWHAmountPreview?.();
    });

    getEl("shipEnabled")?.addEventListener("change", () => {
      state().meta.extras.shipping.enabled = !!getEl("shipEnabled").checked;
      SEM.toggleShipFields?.(state().meta.extras.shipping.enabled);
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("shipLabel")?.addEventListener("input", () => {
      state().meta.extras.shipping.label = getStr(
        "shipLabel",
        state().meta.extras.shipping.label
      );
      SEM.updateExtrasMiniRows?.();
    });
    getEl("shipAmount")?.addEventListener("input", () => {
      state().meta.extras.shipping.amount = getNum(
        "shipAmount",
        state().meta.extras.shipping.amount
      );
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("shipTva")?.addEventListener("input", () => {
      state().meta.extras.shipping.tva = getNum(
        "shipTva",
        state().meta.extras.shipping.tva
      );
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });

    getEl("stampEnabled")?.addEventListener("change", () => {
      state().meta.extras.stamp.enabled = !!getEl("stampEnabled").checked;
      SEM.toggleStampFields?.(state().meta.extras.stamp.enabled);
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("stampLabel")?.addEventListener("input", () => {
      state().meta.extras.stamp.label = getStr(
        "stampLabel",
        state().meta.extras.stamp.label
      );
      SEM.updateExtrasMiniRows?.();
    });
    getEl("stampAmount")?.addEventListener("input", () => {
      state().meta.extras.stamp.amount = getNum(
        "stampAmount",
        state().meta.extras.stamp.amount
      );
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("stampTva")?.addEventListener("input", () => {
      state().meta.extras.stamp.tva = getNum("stampTva", state().meta.extras.stamp.tva);
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });

    getEl("fodecEnabled")?.addEventListener("change", () => {
      const f = state().meta.extras.fodec || (state().meta.extras.fodec = {});
      f.enabled = !!getEl("fodecEnabled").checked;
      SEM.toggleFodecFields?.(f.enabled);
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("fodecLabel")?.addEventListener("input", () => {
      state().meta.extras.fodec.label = getStr(
        "fodecLabel",
        state().meta.extras.fodec.label || "FODEC"
      );
      SEM.updateExtrasMiniRows?.();
    });
    getEl("fodecRate")?.addEventListener("input", () => {
      state().meta.extras.fodec.rate = getNum(
        "fodecRate",
        state().meta.extras.fodec.rate ?? 1
      );
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("fodecBase")?.addEventListener("change", () => {
      state().meta.extras.fodec.base = getStr(
        "fodecBase",
        state().meta.extras.fodec.base || "ht"
      );
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
    getEl("fodecTva")?.addEventListener("input", () => {
      state().meta.extras.fodec.tva = getNum(
        "fodecTva",
        state().meta.extras.fodec.tva ?? 19
      );
      SEM.computeTotals?.();
      SEM.updateExtrasMiniRows?.();
      SEM.updateWHAmountPreview?.();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        SEM.updateClientIdPlaceholder?.();
        SEM.forceExtrasVisibility?.();
      },
      { once: true }
    );
  } else {
    SEM.updateClientIdPlaceholder?.();
    SEM.forceExtrasVisibility?.();
  }
})(window);
