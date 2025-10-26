import { getEl, setText, showDialog } from "./StockUtils.js";

export function renderStockAddPanel() {
  return `
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
          <label>
            Remise %
            <input id="stockAddDiscount" type="number" min="0" step="0.01" value="0" />
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
}

export function clearAddForm() {
  const defaults = {
    stockAddQty: "0",
    stockAddPrice: "0",
    stockAddTva: "19",
    stockAddDiscount: "0",
  };
  ["stockAddRef", "stockAddName", "stockAddDesc", "stockAddQty", "stockAddPrice", "stockAddTva", "stockAddDiscount"].forEach((id) => {
    const el = getEl(id);
    if (!el) return;
    el.value = Object.prototype.hasOwnProperty.call(defaults, id) ? defaults[id] : "";
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
  const pairs = [
    ["stockAddRef", item.ref ?? ""],
    ["stockAddName", item.name ?? ""],
    ["stockAddDesc", item.desc ?? ""],
    ["stockAddQty", item.qty ?? 0],
    ["stockAddPrice", item.price ?? 0],
    ["stockAddTva", item.tva ?? 0],
    ["stockAddDiscount", item.discount ?? 0],
  ];
  pairs.forEach(([id, value]) => {
    const el = getEl(id);
    if (el) el.value = value;
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
}

function readAddForm() {
  const ref = getEl("stockAddRef")?.value.trim() || "";
  const name = getEl("stockAddName")?.value.trim() || "";
  const desc = getEl("stockAddDesc")?.value.trim() || "";
  const qty = Number(getEl("stockAddQty")?.value || 0);
  const price = Number(getEl("stockAddPrice")?.value || 0);
  const tva = Number(getEl("stockAddTva")?.value || 0);
  const discount = Number(getEl("stockAddDiscount")?.value || 0);

  if (!name && !desc) {
    showDialog("Renseignez au moins un nom ou une description d'article.", { title: "Stock" });
    return null;
  }

  return {
    ref,
    name,
    desc,
    qty: Number.isFinite(qty) ? qty : 0,
    price: Number.isFinite(price) ? price : 0,
    tva: Number.isFinite(tva) ? tva : 0,
    discount: Number.isFinite(discount) ? discount : 0,
  };
}
