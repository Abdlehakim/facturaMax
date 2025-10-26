import { formatMoney, getEl } from "./StockUtils.js";

export function renderStockListSection() {
  return `
    <section class="grid" id="stockListSection">
      <div class="table-wrap stock-table">
        <table>
          <thead>
            <tr>
              <th class="left" style="width:12%">Reference</th>
              <th class="left" style="width:18%">Article</th>
              <th class="left" >Description</th>
              <th style="width:10%">Quantite</th>
              <th style="width:12%">Prix HT</th>
              <th style="width:12%">TVA %</th>
              <th style="width:12%">Remise %</th>
              <th style="width:12%">Actions</th>
            </tr>
          </thead>
          <tbody id="stockTableBody"></tbody>
        </table>
      </div>
    </section>
  `;
}

export function bindStockListHeader({ onAdd } = {}) {
  const addBtn = getEl("stockAddButton");
  if (!addBtn) return;
  addBtn.addEventListener("click", () => {
    if (typeof onAdd === "function") onAdd();
  });
}

export function updateStockTable(items, { onEdit, onDelete } = {}) {
  const tbody = getEl("stockTableBody");
  if (!tbody) return;
  const currency = "TND";

  if (!Array.isArray(items) || items.length === 0) {
    tbody.innerHTML = `
      <tr class="no-data">
        <td colspan="8" class="muted">Aucun article en stock pour le moment. Ajoutez votre premier article pour commencer.</td>
      </tr>`;
    return;
  }

  const rows = items.map((item, idx) => {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);
    const tva = Number(item.tva || 0);
    const discount = Number(item.discount ?? 0);
    return `
      <tr data-index="${idx}">
        <td>${item.ref ? window.escapeHTML?.(item.ref) ?? item.ref : ""}</td>
        <td>${item.name ? window.escapeHTML?.(item.name) ?? item.name : ""}</td>
        <td>${item.desc ? window.escapeHTML?.(item.desc) ?? item.desc : ""}</td>
        <td class="center">${Number.isFinite(qty) ? qty : 0}</td>
        <td class="center">${formatMoney(price, currency)}</td>
        <td class="center">${Number.isFinite(tva) ? tva.toFixed(2) : "0.00"} %</td>
        <td class="center">${Number.isFinite(discount) ? discount.toFixed(2) : "0.00"} %</td>
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
      if (idx >= 0 && typeof onEdit === "function") onEdit(idx);
    });
  });

  tbody.querySelectorAll("button[data-action=\"delete\"]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const idx = Number(event.currentTarget.closest("tr")?.dataset.index ?? "-1");
      if (idx >= 0 && typeof onDelete === "function") onDelete(idx);
    });
  });
}
