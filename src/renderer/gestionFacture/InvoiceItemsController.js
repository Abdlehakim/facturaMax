// gestionFacture/InvoiceItemsController.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  if (SEM.__invoiceItemsControllerReady) return;
  SEM.__invoiceItemsControllerReady = true;

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
  const formatInt =
    w.formatInt ||
    ((value) => {
      const n = Number(value || 0);
      return Number.isFinite(n) ? String(Math.round(n)) : "0";
    });
  const formatPct =
    w.formatPct ||
    ((value) => {
      const n = Number(value || 0);
      return Number.isFinite(n) ? `${n.toFixed(2)}` : "0.00";
    });
  const escapeHTML =
    w.escapeHTML ||
    ((value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;"));

  function showDialog(message, options) {
    if (typeof w.showDialog === "function") return w.showDialog(message, options);
    if (typeof w.alert === "function") w.alert(message);
    return Promise.resolve();
  }

  function setColumnVisibility(table, oneBasedIndex, visible) {
    if (!table) return;
    const th = table.tHead?.rows?.[0]?.cells?.[oneBasedIndex - 1];
    if (th) th.style.display = visible ? "" : "none";
    const rows = table.tBodies[0]?.rows || [];
    for (const r of rows) {
      const cell = r.cells[oneBasedIndex - 1];
      if (cell) cell.style.display = visible ? "" : "none";
    }
  }

  function setAddInputVisibility({ ref, product, desc, qty, price, tva, discount }) {
    const entries = [
      [".field-ref", ref],
      [".field-product", product],
      [".field-desc", desc],
      [".field-qty", qty],
      [".field-price", price],
      [".field-tva", tva],
      [".field-discount", discount],
    ];
    entries.forEach(([selector, visible]) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.style.display = visible ? "" : "none";
      });
    });
  }

  SEM.clearAddForm = function clearAddForm() {
    setVal("addRef", "");
    setVal("addProduct", "");
    setVal("addDesc", "");
    setVal("addQty", "1");
    setVal("addPrice", "0");
    setVal("addTva", "19");
    setVal("addDiscount", "0");
  };

  SEM.fillAddFormFromItem = function fillAddFormFromItem(it = {}) {
    setVal("addRef", it.ref ?? "");
    setVal("addProduct", it.product ?? "");
    setVal("addDesc", it.desc ?? "");
    setVal("addQty", String(it.qty ?? 1));
    setVal("addPrice", String(it.price ?? 0));
    setVal("addTva", String(it.tva ?? 19));
    setVal("addDiscount", String(it.discount ?? 0));
  };

  SEM.setSubmitMode = function setSubmitMode(mode) {
    const submitBtn = getEl("btnSubmitItem");
    const newBtn = getEl("btnNewItem");
    if (!submitBtn || !newBtn) return;
    if (mode === "update") {
      submitBtn.textContent = "Mettre a jour";
      submitBtn.dataset.mode = "update";
      newBtn.disabled = false;
    } else {
      submitBtn.textContent = "+ Ajouter";
      submitBtn.dataset.mode = "add";
      newBtn.disabled = true;
    }
  };

  SEM.clearAddFormAndMode = function clearAddFormAndMode() {
    SEM.selectedItemIndex = null;
    SEM.clearAddForm();
    SEM.setSubmitMode("add");
  };

  SEM.enterUpdateMode = function enterUpdateMode(index) {
    if (!Array.isArray(state().items)) return;
    SEM.selectedItemIndex = index;
    const item = state().items[index];
    if (item) {
      SEM.fillAddFormFromItem(item);
      SEM.setSubmitMode("update");
    }
  };

  SEM.submitItemForm = async function submitItemForm() {
    const item = {
      ref: getStr("addRef"),
      product: getStr("addProduct"),
      desc: getStr("addDesc"),
      qty: getNum("addQty", 1),
      price: getNum("addPrice", 0),
      tva: getNum("addTva", 19),
      discount: getNum("addDiscount", 0),
    };
    if (!item.product && !item.desc) {
      await showDialog("Veuillez saisir au moins un Produit ou une Description.", {
        title: "Article incomplet",
      });
      return;
    }
    const st = state();
    if (!Array.isArray(st.items)) st.items = [];
    const mode = getEl("btnSubmitItem")?.dataset.mode || "add";
    if (mode === "update" && SEM.selectedItemIndex !== null && SEM.selectedItemIndex >= 0) {
      st.items[SEM.selectedItemIndex] = item;
    } else {
      st.items.push(item);
    }
    SEM.renderItems?.();
    SEM.clearAddFormAndMode();
  };

  SEM.renderItems = function renderItems() {
    const body = getEl("itemBody");
    if (!body) return;
    body.innerHTML = "";
    const currency = state().meta.currency || "TND";

    let items = state().items;
    if (!Array.isArray(items)) {
      items = [];
      state().items = items;
    }
    if (items.length === 0) {
      SEM.computeTotals?.();
      SEM.applyColumnHiding?.();
      SEM.updateWHAmountPreview?.();
      SEM.updateExtrasMiniRows?.();
      return;
    }

    items.forEach((raw, index) => {
      const it = {
        ref: raw.ref ?? "",
        product: raw.product ?? (raw.desc ? String(raw.desc) : ""),
        desc: raw.product ? raw.desc ?? "" : raw.desc ?? "",
        qty: Number(raw.qty ?? 0),
        price: Number(raw.price ?? 0),
        tva: Number(raw.tva ?? 0),
        discount: Number(raw.discount ?? 0),
      };
      const base = it.qty * it.price;
      const disc = base * (it.discount / 100);
      const taxedBase = Math.max(0, base - disc);
      const tax = taxedBase * (it.tva / 100);
      const lineTotal = taxedBase + tax;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="cell-ref">${escapeHTML(it.ref)}</td>
        <td class="cell-product">${escapeHTML(it.product)}</td>
        <td class="cell-desc">${escapeHTML(it.desc)}</td>
        <td class="cell-qty right">${formatInt(it.qty)}</td>
        <td class="cell-price right">${formatMoney(it.price, currency)}</td>
        <td class="cell-tva right">${formatPct(it.tva)}</td>
        <td class="cell-discount right">${formatPct(it.discount)}</td>
        <td class="cell-ttc right">${formatMoney(lineTotal, currency)}</td>
        <td class="add-actions">
          <div class="qte-controls" data-idx="${index}">\n            <button class="btn tiny qte-minus" data-qte-minus="${index}">-</button>\n            <input class="qte-input" data-qte-input="${index}" type="number" min="1" value="${formatInt(it.qty)}" />\n            <button class="btn tiny qte-plus" data-qte-plus="${index}">+</button>\n          </div>\n          <button class="del" data-del="${index}">Supprimer</button>
        </td>`;
      body.appendChild(tr);
    });

    // Actions handlers: delete + QTE controls
    body.querySelectorAll("button.del").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const idx = Number(event.currentTarget.dataset.del);
        state().items.splice(idx, 1);
        if (SEM.selectedItemIndex === idx) SEM.clearAddFormAndMode();
        SEM.renderItems?.();
      });
    });

    const clampQte = (line, value) => {
      const stockMax = Number(line.stockQty ?? 0);
      let q = Math.floor(Number(value));
      if (!Number.isFinite(q) || q < 1) q = 1;
      if (Number.isFinite(stockMax) && stockMax > 0 && q > stockMax) q = stockMax;
      return q;
    };

    const updateRowQty = (row, line) => {
      try {
        // Update the visible QTE cell and input value
        const qtyCell = row?.querySelector('.cell-qty');
        if (qtyCell) qtyCell.textContent = formatInt(line.qty);
        const inp = row?.querySelector('input.qte-input');
        if (inp && String(inp.value) !== String(line.qty)) inp.value = String(line.qty);

        // Recompute this row's TTC in place
        const base = Number(line.qty || 0) * Number(line.price || 0);
        const disc = base * (Number(line.discount || 0) / 100);
        const taxedBase = Math.max(0, base - disc);
        const tax = taxedBase * (Number(line.tva || 0) / 100);
        const lineTotal = taxedBase + tax;
        const ttcCell = row?.querySelector('.cell-ttc');
        if (ttcCell) ttcCell.textContent = formatMoney(lineTotal, currency);

        // Refresh summary totals
        SEM.computeTotals?.();
        SEM.updateWHAmountPreview?.();
        SEM.updateExtrasMiniRows?.();
      } catch {}
    };

    body.querySelectorAll("button.qte-minus").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const idx = Number(event.currentTarget.dataset.qteMinus);
        const items = state().items || [];
        const line = items[idx];
        if (!line) return;
        line.qty = clampQte(line, (Number(line.qty || 1) - 1));
        const row = event.currentTarget.closest('tr');
        updateRowQty(row, line);
      });
    });
    body.querySelectorAll("button.qte-plus").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        const idx = Number(event.currentTarget.dataset.qtePlus);
        const items = state().items || [];
        const line = items[idx];
        if (!line) return;
        line.qty = clampQte(line, (Number(line.qty || 1) + 1));
        const row = event.currentTarget.closest('tr');
        updateRowQty(row, line);
      });
    });
    body.querySelectorAll("input.qte-input").forEach((inp) => {
      const apply = (el) => {
        const idx = Number(el.dataset.qteInput);
        const items = state().items || [];
        const line = items[idx];
        if (!line) return;
        const value = clampQte(line, el.value);
        if (String(value) !== String(el.value)) el.value = String(value);
        line.qty = value;
        const row = el.closest('tr');
        updateRowQty(row, line);
      };
      inp.addEventListener("change", (e) => apply(e.currentTarget));
      inp.addEventListener("blur", (e) => apply(e.currentTarget));
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(e.currentTarget); }});
    });

    SEM.computeTotals?.();
    SEM.applyColumnHiding?.();
    SEM.updateWHAmountPreview?.();
    SEM.updateExtrasMiniRows?.();
  };

  SEM.applyColumnHiding = function applyColumnHiding() {
    const checkedOrTrue = (el) => (el == null ? true : !!el.checked);
    const refVis = checkedOrTrue(getEl("colToggleRef"));
    const productVis = checkedOrTrue(getEl("colToggleProduct"));
    const descVis = checkedOrTrue(getEl("colToggleDesc"));
    const qtyVis = checkedOrTrue(getEl("colToggleQty"));
    const priceVis = checkedOrTrue(getEl("colTogglePrice"));
    const tvaVis = checkedOrTrue(getEl("colToggleTva"));
    const discountVis = checkedOrTrue(getEl("colToggleDiscount"));

    document.body.classList.toggle("hide-col-ref", !refVis);
    document.body.classList.toggle("hide-col-product", !productVis);
    document.body.classList.toggle("hide-col-desc", !descVis);
    document.body.classList.toggle("hide-col-qty", !qtyVis);
    document.body.classList.toggle("hide-col-price", !priceVis);
    document.body.classList.toggle("hide-col-tva", !tvaVis);
    document.body.classList.toggle("hide-col-discount", !discountVis);
    document.body.classList.toggle("hide-col-ttc", !priceVis);

    const itemsTable = getEl("items");
    setColumnVisibility(itemsTable, 8, priceVis);

    const mini = document.querySelector(".mini-sum");
    if (mini) mini.style.display = priceVis ? "" : "none";

    setAddInputVisibility({
      ref: refVis,
      product: productVis,
      desc: descVis,
      qty: qtyVis,
      price: priceVis,
      tva: tvaVis,
      discount: discountVis,
    });
  };

  SEM.wireColumnToggles = function wireColumnToggles() {
    const ids = [
      "colToggleRef",
      "colToggleProduct",
      "colToggleDesc",
      "colToggleQty",
      "colTogglePrice",
      "colToggleTva",
      "colToggleDiscount",
    ];
    ids.forEach((id) => {
      const el = getEl(id);
      if (el) el.checked = true;
    });
    SEM.applyColumnHiding?.();
    ids.forEach((id) =>
      getEl(id)?.addEventListener("change", () => {
        SEM.applyColumnHiding?.();
        SEM.computeTotals?.();
        SEM.updateWHAmountPreview?.();
        SEM.updateExtrasMiniRows?.();
      })
    );
  };
})(window);




