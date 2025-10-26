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
  setupFieldVisibilityMenu,
  renderStockAddPanel,
  setAddFormMode,
  applyStockFormType,
} from "./StockAddPanel.js";

let activeTableHandlers = null;
let stockTypeControls = {
  button: null,
  label: null,
  menu: null,
  radios: [],
  current: "product",
};

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
  const visibilityWrapper = getEl("stockFieldVisibilityWrapper");
  if (section === "add") {
    setStockTypeSelection("product");
  }
  if (section === "add") {
    if (listWrap) listWrap.style.display = "none";
    if (panel) panel.style.display = "block";
    if (addBtn) addBtn.style.display = "none";
    if (visibilityWrapper) visibilityWrapper.style.display = "flex";
    updateBreadcrumb("add");
  } else {
    if (listWrap) listWrap.style.display = "";
    if (panel) panel.style.display = "none";
    if (addBtn) addBtn.style.display = "";
    if (visibilityWrapper) visibilityWrapper.style.display = "none";
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
      <div class="stock-header-actions">
        <div class="stock-header-dropdowns" id="stockFieldVisibilityWrapper" style="display:none;">
          <div class="field-visibility-control stock-type-control">
            <button id="stockTypeDropdownButton" type="button" class="visibility-dropdown-toggle">
              <span id="stockTypeDropdownLabel">Produit</span>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div id="stockTypeDropdownMenu" class="field-visibility-menu type-menu">
              <div class="field-visibility-options">
                <label>
                  <input type="radio" name="stockTypeOption" value="product" checked />
                  <span>Produit</span>
                </label>
                <label>
                  <input type="radio" name="stockTypeOption" value="service" />
                  <span>Service</span>
                </label>
              </div>
            </div>
          </div>
          <div class="field-visibility-control">
            <button id="stockFieldVisibilityButton" type="button" class="visibility-dropdown-toggle">
              <span>Champs affiches</span>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div id="stockFieldVisibilityMenu" class="field-visibility-menu">
              <div class="field-visibility-options">
                <label>
                  <input type="checkbox" class="field-toggle-checkbox" data-toggle-target="stockAddRef" checked />
                  <span>Reference</span>
                </label>
                <label>
                  <input type="checkbox" class="field-toggle-checkbox" data-toggle-target="stockAddName" checked />
                  <span>Produit</span>
                </label>
                <label>
                  <input type="checkbox" class="field-toggle-checkbox" data-toggle-target="stockAddDesc" checked />
                  <span>Description</span>
                </label>
                <label>
                  <input type="checkbox" class="field-toggle-checkbox" data-toggle-target="stockAddQty" checked />
                  <span>Quantite</span>
                </label>
                <label>
                  <input type="checkbox" class="field-toggle-checkbox" data-toggle-target="stockAddPrice" checked />
                  <span>Prix HT</span>
                </label>
                <label>
                  <input type="checkbox" class="field-toggle-checkbox" data-toggle-target="stockAddTva" checked />
                  <span>TVA %</span>
                </label>
                <label>
                  <input type="checkbox" class="field-toggle-checkbox" data-toggle-target="stockAddDiscount" checked />
                  <span>Remise %</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <button id="stockAddButton" class="btn primary">Ajouter Article</button>
      </div>
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
  setupFieldVisibilityMenu();
  setupStockTypeMenu();

  refreshTable();
  Promise.resolve(refreshStockFromFilesystem())
    .then(() => refreshTable())
    .catch((error) => {
      console.warn("[stock] initial filesystem sync failed:", error);
    });
  showSection("list");
}

export function unmount(root) {
  if (window.__SEM_StockFieldVisibilityListener) {
    document.removeEventListener("click", window.__SEM_StockFieldVisibilityListener);
    delete window.__SEM_StockFieldVisibilityListener;
  }
  if (window.__SEM_StockTypeMenuListener) {
    document.removeEventListener("click", window.__SEM_StockTypeMenuListener);
    delete window.__SEM_StockTypeMenuListener;
  }
  if (root) root.innerHTML = "";
  activeTableHandlers = null;
}

export default { mount, unmount };

function setupStockTypeMenu() {
  if (typeof document === "undefined") return;
  const button = document.getElementById("stockTypeDropdownButton");
  const menu = document.getElementById("stockTypeDropdownMenu");
  const label = document.getElementById("stockTypeDropdownLabel");
  if (!button || !menu || !label) return;
  const radios = Array.from(menu.querySelectorAll('input[name="stockTypeOption"]'));
  stockTypeControls = {
    button,
    label,
    menu,
    radios,
    current: "product",
  };

  let open = false;
  const setOpen = (value) => {
    open = !!value;
    menu.style.display = open ? "block" : "none";
    button.classList.toggle("is-open", open);
    menu.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
  };
  setOpen(false);

  if (!button.dataset.menuSetup) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(!open);
    });
    button.dataset.menuSetup = "true";
  }

  radios.forEach((radio) => {
    radio.addEventListener("change", (event) => {
      if (!event.target.checked) return;
      const value = event.target.value === "service" ? "service" : "product";
      setStockTypeSelection(value, { updateRadios: false });
      setOpen(false);
    });
  });

  if (window.__SEM_StockTypeMenuListener) {
    document.removeEventListener("click", window.__SEM_StockTypeMenuListener);
  }
  const onDocumentClick = (event) => {
    if (!open) return;
    if (!menu.contains(event.target) && event.target !== button) {
      setOpen(false);
    }
  };
  window.__SEM_StockTypeMenuListener = onDocumentClick;
  document.addEventListener("click", onDocumentClick);

  setStockTypeSelection("product");
}

function setStockTypeSelection(type, { updateRadios = true } = {}) {
  const normalized = type === "service" ? "service" : "product";
  stockTypeControls.current = normalized;
  if (stockTypeControls.label) {
    stockTypeControls.label.textContent = normalized === "service" ? "Service" : "Produit";
  }
  if (updateRadios && Array.isArray(stockTypeControls.radios)) {
    stockTypeControls.radios.forEach((radio) => {
      radio.checked = radio.value === normalized;
    });
  }
  applyStockFormType(normalized);
}
