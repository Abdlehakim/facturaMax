// createInvoice/CreateInvoice.js
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
              <span class="for-facture">N° de facture</span>
              <span class="for-devis">N° de devis</span>
              <span class="for-bl">N° de bon de livraison</span>
              <span class="for-bc">N° de bon de commande</span>
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
        </div>

        <div id="recentInvoices" class="full">
          <h4>Dernières factures</h4>
          <div id="recentInvoicesList" class="muted"></div>
        </div>
      </fieldset>

      <fieldset class="section-box">
        <legend>Informations entreprise :</legend>
        <div class="grid two">
          <label>Nom de l’entreprise
            <input id="companyName" placeholder="SoukElMeuble SARL" />
          </label>
          <label>Identifiant fiscal / TVA
            <input id="companyVat" placeholder="1891628/W/A/M000" />
          </label>
          <label>Téléphone
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
                <button id="btnPickSeal" type="button" class="btn">Joindre un cachet scanné…</button>
              </div>
              <div id="sealPreviewWrap" class="muted" style="margin-top: 10px; display: none">
                <img id="sealPreview" alt="Aperçu cachet" style="max-width: 220px; max-height: 160px; display: block;" />
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
              <option value="societe" selected>Société / personne morale</option>
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
          <label>Téléphone du client
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
          <button id="btnLoadClient" type="button" class="btn">Charger un client…</button>
        </div>
      </fieldset>
    </section>

    <section class="flexit">
      <div class="table-wrap tabM">
        <table id="items">
          <thead>
            <tr>
              <th style="width: 10%">Réf.</th>
              <th style="width: 15%">Produit(s)</th>
              <th style="width: 20%">Description(s)</th>
              <th>Qté</th>
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
              <td id="miniWHLabel">Retenue à la source</td>
              <td id="miniWH" class="right">0</td>
            </tr>
            <tr id="miniNETRow" class="grand" style="display: none">
              <th>Net à payer</th>
              <th id="miniNET" class="right">0</th>
            </tr>
          </tbody>
        </table>
      </div>

      <fieldset class="section-box">
        <legend>Ajouter un article</legend>
        <div class="grid">
          <div class="grid four">
            <div class="field field-ref">
              <div class="label-inline">
                <label for="addRef" class="label-text">Référence</label>
                <input id="colToggleRef" type="checkbox" class="col-toggle" aria-label="Masquer colonne Référence" checked />
              </div>
              <input id="addRef" placeholder="ex. : SKU-12345" />
            </div>

            <div class="field field-product">
              <div class="label-inline">
                <label for="addProduct" class="label-text">Produit</label>
                <input id="colToggleProduct" type="checkbox" class="col-toggle" aria-label="Masquer colonne Produit" checked />
              </div>
              <input id="addProduct" placeholder="ex. : Ordinateur portable" />
            </div>

            <div class="field field-desc full">
              <div class="label-inline">
                <label for="addDesc" class="label-text">Description</label>
                <input id="colToggleDesc" type="checkbox" class="col-toggle" aria-label="Masquer colonne Description" checked />
              </div>
              <input id="addDesc" placeholder="ex. : Garantie 2 ans, couleur noire…" />
            </div>

            <div class="field field-qty">
              <div class="label-inline">
                <label for="addQty" class="label-text">Qté</label>
                <input id="colToggleQty" type="checkbox" class="col-toggle" aria-label="Masquer colonne Qté" checked />
              </div>
              <input id="addQty" type="number" min="0" step="1" value="1" />
            </div>

            <div class="field field-price">
              <div class="label-inline">
                <label for="addPrice" class="label-text">Prix&nbsp;HT</label>
                <input id="colTogglePrice" type="checkbox" class="col-toggle" aria-label="Masquer colonne Prix HT" checked />
              </div>
              <input id="addPrice" type="number" min="0" step="0.01" value="0" />
            </div>

            <div class="field field-tva">
              <div class="label-inline">
                <label for="addTva" class="label-text">TVA&nbsp;%</label>
                <input id="colToggleTva" type="checkbox" class="col-toggle" aria-label="Masquer colonne TVA" checked />
              </div>
              <input id="addTva" type="number" min="0" step="0.01" value="19" />
            </div>

            <div class="field field-discount">
              <div class="label-inline">
                <label for="addDiscount" class="label-text">Remise&nbsp;%</label>
                <input id="colToggleDiscount" type="checkbox" class="col-toggle" aria-label="Masquer colonne Remise" checked />
              </div>
              <input id="addDiscount" type="number" min="0" step="0.01" value="0" />
            </div>
          </div>

          <div class="add-actions end" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="btnSubmitItem" type="button" class="btn">+ Ajouter</button>
            <button id="btnNewItem" type="button" class="btn">Nouveau</button>
            <button id="btnSaveItem" type="button" class="btn">Enregistrer l’article</button>
            <button id="btnLoadItem" type="button" class="btn">Charger un article…</button>
          </div>
        </div>
      </fieldset>

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
            <label>Libellé
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
            <label>Libellé
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
            <label>Libellé
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
        <legend>Retenue à la source</legend>
        <div class="full" style="margin-top: 0.5rem">
          <div class="label-inline">
            <span class="label-text">Activer la retenue à la source</span>
            <input id="whEnabled" type="checkbox" class="col-toggle" aria-label="Activer la retenue à la source" />
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
          <label class="full">Libellé (facultatif)
            <input id="whLabel" placeholder="Retenue à la source" />
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
          <textarea id="notes" class="notes" rows="4" maxlength="700" placeholder="Conditions de paiement, coordonnées bancaires, notes de projet…"></textarea>
        </label>
      </fieldset>
    </section>
  `;

  // 1) Let the per-panel initializer wire events/IPC
  try {
    if (window.SEM?.initCreateInvoice) {
      window.SEM.initCreateInvoice(root);
    } else {
      setTimeout(() => window.SEM?.initCreateInvoice?.(root), 0);
    }
  } catch (e) { console.error("initCreateInvoice error:", e); }

  // 2) Seed + first render (works whether lib renderer or SEM.bind is used)
  const seedAndRender = () => {
    try {
      if (!Array.isArray(window.SEM?.state?.items) || window.SEM.state.items.length === 0) {
        window.SEM?.newInvoice?.();
      }
      if (window.SEM?.UI?.render) window.SEM.UI.render();
      else if (window.SEM?.bind) window.SEM.bind();
    } catch (e) { console.error(e); }
  };
  seedAndRender();
  setTimeout(seedAndRender, 0);
}

export function unmount(root) {
  root.innerHTML = "";
}

// Some desktop bundlers import default
export default { mount, unmount };
