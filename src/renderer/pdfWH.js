// pdfWH.js — Certificat de Retenue d'Impôt (style officiel, sans logo)
// Règle demandée : ne jamais masquer la section "IDENTIFIANT" du bénéficiaire.
// Si aucune donnée (ex. client = Particulier), afficher la grille vide.
(function (global) {
  const PDF_CSS = `
:root{
  --invoice-font: -apple-system, BlinkMacSystemFont, "Segoe UI",
                  Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, "Noto Sans", sans-serif;
}
body.printing, body.print-mode { background:#ffffff !important; }
body.printing #pdfRoot, body.print-mode #pdfRoot { display:block !important; }

.wh-page{
  position:relative;
  width:210mm; min-height:297mm;
  background:#ffffff; color:#000;
  padding:12mm 12mm;
  box-sizing:border-box;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  font-family: var(--invoice-font);
  font-variant-numeric: tabular-nums;
  letter-spacing:.01em;
}

/* Header bloc at left + centered title */
.wh-grid-head{
  display:grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items:center;
  column-gap:6mm;
}
.wh-admin{
  font-size:10.5px;
  line-height:1.25;
  text-transform:uppercase;
  font-weight:600;
}
.wh-center-title{
  text-align:center;
  line-height:1.15;
}
.wh-center-title .t1{ font-size:16px; font-weight:600; text-transform:uppercase; }
.wh-center-title .t2{ font-size:12.5px; font-weight:600; text-transform:uppercase; margin-top:2px; }
.wh-center-title .t3{ font-size:12.5px; font-weight:600; text-transform:uppercase; margin-top:2px; }
.wh-right-placeholder{}

/* "Retenue effectuée le ..." strip */
.wh-when{
  margin-top:4mm;
  text-align:center;
  font-size:11.5px;
}
.wh-when .small{ font-size:10.5px; }

/* Section frames A / B / C */
.wh-frame{
  border:1px solid #000;
  border-radius:2px;
  margin-top:6mm;
  padding:0;
}
.wh-frame .legend{
  display:inline-block;
  transform:translateY(-55%);
  background:#fff;
  padding:0 6px;
  margin-left:6px;
  font-size:12px;
  font-weight:600;
  letter-spacing:.02em;
  text-transform:uppercase;
}
.wh-frame-inner{ padding:10px 10px 12px; }

/* IDENTIFIANT grid with boxed cells */
.id-grid{
  margin-top:6px;
  border:1px solid #000;
  display:grid;
  grid-template-columns: 1fr 120px 150px 130px;
  align-items:stretch;
}
.id-cell{
  border-left:1px solid #000;
  padding:4px 6px;
}
.id-cell:first-child{ border-left:none; }
.id-head{
  display:flex; align-items:center; justify-content:center;
  font-size:10px; font-weight:600; text-transform:uppercase; margin-bottom:4px;
}
.boxline{ display:flex; gap:2px; flex-wrap:wrap; }
.box{
  border:1px solid #000;
  width:14px; height:18px;
  display:flex; align-items:center; justify-content:center;
  font-weight:600; font-size:11px;
}

/* simple key/value lines */
.kv{ font-size:12px; margin-top:8px; }
.kv .lab{ font-weight:600; text-transform:none; }
.kv .dots{ border-bottom:1px dotted #000; flex:1; margin:0 6px; height:10px; }
.kv .row{ display:flex; align-items:flex-end; gap:6px; margin-top:6px; }

/* B table */
.wh-table{ width:100%; border-collapse:collapse; margin-top:4px; }
.wh-table th, .wh-table td{
  border:1px solid #000;
  padding:6px 8px;
  font-size:12px;
}
.wh-table th{ background:#e9e9e9; font-weight:600; }
.wh-table .num{ text-align:right; }
.wh-table .label{ height:24px; }
.wh-table .total th{ background:#e0e0e0; }

/* C section ID boxes (CIN/passport) */
.cin-row{
  display:flex; align-items:center; gap:10px; margin-top:8px; font-size:12px;
}
.cin-label{ white-space:nowrap; }
.cin-boxes{ display:flex; gap:2px; }
.cin-box{ border:1px solid #000; width:14px; height:18px; }

/* Bottom */
.cert{ margin-top:10mm; font-size:12px; text-align:left; line-height:1.35; }
.place-date{ margin-top:6mm; text-align:center; font-size:12.5px; font-weight:600; }
.signature{ margin-top:6mm; text-align:center; font-size:12px; }
`;

  // ---------- helpers ----------
  const esc = (s = "") =>
    String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  const fmt3 = (n) =>
    new Intl.NumberFormat("fr-FR", { minimumFractionDigits:3, maximumFractionDigits:3 })
      .format(Number(n||0));

  function parseMF(raw) {
    const out = { mf:"", tva:"", cat:"", estab:"" };
    if (!raw) return out;
    const parts = String(raw).trim().split(/[^0-9A-Za-z]+/).filter(Boolean);
    if (parts.length) out.mf   = parts[0] || "";
    if (parts.length > 1) out.tva  = parts[1] || "";
    if (parts.length > 2) out.cat  = parts[2] || "";
    if (parts.length > 3) out.estab= parts.slice(3).join("");
    return out;
  }

  function boxify(str = "", maxLen = 12) {
    const arr = String(str).slice(0, maxLen).split("");
    const cells = arr.map(ch => `<div class="box">${esc(ch)}</div>`).join("");
    const pad = Math.max(0, maxLen - arr.length);
    const empty = Array.from({length: pad}, () => `<div class="box"></div>`).join("");
    return `<div class="boxline">${cells}${empty}</div>`;
  }

  // Totals aligned with app rules
  function totalsForWH(state) {
    const items = Array.isArray(state?.items) ? state.items : [];
    const ex    = state?.meta?.extras || {};

    let subtotal=0, totalDiscount=0, totalTax=0;
    for (const it of items) {
      const base = Number(it.qty||0) * Number(it.price||0);
      const disc = base * (Number(it.discount||0)/100);
      const after= Math.max(0, base - disc);
      const tax  = after * (Number(it.tva||0)/100);
      subtotal += base; totalDiscount += disc; totalTax += tax;
    }
    const totalHT_items  = subtotal - totalDiscount;
    const totalTTC_items = totalHT_items + totalTax;

    const shipHT  = ex?.shipping?.enabled ? Number(ex.shipping.amount||0) : 0;
    const shipTVA = shipHT * (Number(ex?.shipping?.tva||0)/100);
    const shipTT  = shipHT + shipTVA;

    const stampHT  = ex?.stamp?.enabled ? Number(ex.stamp.amount||0) : 0;
    const stampTVA = stampHT * (Number(ex?.stamp?.tva||0)/100);
    const stampTT  = stampHT + stampTVA;

    const totalHT_all  = totalHT_items + shipHT;            // stamp exclu
    const totalTTC_all = totalTTC_items + shipTT + stampTT; // stamp inclu
    return { totalHT_all, totalTTC_all };
  }

  function build(state, assets) {
    const company = state?.company || {};
    const client  = state?.client  || {};
    const meta    = state?.meta    || {};

    const wh = meta.withholding || {};
    const enabled   = !!wh.enabled;
    const rate      = Number(wh.rate || 0);
    const base      = (wh.base === "ttc") ? "ttc" : "ht";
    const threshold = Number(wh.threshold || 0);

    const { totalHT_all, totalTTC_all } = totalsForWH(state);
    const baseVal = base === "ttc" ? totalTTC_all : totalHT_all;
    const retenue = (enabled && baseVal > threshold) ? Math.max(0, baseVal) * (rate/100) : 0;
    const net     = Math.max(0, baseVal - retenue);

    // client type
    const clientTypeRaw = (state?.clientType || state?.client?.type || "").toString().toLowerCase();
    const isParticulier = clientTypeRaw.includes("particulier");

    // identifiers
    const payerIds = parseMF(company.vat);
    // IMPORTANT: if particulier, keep beneficiary IDENTIFIANT grid but empty
    const beneIds  = isParticulier ? { mf:"", tva:"", cat:"", estab:"" } : parseMF(client.vat);

    const date = meta.date || new Date().toISOString().slice(0,10);
    const placeGuess = (company.address || "").match(/\b([A-Za-zÀ-ÖØ-öø-ÿ\u0600-\u06FF\s'-]{2,})\s*\d*\s*$/)?.[1] || "Tunis";

    // A — payeur
    const identGridA = `
      <div class="id-grid">
        <div class="id-cell">
          <div class="id-head">MATRICULE FISCAL</div>
          ${boxify(payerIds.mf, 12)}
        </div>
        <div class="id-cell">
          <div class="id-head">Code T.V.A</div>
          ${boxify(payerIds.tva, 3)}
        </div>
        <div class="id-cell">
          <div class="id-head">Code catégorie(2)</div>
          ${boxify(payerIds.cat, 3)}
        </div>
        <div class="id-cell">
          <div class="id-head">N° Etab. Secondaire</div>
          ${boxify(payerIds.estab || "000", 3)}
        </div>
      </div>`;

    // C — bénéficiaire (toujours visible, mais peut être vide)
    const identGridC = `
      <div class="id-grid">
        <div class="id-cell">
          <div class="id-head">MATRICULE FISCAL</div>
          ${boxify(beneIds.mf, 12)}
        </div>
        <div class="id-cell">
          <div class="id-head">Code T.V.A</div>
          ${boxify(beneIds.tva, 3)}
        </div>
        <div class="id-cell">
          <div class="id-head">Code catégorie(2)</div>
          ${boxify(beneIds.cat, 3)}
        </div>
        <div class="id-cell">
          <div class="id-head">N° Etab. Secondaire</div>
          ${boxify(beneIds.estab || "", 3)}
        </div>
      </div>`;

    // B — table
    const rowEmpty = `<tr>
      <td class="label">Honoraires, commissions, courtages, vacations et loyers…</td>
      <td class="num"></td><td class="num"></td><td class="num"></td>
    </tr>
    <tr><td class="label">BENEFICES DISTRIBUES</td><td class="num"></td><td class="num"></td><td class="num"></td></tr>
    <tr><td class="label">Revenus des comptes spéciaux d’épargne ouverts auprès des banque</td><td class="num"></td><td class="num"></td><td class="num"></td></tr>
    <tr><td class="label">Revenus des capitaux mobiliers…</td><td class="num"></td><td class="num"></td><td class="num"></td></tr>
    <tr><td class="label">Revenus des bons de caisse au porteur…</td><td class="num"></td><td class="num"></td><td class="num"></td></tr>`;

    const marchRow = `<tr>
      <td class="label">Marchés…</td>
      <td class="num">${fmt3(baseVal)}</td>
      <td class="num">${fmt3(retenue)}</td>
      <td class="num">${fmt3(net)}</td>
    </tr>`;

    const totalRow = `<tr class="total">
      <th>Total général……</th>
      <th class="num">${fmt3(baseVal)}</th>
      <th class="num">${fmt3(retenue)}</th>
      <th class="num">${fmt3(net)}</th>
    </tr>`;

    // CIN/Passeport : rempli uniquement si Particulier
    const cinValue = isParticulier ? String(client.vat || "").replace(/[^0-9A-Za-z]/g, "") : "";
    const cinBoxesFilled = Array.from({length:10}, (_,i)=>`<div class="cin-box">${cinValue[i] ? esc(cinValue[i]) : ""}</div>`).join("");

    return `
      <div class="wh-page">
        <div class="wh-grid-head">
          <div class="wh-admin">
            REPUBLIQUE TUNISIENNE<br/>
            MINISTERE DU PLAN ET DES FINANCES<br/>
            DIRECTION GENERALE<br/>
            DU CONTROLE FISCAL
          </div>
          <div class="wh-center-title">
            <div class="t1">CERTIFICAT DE RETENUE D’IMPÔT</div>
            <div class="t2">SUR LE REVENU</div>
            <div class="t3">OU D’IMPÔT SUR LES SOCIÉTÉS</div>
          </div>
          <div class="wh-right-placeholder"></div>
        </div>

        <div class="wh-when">
          Retenue effectuée le <strong>${esc(date)}</strong><br/>
          <span class="small">ou pendant (1) la période du</span>
        </div>

        <!-- A -->
        <div class="wh-frame">
          <div class="legend">A. – PERSONNE OU ORGANISME PAYEUR</div>
          <div class="wh-frame-inner">
            <div style="font-size:12px; font-weight:600; margin-bottom:4px;">IDENTIFIANT</div>
            ${identGridA}
            <div class="kv">
              <div class="row">
                <span class="lab">Dénomination de la personne ou de l’organisme payeur</span>
                <span class="dots"></span>
                <span style="font-weight:600;">${esc(company.name || "")}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- B -->
        <div class="wh-frame">
          <div class="legend">B. – RETENUES EFFECTUÉES SUR :</div>
          <div class="wh-frame-inner">
            <table class="wh-table">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th class="num">Montant brut</th>
                  <th class="num">Retenue</th>
                  <th class="num">Montant net</th>
                </tr>
              </thead>
              <tbody>
                ${rowEmpty}
                ${marchRow}
                ${totalRow}
              </tbody>
            </table>
          </div>
        </div>

        <!-- C -->
        <div class="wh-frame">
          <div class="legend">C. – BENEFICIAIRE</div>
          <div class="wh-frame-inner">
            <div class="cin-row">
              <div class="cin-label">N° de la carte d’identité</div>
              <div>ou</div>
              <div class="cin-label">PASSEPORT</div>
              <div class="cin-boxes">${cinBoxesFilled}</div>
            </div>

            <div style="font-size:12px; font-weight:600; margin:10px 0 4px;">IDENTIFIANT</div>
            ${identGridC}

            <div class="kv">
              <div class="row">
                <span class="lab">Nom, prénom ou raison sociale</span>
                <span class="dots"></span>
                <span style="font-weight:600;">${esc(client.name || "")}</span>
              </div>
              <div class="row">
                <span class="lab">Adresse professionnelle</span>
                <span class="dots"></span>
                <span>${esc(client.address || "")}</span>
              </div>
              <div class="row">
                <span class="lab">Adresse de résidence</span>
                <span class="dots"></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>

        <div class="cert">
          Je soussigné, certifie exacts les renseignements figurant sur le présent
          certificat et m’expose aux sanctions prévues par la loi pour toute inexactitude.
        </div>

        <div class="place-date">
          A ${esc(placeGuess)}, le <span>${esc(date)}</span>
        </div>

        <div class="signature">
          cachet et signature du payeur
        </div>
      </div>
    `;
  }

  function ensureRoot() {
    let root = document.getElementById("pdfRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "pdfRoot";
      document.body.appendChild(root);
    }
    return root;
  }

  function render(state, assets) {
    const root = ensureRoot();
    root.innerHTML = build(state, assets);
  }

  global.PDFWH = { build, render, css: PDF_CSS };
})(window);
