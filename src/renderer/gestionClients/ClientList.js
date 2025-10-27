import { getEl } from "./ClientUtils.js";

export function renderClientListSection() {
  return `
    <section class="grid" id="clientListSection">
      <div class="table-wrap client-table">
        <table>
          <thead>
            <tr>
              <th class="left" style="width:18%">Nom du client</th>
              <th class="left" style="width:18%">Type de client</th>
              <th class="left" style="width:20%">Telephone</th>
              <th class="left" style="width:24%">E-mail</th>
              <th style="width:15%">Actions</th>
            </tr>
          </thead>
          <tbody id="clientTableBody"></tbody>
        </table>
      </div>
    </section>
  `;
}

export function bindClientListHeader({ onAdd } = {}) {
  const addBtn = getEl("clientAddButton");
  if (!addBtn) return;
  addBtn.addEventListener("click", () => {
    if (typeof onAdd === "function") onAdd();
  });
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

export function updateClientTable(items, { onEdit, onDelete } = {}) {
  const tbody = getEl("clientTableBody");
  if (!tbody) return;

  if (!Array.isArray(items) || items.length === 0) {
    tbody.innerHTML = `
      <tr class="no-data">
        <td colspan="5" class="muted">Aucun client enregistre pour le moment. Ajoutez votre premier client pour commencer.</td>
      </tr>`;
    return;
  }

  const rows = items.map((item, idx) => {
    const name = escapeHTML(item?.name || "");
    const typeLabel =
      item?.clientType === "particulier" ? "Particulier" : "Societe / personne morale";
    const type = escapeHTML(typeLabel);
    const identifier = item?.identifier ? escapeHTML(item.identifier) : "";
    const phone = escapeHTML(item?.phone || "");
    const email = escapeHTML(item?.email || "");
    const identifierMarkup = identifier
      ? `<span class="client-id-tag">${identifier}</span>`
      : "";
    return `
      <tr data-index="${idx}">
        <td>${name}</td>
        <td>${type}</td>
        <td>${phone}</td>
        <td>${email}</td>
        <td class="actions-cell">
          <button class="btn tiny" data-action="edit">Editer</button>
          <button class="del" data-action="delete">Supprimer</button>
        </td>
      </tr>`;
  });

  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const idx = Number(event.currentTarget.closest("tr")?.dataset.index ?? "-1");
      if (idx >= 0 && typeof onEdit === "function") onEdit(idx);
    });
  });

  tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const idx = Number(event.currentTarget.closest("tr")?.dataset.index ?? "-1");
      if (idx >= 0 && typeof onDelete === "function") onDelete(idx);
    });
  });
}
