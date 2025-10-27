import { getEl, setText, showDialog } from "./ClientUtils.js";

const FIELD_IDS = [
  "clientAddType",
  "clientAddName",
  "clientAddIdentifier",
  "clientAddPhone",
  "clientAddEmail",
  "clientAddAddress",
];

const FIELD_DEFAULTS = {
  clientAddType: "societe",
  clientAddName: "",
  clientAddIdentifier: "",
  clientAddPhone: "",
  clientAddEmail: "",
  clientAddAddress: "",
};

export function renderClientAddPanel() {
  return `
    <fieldset id="clientAddPanel" style="display:none;">
      <form id="clientAddForm" class="grid">
        <div class="grid four">
          <!-- 1) Type de client -->
          <div class="field">
            <div class="label-inline">
              <label for="clientAddType" class="label-text">Type de client</label>
            </div>
            <div class="field-visibility-control" id="clientTypeControl">
              <button id="clientAddTypeButton" type="button" class="visibility-dropdown-toggle" aria-haspopup="true" aria-expanded="false">
                <span id="clientAddTypeLabel">Societe / personne morale</span>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <div id="clientAddTypeMenu" class="field-visibility-menu type-menu">
                <div class="field-visibility-options">
                  <label>
                    <input type="radio" name="clientTypeOption" value="societe" checked />
                    <span>Societe / personne morale</span>
                  </label>
                  <label>
                    <input type="radio" name="clientTypeOption" value="particulier" />
                    <span>Particulier</span>
                  </label>
                </div>
              </div>
            </div>
            <input id="clientAddType" type="hidden" value="societe" />
          </div>

          <!-- 2) Nom du client -->
          <div class="field">
            <div class="label-inline">
              <label for="clientAddName" class="label-text">Nom du client</label>
            </div>
            <input id="clientAddName" placeholder="ex. : Entreprise ABC" />
          </div>

          <!-- 3) Identifiant fiscal / CIN -->
          <div class="field">
            <div class="label-inline">
              <label for="clientAddIdentifier" class="label-text" id="clientAddIdentifierLabel">Identifiant fiscal / TVA</label>
            </div>
            <input id="clientAddIdentifier" placeholder="ex. : 1234567/A/M/000" />
          </div>

          <!-- 4) Telephone -->
          <div class="field">
            <div class="label-inline">
              <label for="clientAddPhone" class="label-text">Telephone</label>
            </div>
            <input id="clientAddPhone" type="tel" placeholder="ex. : +216 55 123 456" />
          </div>

          <!-- 5) E-mail -->
          <div class="field">
            <div class="label-inline">
              <label for="clientAddEmail" class="label-text">E-mail</label>
            </div>
            <input id="clientAddEmail" type="email" placeholder="ex. : contact@client.tn" />
          </div>

          <!-- 6) Adresse -->
          <div class="field" style="grid-column: span 2;">
            <div class="label-inline">
              <label for="clientAddAddress" class="label-text">Adresse</label>
            </div>
            <textarea id="clientAddAddress" rows="2" placeholder="ex. : Rue X, Immeuble Y, Ville, Code postal"></textarea>
          </div>
        </div>

        <div class="client-add-actions">
          <button id="clientAddCancel" type="button" class="btn light">Annuler</button>
          <button id="clientAddSubmit" type="submit" class="btn">
            <span id="clientAddSubmitText">+ Ajouter</span>
          </button>
        </div>
      </form>
    </fieldset>
  `;
}

export function bindClientAddPanel({ onSubmit, onCancel } = {}) {
  const form = getEl("clientAddForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = readAddForm();
      if (!payload) return;
      const panel = getEl("clientAddPanel");
      const mode = panel?.dataset.mode === "edit" ? "edit" : "add";
      const editIndex = Number(panel?.dataset.editIndex ?? "-1");
      if (typeof onSubmit === "function") {
        Promise
          .resolve(onSubmit({ entry: payload, mode, editIndex }))
          .catch((error) => console.warn("[clients] submit handler failed:", error));
      }
    });
  }

  const cancel = getEl("clientAddCancel");
  if (cancel) {
    cancel.addEventListener("click", () => {
      if (typeof onCancel === "function") {
        Promise
          .resolve(onCancel())
          .catch((error) => console.warn("[clients] cancel handler failed:", error));
      }
    });
  }

  setupClientTypeMenu();
  updateIdentifierUI();
}

export function clearAddForm() {
  FIELD_IDS.forEach((id) => {
    const el = getEl(id);
    if (el) el.value = FIELD_DEFAULTS[id] ?? "";
  });
  setAddFormMode("add");
  syncClientTypeUI();
  updateIdentifierUI();
}

export function fillAddForm(item = {}) {
  const values = {
    clientAddType: item.clientType === "particulier" ? "particulier" : "societe",
    clientAddName: item.name ?? "",
    clientAddIdentifier: item.identifier ?? "",
    clientAddPhone: item.phone ?? "",
    clientAddEmail: item.email ?? "",
    clientAddAddress: item.address ?? "",
  };
  FIELD_IDS.forEach((id) => {
    const el = getEl(id);
    if (el && Object.prototype.hasOwnProperty.call(values, id)) {
      el.value = values[id];
    }
  });
  syncClientTypeUI();
  updateIdentifierUI();
}

export function setAddFormMode(mode, editIndex = null) {
  const panel = getEl("clientAddPanel");
  if (!panel) return;
  if (mode === "edit" && Number.isInteger(editIndex) && editIndex >= 0) {
    panel.dataset.mode = "edit";
    panel.dataset.editIndex = String(editIndex);
    setText("clientAddSubmitText", "Mettre a jour");
  } else {
    panel.dataset.mode = "add";
    delete panel.dataset.editIndex;
    setText("clientAddSubmitText", "+ Ajouter");
  }
}

function readAddForm() {
  const type = getEl("clientAddType")?.value || FIELD_DEFAULTS.clientAddType;
  const name = getEl("clientAddName")?.value.trim() || "";
  const identifier = getEl("clientAddIdentifier")?.value.trim() || "";
  const phone = getEl("clientAddPhone")?.value.trim() || "";
  const email = getEl("clientAddEmail")?.value.trim() || "";
  const address = getEl("clientAddAddress")?.value.trim() || "";

  if (!name) {
    showDialog("Veuillez renseigner le nom du client.", { title: "Clients" });
    return null;
  }

  return {
    clientType: type,
    name,
    identifier,
    phone,
    email,
    address,
  };
}

function updateIdentifierUI() {
  const type = getEl("clientAddType")?.value || FIELD_DEFAULTS.clientAddType;
  const idLabel = getEl("clientAddIdentifierLabel");
  const idInput = getEl("clientAddIdentifier");
  const btnLabel = getEl("clientAddTypeLabel");
  const radios = document.querySelectorAll('input[type="radio"][name="clientTypeOption"]');
  if (idLabel && idInput) {
    if (type === "particulier") {
      idLabel.textContent = "CIN / passeport";
      idInput.placeholder = "ex. : CIN 12345678";
    } else {
      idLabel.textContent = "Identifiant fiscal / TVA";
      idInput.placeholder = "ex. : 1234567/A/M/000";
    }
  }
  if (btnLabel) btnLabel.textContent = type === "particulier" ? "Particulier" : "Societe / personne morale";
  radios.forEach((r) => { r.checked = r.value === type; });
}

function syncClientTypeUI() {
  // Keep button label and radios in sync with hidden input value
  updateIdentifierUI();
}

function setupClientTypeMenu() {
  if (typeof document === "undefined") return;
  const button = document.getElementById("clientAddTypeButton");
  const menu = document.getElementById("clientAddTypeMenu");
  const hidden = document.getElementById("clientAddType");
  const btnLabel = document.getElementById("clientAddTypeLabel");
  const radios = menu ? menu.querySelectorAll('input[type="radio"][name="clientTypeOption"]') : [];
  if (!button || !menu || !hidden || !btnLabel) return;
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
  radios.forEach((r) => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      hidden.value = r.value === "particulier" ? "particulier" : "societe";
      btnLabel.textContent = hidden.value === "particulier" ? "Particulier" : "Societe / personne morale";
      updateIdentifierUI();
      setOpen(false);
    });
  });
  if (window.__SEM_ClientTypeListener) {
    document.removeEventListener("click", window.__SEM_ClientTypeListener);
  }
  const onDocumentClick = (event) => {
    if (!open) return;
    if (!menu.contains(event.target) && event.target !== button) setOpen(false);
  };
  window.__SEM_ClientTypeListener = onDocumentClick;
  document.addEventListener("click", onDocumentClick);
}
