import { getEl, setText, showDialog } from "./StockUtils.js";

const FIELD_IDS = [
  "stockAddRef",
  "stockAddName",
  "stockAddDesc",
  "stockAddQty",
  "stockAddPrice",
  "stockAddTva",
  "stockAddDiscount",
];

const FIELD_DEFAULTS = {
  stockAddRef: "",
  stockAddName: "",
  stockAddDesc: "",
  stockAddQty: "0",
  stockAddPrice: "0",
  stockAddTva: "19",
  stockAddDiscount: "0",
};

const SERVICE_LOCK_FIELDS = ["stockAddName", "stockAddQty"];

let serviceCache = {};
let currentFormType = "product";

function getFieldToggle(id) {
  return document.querySelector(`input[type="checkbox"][data-toggle-target="${id}"]`);
}

function isFieldEnabled(id) {
  const toggle = getFieldToggle(id);
  return !toggle || toggle.checked;
}

function applyFieldToggleState(id) {
  const toggle = getFieldToggle(id);
  const wrapper = document.querySelector(`[data-input-wrapper="${id}"]`);
  const field = wrapper?.closest(".field");
  const enabled = !toggle || toggle.checked;
  if (wrapper) wrapper.style.display = enabled ? "" : "none";
  if (field) field.style.display = enabled ? "" : "none";
}

function setToggleDisabled(id, disabled) {
  const toggle = getFieldToggle(id);
  if (toggle) {
    toggle.disabled = !!disabled;
    const label = toggle.closest("label");
    if (label) {
      label.classList.toggle("is-disabled", !!disabled);
    }
  }
}

export function setToggleChecked(id, checked = true) {
  const toggle = getFieldToggle(id);
  if (toggle) toggle.checked = checked;
  applyFieldToggleState(id);
}

function initFieldToggles() {
  FIELD_IDS.forEach((id) => {
    const toggle = getFieldToggle(id);
    if (!toggle) return;
    toggle.addEventListener("change", () => applyFieldToggleState(id));
    applyFieldToggleState(id);
  });
}

export function renderStockAddPanel() {
  return `
    <fieldset id="stockAddPanel" class="" style="display:none;">
      <form id="stockAddForm" class="grid">
        <div class="grid four">
          <div class="field">
            <div class="label-inline">
              <label for="stockAddRef" class="label-text">Reference</label>
            </div>
            <div class="field-toggle-control" data-input-wrapper="stockAddRef">
              <input id="stockAddRef" placeholder="EX-001" />
            </div>
          </div>
          <div class="field">
            <div class="label-inline">
              <label for="stockAddName" class="label-text">Produit</label>
            </div>
            <div class="field-toggle-control" data-input-wrapper="stockAddName">
              <input id="stockAddName" placeholder="Nom de l'article" />
            </div>
          </div>
          <div class="field full">
            <div class="label-inline">
              <label for="stockAddDesc" class="label-text">Description</label>
            </div>
            <div class="field-toggle-control" data-input-wrapper="stockAddDesc">
              <input id="stockAddDesc" placeholder="Details, variantes, remarques..." />
            </div>
          </div>
          <div class="field">
            <div class="label-inline">
              <label for="stockAddQty" class="label-text">En stock</label>
            </div>
            <div class="field-toggle-control" data-input-wrapper="stockAddQty">
              <input id="stockAddQty" type="number" min="0" step="1" value="0" />
            </div>
          </div>
          <div class="field">
            <div class="label-inline">
              <label for="stockAddPrice" class="label-text">Prix HT</label>
            </div>
            <div class="field-toggle-control" data-input-wrapper="stockAddPrice">
              <input id="stockAddPrice" type="number" min="0" step="0.01" value="0" />
            </div>
          </div>
          <div class="field">
            <div class="label-inline">
              <label for="stockAddTva" class="label-text">TVA %</label>
            </div>
            <div class="field-toggle-control" data-input-wrapper="stockAddTva">
              <input id="stockAddTva" type="number" min="0" step="0.01" value="19" />
            </div>
          </div>
          <div class="field">
            <div class="label-inline">
              <label for="stockAddDiscount" class="label-text">Remise %</label>
            </div>
            <div class="field-toggle-control" data-input-wrapper="stockAddDiscount">
              <input id="stockAddDiscount" type="number" min="0" step="0.01" value="0" />
            </div>
          </div>
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
}

export function clearAddForm() {
  FIELD_IDS.forEach((id) => {
    const el = getEl(id);
    if (el) el.value = FIELD_DEFAULTS[id] ?? "";
    setToggleChecked(id, true);
  });
  setAddFormMode("add");
}

export function setAddFormMode(mode, editIndex = null) {
  const panel = getEl("stockAddPanel");
  if (!panel) return;
  if (mode === "edit" && Number.isInteger(editIndex) && editIndex >= 0) {
    panel.dataset.mode = "edit";
    panel.dataset.editIndex = String(editIndex);
    setText("stockAddSubmitText", "Mettre a jour");
  } else {
    panel.dataset.mode = "add";
    delete panel.dataset.editIndex;
    setText("stockAddSubmitText", "+ Ajouter");
  }
}

export function fillAddForm(item = {}) {
  const values = {
    stockAddRef: item.ref ?? "",
    stockAddName: item.name ?? "",
    stockAddDesc: item.desc ?? "",
    stockAddQty: item.qty ?? 0,
    stockAddPrice: item.price ?? 0,
    stockAddTva: item.tva ?? 0,
    stockAddDiscount: item.discount ?? 0,
  };
  FIELD_IDS.forEach((id) => {
    const el = getEl(id);
    if (el && Object.prototype.hasOwnProperty.call(values, id)) {
      el.value = values[id];
    }
    setToggleChecked(id, true);
  });
}

export function bindStockAddPanel({ onSubmit, onCancel } = {}) {
  const form = getEl("stockAddForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = readAddForm();
      if (!payload) return;

      const panel = getEl("stockAddPanel");
      const mode = panel?.dataset.mode === "edit" ? "edit" : "add";
      const editIndex = Number(panel?.dataset.editIndex ?? "-1");

      if (typeof onSubmit === "function") {
        Promise.resolve(onSubmit({ entry: payload, mode, editIndex })).catch((error) => {
          console.warn("[stock] submit handler failed:", error);
        });
      }
    });
  }

  const cancel = getEl("stockAddCancel");
  if (cancel) {
    cancel.addEventListener("click", () => {
      if (typeof onCancel === "function") {
        Promise.resolve(onCancel()).catch((error) => {
          console.warn("[stock] cancel handler failed:", error);
        });
      }
    });
  }

  initFieldToggles();
}

function readAddForm() {
  const ref = isFieldEnabled("stockAddRef") ? getEl("stockAddRef")?.value.trim() || "" : "";
  const name = isFieldEnabled("stockAddName") ? getEl("stockAddName")?.value.trim() || "" : "";
  const desc = isFieldEnabled("stockAddDesc") ? getEl("stockAddDesc")?.value.trim() || "" : "";

  if (!name && !desc) {
    showDialog("Renseignez au moins un nom ou une description d'article.", { title: "Stock" });
    return null;
  }

  const qtyRaw = isFieldEnabled("stockAddQty") ? getEl("stockAddQty")?.value : FIELD_DEFAULTS.stockAddQty;
  const priceRaw = isFieldEnabled("stockAddPrice") ? getEl("stockAddPrice")?.value : FIELD_DEFAULTS.stockAddPrice;
  const tvaRaw = isFieldEnabled("stockAddTva") ? getEl("stockAddTva")?.value : FIELD_DEFAULTS.stockAddTva;
  const discountRaw = isFieldEnabled("stockAddDiscount") ? getEl("stockAddDiscount")?.value : FIELD_DEFAULTS.stockAddDiscount;

  const qty = Number(qtyRaw || 0);
  const price = Number(priceRaw || 0);
  const tva = Number(tvaRaw || 0);
  const discount = Number(discountRaw || 0);

  return {
    ref,
    name,
    desc,
    qty: Number.isFinite(qty) ? qty : Number(FIELD_DEFAULTS.stockAddQty || 0),
    price: Number.isFinite(price) ? price : Number(FIELD_DEFAULTS.stockAddPrice || 0),
    tva: Number.isFinite(tva) ? tva : Number(FIELD_DEFAULTS.stockAddTva || 0),
    discount: Number.isFinite(discount) ? discount : Number(FIELD_DEFAULTS.stockAddDiscount || 0),
  };
}

export function setupFieldVisibilityMenu() {
  if (typeof document === "undefined") return;
  const button = document.getElementById("stockFieldVisibilityButton");
  const menu = document.getElementById("stockFieldVisibilityMenu");
  if (!button || !menu) return;
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
  if (window.__SEM_StockFieldVisibilityListener) {
    document.removeEventListener("click", window.__SEM_StockFieldVisibilityListener);
  }
  const onDocumentClick = (event) => {
    if (!open) return;
    if (!menu.contains(event.target) && event.target !== button) setOpen(false);
  };
  window.__SEM_StockFieldVisibilityListener = onDocumentClick;
  document.addEventListener("click", onDocumentClick);
}

export function applyStockFormType(type) {
  const normalized = type === "service" ? "service" : "product";
  if (normalized === currentFormType) {
    enforceCurrentType();
    return;
  }
  if (normalized === "service") {
    serviceCache = {};
    SERVICE_LOCK_FIELDS.forEach((id) => {
      const toggle = getFieldToggle(id);
      serviceCache[id] = toggle ? !!toggle.checked : true;
      setToggleChecked(id, false);
      setToggleDisabled(id, true);
    });
  } else {
    SERVICE_LOCK_FIELDS.forEach((id) => {
      setToggleDisabled(id, false);
      const restore = Object.prototype.hasOwnProperty.call(serviceCache, id) ? serviceCache[id] : true;
      setToggleChecked(id, restore);
    });
    serviceCache = {};
  }
  currentFormType = normalized;
}

function enforceCurrentType() {
  if (currentFormType === "service") {
    SERVICE_LOCK_FIELDS.forEach((id) => {
      setToggleChecked(id, false);
      setToggleDisabled(id, true);
    });
  } else {
    SERVICE_LOCK_FIELDS.forEach((id) => {
      setToggleDisabled(id, false);
    });
  }
}
