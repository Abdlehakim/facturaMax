// gestionStock/Stock.js
const STORAGE_KEY = "sem_stock_items_v1";

function loadStockItems() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistStockItems(items) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
  } catch {}
}

function ensureStockState() {
  const SEM = window.SEM || (window.SEM = {});
  SEM.stock = SEM.stock || {};
  if (!Array.isArray(SEM.stock.items) || SEM.stock.items.length === 0) {
    const stored = loadStockItems();
    if (stored.length) {
      SEM.stock.items = stored;
    } else {
      SEM.stock.items = [
        { ref: "SKU-001", name: "Chaise de bureau", desc: "Structure metal, coloris anthracite", qty: 12, price: 180, tva: 19 },
        { ref: "SKU-002", name: "Lampe de table", desc: "Modele vintage, cable textile", qty: 30, price: 45, tva: 19 },
        { ref: "SKU-003", name: "Canape 3 places", desc: "Tissu gris clair, pieds bois", qty: 5, price: 950, tva: 19 }
      ];
    }
  }
  return SEM.stock.items;
}

function getEl(id) {
  if (typeof window.getEl === "function") return window.getEl(id);
  return document.getElementById(id);
}

function setText(id, value) {
  const el = getEl(id);
  if (el) el.textContent = value;
}

function formatMoney(value, currency = "TND") {
  try {
    return new Intl.NumberFormat("fr-TN", { style: "currency", currency }).format(Number(value) || 0);
  } catch {
    return `${Number(value || 0).toFixed(2)} ${currency}`;
  }
}

function clearAddForm() {
  ["stockAddRef", "stockAddName", "stockAddDesc", "stockAddQty", "stockAddPrice", "stockAddTva"].forEach((id) => {
    const el = getEl(id);
    if (!el) return;
    if (el.type === "number") {
      el.value = "";
    } else {
      el.value = "";
    }
  });
  const panel = getEl("stockAddPanel");
  if (panel) {
    panel.dataset.mode = "add";
    delete panel.dataset.editIndex;
  }
  setText("stockAddSubmitText", "+ Ajouter");
}

function updateBreadcrumb(section) {
  const container = getEl("stockBreadcrumb");
  if (!container) return;
  if (section === "add") {
    container.innerHTML = `
      <button type="button" class="crumb link" data-section="list">Gestion de stock</button>
      <span class="crumb-sep" aria-hidden="true">›</span>
      <span class="crumb current" aria-current="page">Ajouter un article</span>
    `;
  } else {
    container.innerHTML = `<span class="crumb current" aria-current="page">Gestion de stock</span>`;
  }
}

function showSection(section) {
  const listWrap = getEl("stockListSection");
  const panel = getEl("stockAddPanel");
  if (section === "add") {
    if (listWrap) listWrap.style.display = "none";
    if (panel) panel.style.display = "";
    updateBreadcrumb("add");
  } else {
    if (listWrap) listWrap.style.display = "";
    if (panel) panel.style.display = "none";
    clearAddForm();
    updateBreadcrumb("list");
  }
}

function toggleAddPanel(show) {
  showSection(show ? "add" : "list");
}

function bindAddCancel() {
  const cancel = getEl("stockAddCancel");
  if (cancel) cancel.addEventListener("click", () => showSection("list"));
}

function bindBreadcrumb() {
  const container = getEl("stockBreadcrumb");
  if (!container) return;
  container.addEventListener("click", (event) => {
    const target = event.target.closest("[data-section]");
    if (!target) return;
    event.preventDefault();
    const section = target.getAttribute("data-section");
    showSection(section === "add" ? "add" : "list");
  });
}

function handleAddSubmit(render) {
  const form = getEl("stockAddForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const items = ensureStockState();
    const ref = getEl("stockAddRef")?.value.trim() || "";
    const name = getEl("stockAddName")?.value.trim() || "";
    const desc = getEl("stockAddDesc")?.value.trim() || "";
    const qty = Number(getEl("stockAddQty")?.value || 0);
    const price = Number(getEl("stockAddPrice")?.value || 0);
    const tva = Number(getEl("stockAddTva")?.value || 0);

    if (!name && !desc) {
      if (typeof showDialog === "function") {
        showDialog("Renseignez au moins un nom ou une description d'article.", { title: "Stock" });
      }
      return;
    }

    const entry = { ref, name, desc, qty: Number.isFinite(qty) ? qty : 0, price: Number.isFinite(price) ? price : 0, tva: Number.isFinite(tva) ? tva : 0 };
    const panel = getEl("stockAddPanel");
    const mode = panel?.dataset.mode;
    const editIndex = Number(panel?.dataset.editIndex ?? "-1");

    if (mode === "edit" && editIndex >= 0 && editIndex < items.length) {
      items[editIndex] = entry;
    } else {
      items.push(entry);
    }

    persistStockItems(items);
    toggleAddPanel(false);
    render();
  });
}

function editItem(idx, item, render) {
  const panel = getEl("stockAddPanel");
  if (!panel) return;
  panel.dataset.mode = "edit";
  panel.dataset.editIndex = String(idx);
  setText("stockAddSubmitText", "Mettre a jour");

  const pairs = [
    ["stockAddRef", item.ref ?? ""],
    ["stockAddName", item.name ?? ""],
    ["stockAddDesc", item.desc ?? ""],
    ["stockAddQty", item.qty ?? 0],
    ["stockAddPrice", item.price ?? 0],
    ["stockAddTva", item.tva ?? 0],
  ];
  pairs.forEach(([id, value]) => {
    const el = getEl(id);
    if (el) el.value = value;
  });

  toggleAddPanel(true);
}

function deleteItem(idx, render) {
  const items = ensureStockState();
  items.splice(idx, 1);
  persistStockItems(items);
  render();
}

function bindAddButton() {
  const addBtn = getEl("stockAddButton");
  if (!addBtn) return;
  addBtn.addEventListener("click", () => {
    clearAddForm();
    showSection("add");
  });
}

function renderStockTable() {
  const tbody = getEl("stockTableBody");
  if (!tbody) return;
  const items = ensureStockState();
  const currency = "TND";

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr class="no-data">
        <td colspan="7" class="muted">Aucun article en stock pour le moment. Ajoutez votre premier article pour commencer.</td>
      </tr>`;
    return;
  }

  const rows = items.map((item, idx) => {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const tva = Number(item.tva || 0);
    const total = price * (1 + tva / 100);

    return `
      <tr data-index="${idx}">
        <td>${item.ref ? window.escapeHTML?.(item.ref) ?? item.ref : ""}</td>
        <td>${item.name ? window.escapeHTML?.(item.name) ?? item.name : ""}</td>
        <td>${item.desc ? window.escapeHTML?.(item.desc) ?? item.desc : ""}</td>
        <td class="right">${Number.isFinite(qty) ? qty : 0}</td>
        <td class="right">${formatMoney(price, currency)}</td>
        <td class="right">${Number.isFinite(tva) ? tva.toFixed(2) : "0.00"} %</td>
        <td class="actions-cell">
          <button class="btn tiny" data-action="edit">Editer</button>
          <button class="del" data-action="delete">Supprimer</button>
        </td>
      </tr>`;
  });

  tbody.innerHTML = rows.join("");
  tbody.querySelectorAll("button[data-action=\"edit\"]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const idx = Number(event.currentTarget.closest("tr")?.dataset.index ?? "-1");
      if (idx >= 0) {
        const item = ensureStockState()[idx];
        editItem(idx, item, renderStockTable);
      }
    });
  });
  tbody.querySelectorAll("button[data-action=\"delete\"]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const idx = Number(event.currentTarget.closest("tr")?.dataset.index ?? "-1");
      if (idx >= 0) {
        deleteItem(idx, renderStockTable);
      }
    });
  });
}


export function mount(root) {
  if (!root) return;
  root.id = "screenStock";
  root.classList.add("paper");
  root.innerHTML = `
    <section class="grid" id="stockListSection">
        <div class="stock-header">
          <div class="stock-lead">
            <div class="stock-crumbs" id="stockBreadcrumb"></div>
          </div>
          <button id="stockAddButton" class="btn primary">Ajouter Article</button>
        </div>
        <div class="table-wrap stock-table">
          <table>
            <thead>
              <tr>
                <th style="width:12%">Reference</th>
                <th style="width:18%">Article</th>
                <th>Description</th>
                <th style="width:10%">Quantite</th>
                <th style="width:12%">Prix HT</th>
                <th style="width:12%">TVA %</th>
                <th style="width:12%">Actions</th>
              </tr>
            </thead>
            <tbody id="stockTableBody"></tbody>
          </table>
        </div>
    </section>

    <fieldset id="stockAddPanel" class="" style="display:none;">
      <div class="stock-subtitle">Ajouter un article</div>
      <form id="stockAddForm" class="grid">
        <div class="grid four">
          <label>
            Reference
            <input id="stockAddRef" placeholder="EX-001" />
          </label>
          <label>
            Produit
            <input id="stockAddName" placeholder="Nom de l'article" required />
          </label>
          <label class="full">
            Description
            <input id="stockAddDesc" placeholder="Details, variantes, remarques..." />
          </label>
          <label>
            Quantite
            <input id="stockAddQty" type="number" min="0" step="1" value="0" />
          </label>
          <label>
            Prix HT
            <input id="stockAddPrice" type="number" min="0" step="0.01" value="0" />
          </label>
          <label>
            TVA %
            <input id="stockAddTva" type="number" min="0" step="0.01" value="19" />
          </label>
        </div>
        <div class="stock-add-actions">
          <button id="stockAddCancel" type="button" class="btn light">Annuler</button>
          <button id="stockAddSubmit" type="submit" class="btn">
            <span id="stockAddSubmitText">+ Ajouter</span>
          </button>
        </div>
      </form>
    </fieldset>
  `;

  ensureStockState();
  bindAddButton();
  bindAddCancel();
  handleAddSubmit(renderStockTable);
  bindBreadcrumb();
  renderStockTable();
  showSection("list");
}

export function unmount(root) {
  if (root) root.innerHTML = "";
}

export default { mount, unmount };
