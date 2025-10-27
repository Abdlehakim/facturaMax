// gestionFacture/CreateInvoice.js
export function mount(root) {
  root.id = "invoice";
  root.classList.add("paper");
  root.innerHTML = `
    <div class="actions toolbar" style="display:flex; gap:8px; justify-content:flex-end; margin-bottom:12px;">
      <button id="btnNew" class="btn">Nouveau</button>
      <button id="btnSave" class="btn">Enregistrer</button>
      <button id="btnOpen" class="btn">Ouvrir</button>
      <button id="btnPDF" class="btn">Exporter PDF</button>
    </div>

    <section class="grid three">
      <fieldset class="section-box">
        <legend id="docTypeLegend">
          <span class="legend-text for-facture">Facture :</span>
          <span class="legend-text for-devis">Devis :</span>
          <span class="legend-text for-bl">Bon de livraison :</span>
          <span class="legend-text for-bc">Bon de commande :</span>
        </legend>

        <div class="grid two">
          <label>
            Type de document
            <select id="docType">
              <option value="facture" selected>Facture</option>
              <option value="devis">Devis</option>
              <option value="bl">Bon de livraison</option>
              <option value="bc">Bon de commande</option>
            </select>
          </label>
          <label>
            <span id="invNumberLabel">
              <span class="for-facture">No de facture</span>
              <span class="for-devis">No de devis</span>
              <span class="for-bl">No de bon de livraison</span>
              <span class="for-bc">No de bon de commande</span>
            </span>
            <input id="invNumber" />
          </label>
          <label>
            Devise
            <select id="currency">
              <option value="TND">TND</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label>
            Date
            <input id="invDate" type="date" />
          </label>
          <label>
            Date d'echeance
            <input id="invDue" type="date" />
          </label>
        </div>

        <div id="recentInvoices" class="full">
          <h4>Dernieres factures</h4>
          <div id="recentInvoicesList" class="muted"></div>
        </div>
      </fieldset>

      <fieldset class="section-box">
        <legend>Informations entreprise :</legend>
        <div class="grid two">
          <label>Nom de l'entreprise
            <input id="companyName" placeholder="SoukElMeuble SARL" />
          </label>
          <label>Identifiant fiscal / TVA
            <input id="companyVat" placeholder="1891628/W/A/M000" />
          </label>
          <label>Telephone
            <input id="companyPhone" placeholder="+216 27 673 561" />
          </label>
          <label>E-mail
            <input id="companyEmail" placeholder="contact@SoukElMeuble.com" />
          </label>
          <label class="full">Adresse
            <input id="companyAddress" placeholder="Rue Mahbouba Soussia 2080 Teboulba" />
          </label>

          <div class="full" style="margin-top: 8px">
            <div class="label-inline" style="margin-bottom: 6px">
              <span class="label-text">Afficher le cachet</span>
              <input id="sealEnabled" type="checkbox" class="col-toggle" />
            </div>
            <div id="sealFields" style="display: none">
              <div class="grid two" style="gap: 12px; align-items: center">
                <button id="btnPickSeal" type="button" class="btn">Joindre un cachet scanne...</button>
              </div>
              <div id="sealPreviewWrap" class="muted" style="margin-top: 10px; display: none">
                <img id="sealPreview" alt="Apercu cachet" style="max-width: 220px; max-height: 160px; display: block;" />
              </div>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="section-box">
        <legend>Client</legend>
        <div class="grid two">
          <label class="full">Type de client
            <select id="clientType">
              <option value="societe" selected>Societe / personne morale</option>
              <option value="particulier">Particulier</option>
            </select>
          </label>
          <label>Nom du client
            <input id="clientName" placeholder="Client ou Entreprise" />
          </label>
          <label>
            <span id="clientIdLabel">
              <span class="for-soc">Identifiant fiscal / TVA</span>
              <span class="for-part">CIN / passeport</span>
            </span>
            <input id="clientVat" placeholder="XXXXXXXXX" />
          </label>
          <label>Telephone du client
            <input id="clientPhone" placeholder="+216 ..." />
          </label>
          <label>E-mail du client
            <input id="clientEmail" placeholder="client@email.com" />
          </label>
          <label class="full">Adresse du client
            <input id="clientAddress" placeholder="Rue, Ville, Pays" />
          </label>
        </div>
        <div class="full" style="display:flex; gap:8px; margin-top:8px">
          <button id="btnSaveClient" type="button" class="btn">Enregistrer le client</button>
          <button id="btnLoadClient" type="button" class="btn">Charger un client...</button>
        </div>
      </fieldset>
    </section>

    <section class="flexit">
      <div class="item-search">
        <label for="itemSearchInput" class="item-search__label">Rechercher un article</label>
        <div class="item-search__row">
          <input id="itemSearchInput" type="search" placeholder="Rechercher un article (nom, reference...)" autocomplete="off" />
          <button id="itemSearchButton" type="button" class="btn">Ajouter</button>
        </div>
        <div id="itemSearchResults" class="item-search__results" role="listbox" aria-label="Suggestions d'articles"></div>
      </div>
      <div class="table-wrap tabM">
        <table id="items">
          <thead>
            <tr>
              <th style="width: 10%">Ref.</th>
              <th style="width: 15%">Produit(s)</th>
              <th style="width: 20%">Description(s)</th>
              <th>Qte</th>
              <th>Prix HT</th>
              <th>TVA %</th>
              <th>Remise %</th>
              <th>Total TTC</th>
              <th style="width: 15%">Action</th>
            </tr>
          </thead>
          <tbody id="itemBody"></tbody>
        </table>
      </div>

      <div class="mini-sum">
        <table id="miniSum">
          <tbody>
            <tr id="miniShipRow" style="display: none">
              <td id="miniShipLabel">Frais de livraison</td>
              <td id="miniShip" class="right">0</td>
            </tr>
            <tr id="miniFODECRow" style="display: none">
              <td id="miniFODECLabel">FODEC (1%)</td>
              <td id="miniFODEC" class="right">0</td>
            </tr>
            <tr class="head">
              <th>Total HT</th>
              <th id="miniHT" class="right">0</th>
            </tr>
            <tr>
              <td>TVA</td>
              <td id="miniTVA" class="right">0</td>
            </tr>
            <tr id="miniStampRow" style="display: none">
              <td id="miniStampLabel">Timbre fiscal</td>
              <td id="miniStamp" class="right">0</td>
            </tr>
            <tr class="grand">
              <th>Total TTC</th>
              <th id="miniTTC" class="right">0</th>
            </tr>
            <tr id="miniWHRow" style="display: none">
              <td id="miniWHLabel">Retenue a la source</td>
              <td id="miniWH" class="right">0</td>
            </tr>
            <tr id="miniNETRow" class="grand" style="display: none">
              <th>Net a payer</th>
              <th id="miniNET" class="right">0</th>
            </tr>
          </tbody>
        </table>
      </div>

      <fieldset class="section-box" id="extrasBox">
        <legend>Frais & options</legend>
        <div class="grid two">
          <div class="full">
            <div class="label-inline">
              <span class="label-text">Activer le FODEC</span>
              <input id="fodecEnabled" type="checkbox" class="col-toggle" aria-label="Activer le FODEC" aria-controls="fodecFields" />
            </div>
          </div>

          <div id="fodecFields" class="full">
            <label>Libelle
              <input id="fodecLabel" placeholder="FODEC" value="FODEC" />
            </label>
            <label>Taux %
              <input id="fodecRate" type="number" min="0" step="0.01" value="1" />
            </label>
            <label>Base de calcul
              <select id="fodecBase">
                <option value="ht" selected>Total HT (lignes)</option>
                <option value="ht_plus">HT + Livraison (sans timbre)</option>
                <option value="ttc_sans_fodec">TTC (sans FODEC)</option>
              </select>
            </label>
            <label>TVA %
              <input id="fodecTva" type="number" min="0" step="0.01" value="19" />
            </label>
            <label>Montant (auto)
              <input id="fodecAmount" readonly />
            </label>
          </div>

          <div class="full">
            <div class="label-inline" style="margin-top: 0.5rem">
              <span class="label-text">Activer les frais de livraison</span>
              <input id="shipEnabled" type="checkbox" class="col-toggle" aria-label="Activer les frais de livraison" />
            </div>
          </div>
          <div id="shipFields" class="full">
            <label>Libelle
              <input id="shipLabel" placeholder="Frais de livraison" />
            </label>
            <label>Montant HT
              <input id="shipAmount" type="number" min="0" step="0.01" value="7" />
            </label>
            <label>TVA %
              <input id="shipTva" type="number" min="0" step="0.01" value="19" />
            </label>
          </div>

          <div class="full" style="margin-top: 0.5rem">
            <div class="label-inline">
              <span class="label-text">Activer le timbre fiscal</span>
              <input id="stampEnabled" type="checkbox" class="col-toggle" aria-label="Activer le timbre fiscal" />
            </div>
          </div>
          <div id="stampFields" class="full">
            <label>Libelle
              <input id="stampLabel" placeholder="Timbre fiscal" />
            </label>
            <label>Montant HT
              <input id="stampAmount" type="number" min="0" step="0.001" value="1" />
            </label>
            <label>TVA %
              <input id="stampTva" type="number" min="0" step="0.01" value="0" />
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset class="section-box" id="whBox">
        <legend>Retenue a la source</legend>
        <div class="full" style="margin-top: 0.5rem">
          <div class="label-inline">
            <span class="label-text">Activer la retenue a la source</span>
            <input id="whEnabled" type="checkbox" class="col-toggle" aria-label="Activer la retenue a la source" />
          </div>
        </div>
        <div id="whFields">
          <label>Taux %
            <input id="whRate" type="number" min="0" step="0.01" value="1.5" />
          </label>
          <label>Base de calcul
            <select id="whBase">
              <option value="ht" selected>Total HT</option>
              <option value="ttc">Total TTC</option>
            </select>
          </label>
          <label>Seuil (Montant &gt;)
            <input id="whThreshold" type="number" min="0" step="0.01" value="1000" />
          </label>
          <label class="full">Libelle (facultatif)
            <input id="whLabel" placeholder="Retenue a la source" />
          </label>
          <label>Montant (auto)
            <input id="whAmount" readonly />
          </label>
        </div>
      </fieldset>
    </section>

    <section class="grid">
      <fieldset class="section-box">
        <legend>Notes</legend>
        <label>
          <textarea id="notes" class="notes" rows="4" maxlength="700" placeholder="Conditions de paiement, coordonnees bancaires, notes de projet..."></textarea>
        </label>
      </fieldset>
    </section>
  `;

  const forceExtrasVisibilityFromCheckboxes = () => {
    try {
      const cbF = document.getElementById("fodecEnabled");
      const cbS = document.getElementById("shipEnabled");
      const cbT = document.getElementById("stampEnabled");
      const cbW = document.getElementById("whEnabled");
      if (window.SEM?.toggleFodecFields) window.SEM.toggleFodecFields(!!cbF?.checked);
      if (window.SEM?.toggleShipFields)  window.SEM.toggleShipFields(!!cbS?.checked);
      if (window.SEM?.toggleStampFields) window.SEM.toggleStampFields(!!cbT?.checked);
      if (window.SEM?.toggleWHFields)    window.SEM.toggleWHFields(!!cbW?.checked);
    } catch {}
  };
  const setupFieldVisibilityMenu = () => {
    const btn = document.getElementById("fieldVisibilityButton");
    const menu = document.getElementById("fieldVisibilityMenu");
    if (!btn || !menu) return;
    let open = false;
    const setOpen = (value) => {
      open = !!value;
      menu.style.display = open ? "block" : "none";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.classList.toggle("is-open", open);
      menu.classList.toggle("is-open", open);
    };
    setOpen(false);
    if (!btn.dataset.menuSetup) {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(!open);
      });
      btn.dataset.menuSetup = "true";
    }
    if (window.__SEM_FieldVisibilityListener) {
      document.removeEventListener("click", window.__SEM_FieldVisibilityListener);
    }
    const onDocumentClick = (event) => {
      if (!open) return;
      if (!menu.contains(event.target) && event.target !== btn) setOpen(false);
    };
    window.__SEM_FieldVisibilityListener = onDocumentClick;
    document.addEventListener("click", onDocumentClick);
  };

  // NEW: JS fallback to switch the label & placeholder when client type changes
  const updateClientIdVisual = () => {
    const sel = document.getElementById("clientType");
    const type = String(sel?.value || "").toLowerCase();
    const isPart = type === "particulier";
    const soc = document.querySelector("#clientIdLabel .for-soc");
    const part = document.querySelector("#clientIdLabel .for-part");
    const idInput = document.getElementById("clientVat");
    if (soc)  soc.style.display  = isPart ? "none"   : "inline";
    if (part) part.style.display = isPart ? "inline" : "none";
    if (idInput) idInput.placeholder = isPart ? "CIN / passeport" : "XXXXXXXXX";
  };

  const updateDocTypeVisual = () => {
    const select = document.getElementById("docType");
    const value = String(select?.value || "facture").toLowerCase();
    const types = ["facture", "devis", "bl", "bc"];
    types.forEach((slug) => {
      const show = slug === value;
      document
        .querySelectorAll(`#docTypeLegend .for-${slug}, #invNumberLabel .for-${slug}`)
        .forEach((node) => {
          node.style.display = show ? "inline" : "none";
        });
    });
  };
  if (window.SEM) {
    window.SEM.updateDocTypeVisual = updateDocTypeVisual;
  }

  document.getElementById("clientType")?.addEventListener("change", updateClientIdVisual);
  document.getElementById("clientType")?.addEventListener("input", updateClientIdVisual);
  document.getElementById("docType")?.addEventListener("change", updateDocTypeVisual);
  document.getElementById("docType")?.addEventListener("input", updateDocTypeVisual);
  setupFieldVisibilityMenu();

  try {
    if (window.SEM?.initCreateInvoice) window.SEM.initCreateInvoice(root);
    else setTimeout(() => window.SEM?.initCreateInvoice?.(root), 0);
  } catch (e) { console.error("initCreateInvoice error:", e); }

  const seedAndRender = () => {
    try {
      if (!Array.isArray(window.SEM?.state?.items) || window.SEM.state.items.length === 0) {
        window.SEM?.newInvoice?.();
      }
      if (window.SEM?.UI?.render) window.SEM.UI.render();
      else if (window.SEM?.bind) window.SEM.bind();
    } catch (e) { console.error(e); }
    forceExtrasVisibilityFromCheckboxes();
    updateClientIdVisual();
    updateDocTypeVisual();
  };

  seedAndRender();
  setTimeout(seedAndRender, 0);
}

export function unmount(root) {
  if (window.__SEM_FieldVisibilityListener) {
    document.removeEventListener("click", window.__SEM_FieldVisibilityListener);
    delete window.__SEM_FieldVisibilityListener;
  }
  root.innerHTML = "";
}

export default { mount, unmount };
