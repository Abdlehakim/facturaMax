import { formatMoney, getEl } from "./StockUtils.js";

export function renderStockListSection() {
  return `
    <section class="grid" id="stockListSection">
      <div class="table-wrap stock-table">
        <table>
          <thead>
            <tr>
              <th class="left" style="width:12%">Reference</th>
              <th class="left" style="width:12%">Article</th>
              <th class="left" style="width:18%">Description</th>
              <th style="width:8%">Quantite</th>
              <th style="width:12%">Prix HT</th>
              <th style="width:10%">TVA %</th>
              <th style="width:10%">Remise %</th>
              <th style="width:15%">Actions</th>
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

function normalizeDescription(desc) {
  if (!desc) return "";
  return (typeof desc === "string" ? desc : String(desc || "")).replace(/\s+/g, " ").trim();
}

function escapeHTML(value) {
  const str = String(value ?? "");
  if (typeof window !== "undefined" && typeof window.escapeHTML === "function") {
    return window.escapeHTML(str);
  }
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    const descText = normalizeDescription(item.desc);
    const descEscaped = escapeHTML(descText);
    return `
      <tr data-index="${idx}">
        <td>${item.ref ? window.escapeHTML?.(item.ref) ?? item.ref : ""}</td>
        <td>${item.name ? window.escapeHTML?.(item.name) ?? item.name : ""}</td>
        <td class="desc-cell">${descEscaped}</td>
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

  applyDescriptionPreviews(tbody);

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

function applyDescriptionPreviews(container) {
  if (typeof document === "undefined") return;
  const cells = container.querySelectorAll("td.desc-cell");
  if (!cells.length) return;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  cells.forEach((cell) => {
    const full = (cell.textContent || "").trim();
    if (!full) {
      cell.textContent = "";
      return;
    }
    const style = window.getComputedStyle ? window.getComputedStyle(cell) : null;
    const font =
      style?.font && style.font !== "normal normal normal 16px/normal Times New Roman"
        ? style.font
        : `${style?.fontWeight || "400"} ${style?.fontSize || "14px"} ${style?.fontFamily || "sans-serif"}`;
    ctx.font = font;
    const paddingLeft = parseFloat(style?.paddingLeft || "0");
    const paddingRight = parseFloat(style?.paddingRight || "0");
    const maxWidth = Math.max(0, cell.clientWidth - paddingLeft - paddingRight);
    if (maxWidth <= 0) {
      cell.textContent = full;
      return;
    }
    const words = full.split(" ");
    let line = "";
    let truncated = false;
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const tentative = line ? `${line} ${word}` : word;
      const width = ctx.measureText(tentative).width;
      if (width > maxWidth && line) {
        truncated = true;
        break;
      }
      if (width > maxWidth) {
        line = tentative;
        truncated = words.length > i + 1;
        break;
      }
      line = tentative;
      if (i === words.length - 1) truncated = false;
    }
    if (!line) line = words[0] || "";
    if (!truncated && line.length < full.length) truncated = true;
    cell.textContent = truncated ? `${line}…` : line;
    cell.title = full;
  });
}
