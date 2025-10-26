import {
  addClient,
  deleteClient,
  ensureClientState,
  getClientItems,
  updateClient,
} from "./ClientState.js";
import { getEl } from "./ClientUtils.js";
import { bindClientListHeader, renderClientListSection, updateClientTable } from "./ClientList.js";
import {
  bindClientAddPanel,
  clearAddForm,
  fillAddForm,
  renderClientAddPanel,
  setAddFormMode,
} from "./ClientAddPanel.js";

let activeTableHandlers = null;

function updateBreadcrumb(section) {
  const container = getEl("clientBreadcrumb");
  if (!container) return;
  if (section === "add") {
    container.innerHTML = `
      <button type="button" class="crumb link" data-section="list">Gestion de clients</button>
      <span class="crumb-sep" aria-hidden="true">&rsaquo;</span>
      <span class="crumb current" aria-current="page">Ajouter un client</span>
    `;
  } else if (section === "edit") {
    container.innerHTML = `
      <button type="button" class="crumb link" data-section="list">Gestion de clients</button>
      <span class="crumb-sep" aria-hidden="true">&rsaquo;</span>
      <span class="crumb current" aria-current="page">Modifier un client</span>
    `;
  } else {
    container.innerHTML = `<span class="crumb current" aria-current="page">Gestion de clients</span>`;
  }
}

function showSection(section) {
  const listWrap = getEl("clientListSection");
  const panel = getEl("clientAddPanel");
  const addBtn = getEl("clientAddButton");
  if (section === "add" || section === "edit") {
    if (listWrap) listWrap.style.display = "none";
    if (panel) panel.style.display = "block";
    if (addBtn) addBtn.style.display = "none";
    updateBreadcrumb(section);
  } else {
    if (listWrap) listWrap.style.display = "";
    if (panel) panel.style.display = "none";
    if (addBtn) addBtn.style.display = "";
    clearAddForm();
    updateBreadcrumb("list");
  }
}

function bindBreadcrumb() {
  const container = getEl("clientBreadcrumb");
  if (!container) return;
  container.addEventListener("click", (event) => {
    const target = event.target.closest?.("[data-section]");
    if (!target) return;
    event.preventDefault();
    const section = target.getAttribute("data-section");
    showSection(section === "add" ? "add" : "list");
  });
}

function refreshTable() {
  updateClientTable(getClientItems(), activeTableHandlers || {});
}

function handleAddRequested() {
  clearAddForm();
  setAddFormMode("add");
  showSection("add");
}

function handleEditRequested(index) {
  const items = getClientItems();
  const item = items[index];
  if (!item) return;
  setAddFormMode("edit", index);
  fillAddForm(item);
  updateBreadcrumb("edit");
  showSection("edit");
}

function handleDeleteRequested(index) {
  deleteClient(index);
  refreshTable();
}

function handleSubmit({ entry, mode, editIndex }) {
  if (!entry) return;
  if (mode === "edit" && Number.isInteger(editIndex) && editIndex >= 0) {
    updateClient(editIndex, entry);
  } else {
    addClient(entry);
  }
  showSection("list");
  refreshTable();
}

export function mount(root) {
  if (!root) return;
  root.id = "screenClients";
  root.classList.add("paper");
  root.innerHTML = `
    <div class="client-header">
      <div class="client-lead">
        <div class="client-crumbs" id="clientBreadcrumb"></div>
      </div>
      <button id="clientAddButton" class="btn primary">Ajoute client</button>
    </div>
    ${renderClientListSection()}
    ${renderClientAddPanel()}
  `;

  ensureClientState();

  const tableHandlers = {
    onEdit: (idx) => handleEditRequested(idx),
    onDelete: (idx) => handleDeleteRequested(idx),
  };
  activeTableHandlers = tableHandlers;

  bindClientListHeader({ onAdd: handleAddRequested });
  bindClientAddPanel({
    onSubmit: handleSubmit,
    onCancel: () => showSection("list"),
  });
  bindBreadcrumb();

  refreshTable();
  showSection("list");
}

export function unmount(root) {
  if (root) root.innerHTML = "";
  activeTableHandlers = null;
}

export default { mount, unmount };
