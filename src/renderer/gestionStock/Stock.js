import {
  addStockItem,
  deleteStockItem,
  ensureStockState,
  getStockItems,
  refreshStockFromFilesystem,
  updateStockItem,
} from "./StockState.js";
import { getEl } from "./StockUtils.js";
import { bindStockListHeader, renderStockListSection, updateStockTable } from "./StockList.js";
import {
  bindStockAddPanel,
  clearAddForm,
  fillAddForm,
  renderStockAddPanel,
  setAddFormMode,
} from "./StockAddPanel.js";

let activeTableHandlers = null;

function suggestedArticleName(entry) {
  const fallback = "article";
  if (!entry) return fallback;
  return (
    (entry.ref && String(entry.ref).trim()) ||
    (entry.name && String(entry.name).trim()) ||
    (entry.desc && String(entry.desc).trim()) ||
    fallback
  );
}

async function saveArticleToFilesystem(entry) {
  if (
    !entry ||
    typeof window === "undefined" ||
    !window.SoukElMeuble?.saveArticleAuto
  ) {
    return null;
  }
  try {
    const suggestedName = suggestedArticleName(entry);
    const res = await window.SoukElMeuble.saveArticleAuto({
      article: entry,
      suggestedName,
    });
    if (res?.ok !== true) {
      console.warn("[stock] saveArticleAuto returned error:", res);
    }
    return res || null;
  } catch (error) {
    console.warn("[stock] saveArticleAuto failed:", error);
    return null;
  }
}

async function updateArticleOnFilesystem(entry, current) {
  if (
    !entry ||
    typeof window === "undefined" ||
    !window.SoukElMeuble
  ) {
    return null;
  }
  const targetPath = current?.__path;
  if (targetPath && window.SoukElMeuble.updateArticleFile) {
    try {
      const res = await window.SoukElMeuble.updateArticleFile({
        path: targetPath,
        article: entry,
      });
      if (res?.ok !== true) {
        console.warn("[stock] updateArticleFile returned error:", res);
      }
      return res || null;
    } catch (error) {
      console.warn("[stock] updateArticleFile failed:", error);
      return null;
    }
  }
  return saveArticleToFilesystem(entry);
}

async function deleteArticleFromFilesystem(targetPath) {
  if (
    !targetPath ||
    typeof window === "undefined" ||
    !window.SoukElMeuble?.deletePath
  ) {
    return null;
  }
  try {
    const res = await window.SoukElMeuble.deletePath(targetPath);
    if (res?.ok !== true) {
      console.warn("[stock] deletePath returned error:", res);
    }
    return res || null;
  } catch (error) {
    console.warn("[stock] deletePath failed:", error);
    return null;
  }
}

function updateBreadcrumb(section) {
  const container = getEl("stockBreadcrumb");
  if (!container) return;
  if (section === "add") {
    container.innerHTML = `
      <button type="button" class="crumb link" data-section="list">Gestion de stock</button>
      <span class="crumb-sep" aria-hidden="true">&rsaquo;</span>
      <span class="crumb current" aria-current="page">Ajouter un article</span>
    `;
  } else {
    container.innerHTML = `<span class="crumb current" aria-current="page">Gestion de stock</span>`;
  }
}

function showSection(section) {
  const listWrap = getEl("stockListSection");
  const panel = getEl("stockAddPanel");
  const addBtn = getEl("stockAddButton");
  if (section === "add") {
    if (listWrap) listWrap.style.display = "none";
    if (panel) panel.style.display = "block";
    if (addBtn) addBtn.style.display = "none";
    updateBreadcrumb("add");
  } else {
    if (listWrap) listWrap.style.display = "";
    if (panel) panel.style.display = "none";
    if (addBtn) addBtn.style.display = "";
    clearAddForm();
    updateBreadcrumb("list");
  }
}

function bindBreadcrumb() {
  const container = getEl("stockBreadcrumb");
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
  updateStockTable(getStockItems(), activeTableHandlers || {});
}

function handleAddRequested() {
  clearAddForm();
  showSection("add");
}

function handleEditRequested(index) {
  const items = getStockItems();
  const item = items[index];
  if (!item) return;
  setAddFormMode("edit", index);
  fillAddForm(item);
  showSection("add");
}

async function handleDeleteRequested(index) {
  try {
    const items = getStockItems();
    const target = items[index];
    deleteStockItem(index);
    if (target?.__path) {
      await deleteArticleFromFilesystem(target.__path);
    }
    await refreshStockFromFilesystem();
    refreshTable();
  } catch (error) {
    console.warn("[stock] delete failed:", error);
  }
}

async function handleSubmit({ entry, mode, editIndex }) {
  if (!entry) return;
  try {
    if (mode === "edit" && Number.isInteger(editIndex) && editIndex >= 0) {
      const items = getStockItems();
      const existing = items[editIndex];
      const extras = {};
      if (existing?.__path) extras.__path = existing.__path;
      if (existing?.__fileName) extras.__fileName = existing.__fileName;
      updateStockItem(editIndex, entry, extras);
      await updateArticleOnFilesystem(entry, existing);
    } else {
      addStockItem(entry);
      await saveArticleToFilesystem(entry);
    }
    await refreshStockFromFilesystem();
    showSection("list");
    refreshTable();
  } catch (error) {
    console.warn("[stock] submit failed:", error);
  }
}

export function mount(root) {
  if (!root) return;
  root.id = "screenStock";
  root.classList.add("paper");
  root.innerHTML = `
    <div class="stock-header">
      <div class="stock-lead">
        <div class="stock-crumbs" id="stockBreadcrumb"></div>
      </div>
      <button id="stockAddButton" class="btn primary">Ajouter Article</button>
    </div>
    ${renderStockListSection()}
    ${renderStockAddPanel()}
  `;

  ensureStockState();

  const tableHandlers = {
    onEdit: (idx) => handleEditRequested(idx),
    onDelete: (idx) =>
      Promise.resolve(handleDeleteRequested(idx)).catch((error) => {
        console.warn("[stock] delete handler failed:", error);
      }),
  };
  activeTableHandlers = tableHandlers;

  bindStockListHeader({ onAdd: handleAddRequested });
  bindStockAddPanel({
    onSubmit: handleSubmit,
    onCancel: () => showSection("list"),
  });
  bindBreadcrumb();

  refreshTable();
  Promise.resolve(refreshStockFromFilesystem())
    .then(() => refreshTable())
    .catch((error) => {
      console.warn("[stock] initial filesystem sync failed:", error);
    });
  showSection("list");
}

export function unmount(root) {
  if (root) root.innerHTML = "";
  activeTableHandlers = null;
}

export default { mount, unmount };
