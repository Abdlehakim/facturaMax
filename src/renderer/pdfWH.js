// pdfWH.js — Certificat de Retenue à la Source (separate PDF)
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
  padding:18mm 16mm;
  box-sizing:border-box;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  font-family: var(--invoice-font);
  font-variant-numeric: tabular-nums;
}
.wh-head{display:flex;justify-content:space-between;align-items:center}
.wh-title{font-size:14px;font-weight:700;margin:0;color:#111827; max-width:500px}
.wh-sub{font-size:12px;color:#374151;margin:2px 0 0 0}
.wh-logo{max-width:280px; max-height:44px; object-fit:contain; display:block}
.wh-divider{height:2px; background:#15335e; margin:14px 0 18px}

.wh-grid-2{display:grid; grid-template-columns:1fr 1fr; gap:16px; font-size:13px}
.group{border:1px solid #15335e; border-radius:5px; padding:12px; background:#fff;}
.group legend{font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.02em; padding:0 6px}
.kv{display:flex;flex-direction: column; font-size:12px}
.kv b{font-weight:700}

.wh-table-wrap{margin-top:18px; border-radius:5px; border:2px solid #15335e; overflow:hidden}
.wh-table{width:100%; font-size:12px}
.wh-table th{background:#15335e; color:#fff; text-align:left; padding:8px}
.wh-table td{padding:8px}

.wh-amount{margin-top:18px; display:flex; justify-content:flex-end}
.wh-amount table{min-width:280px; border:2px solid #15335e; border-radius:5px}
.wh-amount th, .wh-amount td{padding:8px; font-size:12px; text-align:right}
.wh-amount .head th{background:#15335e; color:#fff; text-align:center}
.wh-amount .grand th{background:#15335e; color:#fff; font-size:14px}
.wh-amount td{text-align:center}

.wh-foot{position:absolute; bottom:10mm; left:16mm; right:16mm; display:flex; justify-content:space-between; gap:24px; font-size:12px}
.sign{width:45%;font-size:10px}
.sign .line{border-top:1px solid #000;width:180px}
.notes{max-width:380px; font-size:11px; line-height:1.25}
`;

  const esc = (s = "") =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const hasVal = (v) => (v ?? "").toString().trim().length > 0;

  const fmtMoney = (v, c) => {
    const n = Number(v || 0);
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n); }
    catch { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " " + (c || ""); }
  };

  // === Totals including Extras (Frais de livraison & Timbre fiscal) ===
  function totalsFromState(state) {
    const items = Array.isArray(state?.items) ? state.items : [];
    const ex     = state?.meta?.extras || {};

    const extraRows = [];
    if (ex?.shipping?.enabled && Number(ex.shipping.amount) > 0) {
      extraRows.push({
        qty: 1,
        price: Number(ex.shipping.amount) || 0,
        tva: Number(ex.shipping.tva) || 0,
        discount: 0
      });
    }
    if (ex?.stamp?.enabled && Number(ex.stamp.amount) > 0) {
      extraRows.push({
        qty: 1,
        price: Number(ex.stamp.amount) || 0,
        tva: Number(ex.stamp.tva) || 0,
        discount: 0
      });
    }

    const itemsPlus = [...items, ...extraRows];

    let subtotal = 0, totalTax = 0, totalDiscount = 0;
    for (const it of itemsPlus) {
      const base = Number(it.qty||0) * Number(it.price||0);
      const disc = base * (Number(it.discount||0)/100);
      const taxedBase = Math.max(0, base - disc);
      const tax = taxedBase * (Number(it.tva||0)/100);
      subtotal += base; totalDiscount += disc; totalTax += tax;
    }
    const totalHT  = subtotal - totalDiscount;
    const totalTTC = totalHT + totalTax;
    return { subtotal, totalDiscount, totalTax, totalHT, totalTTC };
  }

  function build(state, assets) {
    const company = state?.company || {};
    const client  = state?.client  || {};
    const meta    = state?.meta    || {};
    const cur     = meta.currency || "TND";
    const logo    = assets?.logo || company.logo || "";

    const wh = meta.withholding || {};
    const enabled = !!wh.enabled;
    const rate = Number(wh.rate || 0);
    const base = (wh.base === "ttc") ? "ttc" : "ht";
    const label = (wh.label ?? "Retenue à la source").trim() || "Retenue à la source";

    // compute base and amount (now includes extras if enabled on the invoice)
    const { totalHT, totalTTC } = totalsFromState(state);
    const baseVal  = base === "ttc" ? totalTTC : totalHT;
    const whAmount = enabled ? Math.max(0, baseVal) * (rate/100) : 0;

    const baseLabel = base === "ttc" ? "Total TTC" : "Total HT";

    const companyAddr = hasVal(company.address) ? `<div><b>Adresse</b> : ${esc(company.address)}</div>` : "";
    const companyVat  = hasVal(company.vat)     ? `<div><b>MF</b> : ${esc(company.vat)}</div>` : "";
    const companyTel  = hasVal(company.phone)   ? `<div><b>Téléphone</b> : ${esc(company.phone)}</div>` : "";
    const companyMail = hasVal(company.email)   ? `<div><b>Email</b> : ${esc(company.email)}</div>` : "";

    const clientVat   = hasVal(client.vat)      ? `<div><b>MF</b> : ${esc(client.vat)}</div>` : "";
    const clientAddr  = hasVal(client.address)  ? `<div><b>Adresse</b> : ${esc(client.address)}</div>` : "";
    const clientPhone = hasVal(client.phone)    ? `<div><b>Téléphone</b> : ${esc(client.phone)}</div>` : "";
    const clientEmail = hasVal(client.email)    ? `<div><b>Email</b> : ${esc(client.email)}</div>` : "";

    return `
      <div class="wh-page">
        <div class="wh-head">
          <div>
            <h1 class="wh-title">Certificat de retenue d'impôt sur le revenu ou d'impôt sur les sociétés</h1>
            <p class="wh-sub">Relatif au document&nbsp;: ${esc(meta.docType || "facture")} n° ${esc(meta.number || "—")} — Date : ${esc(meta.date || "")}</p>
          </div>
          <div>${logo ? `<img class="wh-logo" src="${logo}" alt="Logo">` : ""}</div>
        </div>

        <div class="wh-divider"></div>

        <div class="wh-grid-2">
          <fieldset class="group">
            <legend>Émetteur</legend>
            <div class="kv">
              <div>${esc(company.name || "—")}</div>
              ${companyVat}
              ${companyAddr}
              ${companyTel}
              ${companyMail}
            </div>
          </fieldset>

          <fieldset class="group">
            <legend>Bénéficiaire</legend>
            <div class="kv">
              <div>${esc(client.name || "—")}</div>
              ${clientVat}
              ${clientAddr}
              ${clientPhone}
              ${clientEmail}
            </div>
          </fieldset>
        </div>

        <div class="wh-table-wrap">
          <table class="wh-table">
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Base</th>
                <th>Taux</th>
                <th>Montant retenu</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${esc(label)}</td>
                <td>${esc(baseLabel)} : ${fmtMoney(baseVal, cur)}</td>
                <td>${rate.toLocaleString(undefined, {maximumFractionDigits:2})}%</td>
                <td>${fmtMoney(whAmount, cur)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="wh-amount">
          <table>
            <tbody>
              <tr class="head"><th>Montant ${esc(label)}</th></tr>
              <tr><td>${fmtMoney(whAmount, cur)}</td></tr>
            </tbody>
          </table>
        </div>

        <div class="wh-foot">
          <div class="sign">
            <div class="line">Signature et cachet de l’émetteur</div>
            <div>Signé le : ${esc(meta.date || "")}</div>
          </div>
          <div class="notes">
            Ce certificat atteste de la retenue effectuée conformément à la réglementation en vigueur.
          </div>
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
