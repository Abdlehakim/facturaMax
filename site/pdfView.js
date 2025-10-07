(function (global) {
const PDF_CSS = `
:root{
  --invoice-font: -apple-system, BlinkMacSystemFont, "Segoe UI",
                  Arial, "Helvetica Neue", Helvetica, "Liberation Sans", Roboto, "Noto Sans", sans-serif;
}
html, body { margin:0; padding:0; }
body.printing, body.print-mode { background:#ffffff !important; }
body.printing .app, body.print-mode .app { display:none !important; }
body.printing #pdfRoot,
body.print-mode #pdfRoot {
  display:block !important;
  position:fixed;
  inset:0;
  background:#ffffff;
}

/* KEY FIXES */
@page { size:A4; margin:0; }
.pdf-page{
  position:relative;
  width:210mm;
  height:296.5mm;            /* <— slightly under 297mm to avoid rounding spill */
  background:#ffffff; color:#000000;
  padding:16mm 14mm;
  box-sizing:border-box;
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
  font-family: var(--invoice-font);
  font-variant-numeric: tabular-nums;
  letter-spacing:0.02em;
  overflow:hidden;            /* clip anything that might poke out */
  page-break-inside: avoid;   /* don’t split this node */
  break-inside: avoid-page;
  page-break-after: avoid;    /* don’t force a following blank page */
  break-after: avoid-page;
}
.pdf-page:last-child{
  page-break-after: avoid;    /* extra safety: no blank after last */
  break-after: avoid-page;
}

.pdf-head{display:flex;justify-content:space-between;align-items:center}
.pdf-title{font-size:18px;font-weight:700;margin:0;color:#111827; font-family: var(--invoice-font);}
.pdf-logo-wrap{width:298px;height:40px;display:flex;align-items:center;justify-content:flex-end}
.pdf-logo{max-width:100%;max-height:100%;object-fit:contain;display:block}
.pdf-divider{height:2px; background:#15335e;margin:12px 0 16px}
.title-divider{height:1px; background:#15335e;margin:0px 0px 8px; width:200px}
.title-divider-bot {height:1px; background:#15335e; margin:8px 0px; width:200px}
.pdf-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:14px}
.pdf-small{font-size:12px}
.pdf-meta{background:#f9fafb;padding:12px;border-radius:5px;margin-top:12px; width:280px}
.pdf-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:12px}
.tableDiv{ margin-top:20px; border-radius:5px; border:2px solid #15335e; overflow-x:auto; height:400px }
.pdf-table{ width:100%; font-size:10px; table-layout:auto; font-family: var(--invoice-font); }
.pdf-table th,.pdf-table td{ padding:4px; vertical-align:top }
.pdf-table thead th{ font-weight:600; background-color:#15335e; color:#fff; text-align:right; }
.pdf-table thead th:nth-child(1),
.pdf-table thead th:nth-child(2),
.pdf-table thead th:nth-child(3),
.pdf-table tbody td:nth-child(1),
.pdf-table tbody td:nth-child(2),
.pdf-table tbody td:nth-child(3){ text-align:left; }
.pdf-table tbody td:nth-child(6),  tbody td:nth-child(7){  white-space: nowrap; }
.pdf-table tbody tr td { border-bottom: 1px solid #15335e; }
.pdf-table tbody tr:last-child td { border-bottom: 0; }

.pdf-mini-sum{
  border:2px solid #15335e;
  min-width:200px;
  max-width:280px;
  margin-left:auto;
  border-radius:5px;
  margin-top:16px;
}
.pdf-mini-table{ width:100%}
.pdf-mini-table th,
.pdf-mini-table td{
  background:#fff;
  color:#0e1220;
  font-size:8px; font-weight:600;
  text-align:center;
  padding:4px;
  font-family: var(--invoice-font);
}
.pdf-mini-table .head th{ background:#15335e; color:#fff; }
.pdf-mini-table .grand th{ background:#15335e; font-size:10px; font-weight:600; color:#fff; }
.pdf-mini-table .right{ text-align:center; }

.pdf-footer{
  position:absolute;
  left:14mm;
  right:14mm;
  bottom:5mm;
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
}
.pdf-company{ font-size:9px; line-height:1.2; max-width:40%; }
.pdf-sign{ text-align:left; font-size:12px; }
.pdf-sign-line{ font-size:9px; margin:0; border-top:1px solid #000; width:150px; }

/* Keep this block from growing too tall */
.pdf-amount-words{
  position: absolute;
  display: flex;
  flex-direction: column;
  left: 15mm;
  top: 210mm;
  max-width: 45%;
  max-height: 68mm;          /* cap height so it never reaches footer */
  overflow: hidden;
  font-size: 12px;
  line-height: 1.25;
  font-weight: 500;
}

.section-box{
  position: relative;
  border: none;                 /* we’ll draw it ourselves */
  border-radius: 5px;
  padding: 14px 16px 16px;
  background: #fff;
}
.section-box::before{
  content: "";
  position: absolute;
  inset: 0;                     /* top/right/bottom/left: 0 */
  border: 1px solid #15335e;    /* your color */
  border-radius: 5px;
  pointer-events: none;         /* purely decorative */
}

/* LEGEND: color + let the border cross behind it */
.section-box > legend{
  margin: 0;
  font-weight: 700;
  color: #15335e;               /* requested color */
  padding: 0 8px;
  background: transparent;      /* allow the border to be visible across it */
  letter-spacing: 0.02em;
}

.pdf-notes{
  margin-top:10px;
  font-size:10px;
  line-height:1.25;
  font-weight:500;
  white-space: pre-wrap;
  word-break: break-word;
}
.pdf-notes-title{
  font-weight: 400;
  letter-spacing: .02em;
}
`;


  const CURRENCY_WORDS = {
    TND: { major: "dinars", minor: "millimes", minorFactor: 1000 },
    EUR: { major: "euros",  minor: "centimes", minorFactor: 100  },
    USD: { major: "dollars",minor: "cents",    minorFactor: 100  },
  };

  const esc = (s = "") =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const hasVal = (v) => (v ?? "").toString().trim().length > 0;

  const fmtMoney = (v, c) => {
    const n = Number(v || 0);
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: c }).format(n); }
    catch { return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " " + (c || ""); }
  };

  const joinCSV = (arr) => arr.filter(Boolean).join(", ");

  let cssInjected = false;
  function injectCssOnce() {
    if (cssInjected) return;
    const style = document.createElement("style");
    style.id = "pdfView-inline-css";
    style.textContent = PDF_CSS;
    document.head.appendChild(style);
    cssInjected = true;
  }

  function wordsFR(n) {
    if (typeof window !== "undefined" && window.n2words) return window.n2words(n, { lang: "fr" });
    const UNITS = ["zéro","un","deux","trois","quatre","cinq","six","sept","huit","neuf","dix","onze","douze","treize","quatorze","quinze","seize"];
    const TENS  = ["","dix","vingt","trente","quarante","cinquante","soixante"];
    const two = (x) => {
      if (x < 17) return UNITS[x];
      if (x < 20) return "dix-" + UNITS[x - 10];
      if (x < 70) { const t = Math.floor(x / 10), u = x % 10; if (u === 1 && t !== 8) return TENS[t] + " et un"; return TENS[t] + (u ? "-" + UNITS[u] : ""); }
      if (x < 80) return "soixante-" + two(x - 60);
      const u = x - 80; if (u === 0) return "quatre-vingts"; return "quatre-vingt-" + two(u);
    };
    const hundred = (h, tail) => { if (h === 0) return tail; if (h === 1) return "cent" + (tail ? " " + tail : ""); return ("cent".replace(/^/, UNITS[h] + " ") + (tail ? " " + tail : tail === "" ? "s" : "")); };
    const three = (x) => { const h = Math.floor(x / 100), r = x % 100; const tail = r ? two(r) : ""; if (h >= 2 && r === 0) return UNITS[h] + " cents"; return hundred(h, tail); };
    const chunk = (x, sing, plur) => { if (x === 0) return ""; if (sing === "mille") return x === 1 ? "mille" : two(x) + " mille"; return x === 1 ? "un " + sing : two(x) + " " + plur; };
    if (n === 0) return UNITS[0];
    let s = ""; let g = Math.floor(n / 1e9); n %= 1e9; let m = Math.floor(n / 1e6); n %= 1e6; let k = Math.floor(n / 1e3); n %= 1e3;
    if (g) s += chunk(g, "milliard", "milliards") + " ";
    if (m) s += chunk(m, "million", "millions") + " ";
    if (k) s += chunk(k, "mille", "mille") + " ";
    s += three(n).trim();
    return s.replace(/\s+/g, " ").trim();
  }

  function amountInWords(amount, currencyCode) {
    const cfg = CURRENCY_WORDS[currencyCode] || CURRENCY_WORDS.EUR;
    const rounded = Math.round((amount + 1e-9) * cfg.minorFactor) / cfg.minorFactor;
    let major = Math.floor(rounded + 1e-9);
    let minor = Math.round((rounded - major) * cfg.minorFactor);
    if (minor === cfg.minorFactor) { major += 1; minor = 0; }
    const majorPart = `${wordsFR(major)} ${cfg.major}`;
    const minorPart = minor ? ` et ${wordsFR(minor)} ${cfg.minor}` : "";
    return (majorPart + minorPart).replace(/^./, (c) => c.toUpperCase());
  }

  function getDocType(meta) {
    const m = meta || {};
    let t = (m.type ?? m.docType ?? "").toString().trim().toLowerCase();
    if (!t) {
      const sel = document.getElementById("docType");
      if (sel && sel.value) t = String(sel.value).trim().toLowerCase();
    }
    const blAliases = ["bl","bon","bon_livraison","bon-de-livraison","bon de livraison","bon livraison"];
    const bcAliases = ["bc","bon_commande","bon-de-commande","bon de commande","bon commande","commande"];
    if (blAliases.includes(t)) return "bl";
    if (bcAliases.includes(t)) return "bc";
    if (t === "devis") return "devis";
    return "facture";
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

  function hiddenColumnsFromDOM() {
    const b = document.body.classList;
    return {
      ref:       b.contains("hide-col-ref"),
      product:   b.contains("hide-col-product"),
      desc:      b.contains("hide-col-desc"),
      qty:       b.contains("hide-col-qty"),
      price:     b.contains("hide-col-price"),
      tva:       b.contains("hide-col-tva"),
      discount:  b.contains("hide-col-discount"),
      ttc:       b.contains("hide-col-ttc")
    };
  }

  function build(state, assets) {
    const company = state?.company || {};
    const client  = state?.client  || {};
    const meta    = state?.meta    || {};
    const items   = Array.isArray(state?.items) ? state.items : [];
    const ex      = meta?.extras || {};

    const shipEnabled = !!ex?.shipping?.enabled;
    const shipLabel   = (ex?.shipping?.label || "Frais de livraison");
    const shipHT      = Number(ex?.shipping?.amount) || 0;
    const shipTVApc   = Number(ex?.shipping?.tva)    || 0;
    const shipTVA     = shipHT * (shipTVApc / 100);
    const shipTTC     = shipHT + shipTVA;

    const stampEnabled = !!ex?.stamp?.enabled;
    const stampLabel   = (ex?.stamp?.label || "Timbre fiscal");
    const stampHT      = Number(ex?.stamp?.amount) || 0;
    const stampTVApc   = Number(ex?.stamp?.tva)    || 0;
    const stampTVA     = stampHT * (stampTVApc / 100);
    const stampTTC     = stampHT + stampTVA;

    const cur   = meta.currency || "TND";
    const logo = assets?.logo || company.logo || "./assets/logoSW.png";
    const type  = getDocType(meta);

    const MAP = {
      facture: { DOC_LABEL: "Facture",           NUM_LABEL: "N° de facture",          SHOW_WORDS: true  },
      devis:   { DOC_LABEL: "Devis",             NUM_LABEL: "N° de devis",            SHOW_WORDS: true  },
      bl:      { DOC_LABEL: "Bon de livraison",  NUM_LABEL: "N° de bon de livraison", SHOW_WORDS: false },
      bc:      { DOC_LABEL: "Bon de commande",   NUM_LABEL: "N° de bon de commande",  SHOW_WORDS: false },
    };
    const { DOC_LABEL, NUM_LABEL, SHOW_WORDS } = MAP[type];

    const wordsHeader =
      type === "devis"   ? "Arrêté le présent devis à la somme de&nbsp;:"
    : type === "facture" ? "Arrêté la présente facture à la somme de&nbsp;:"
    : "";

    const hide = hiddenColumnsFromDOM();
    const hideTTC = hide.ttc || hide.price;

    const headerParts = [];
    if (!hide.ref)      headerParts.push("Réf.");
    if (!hide.product)  headerParts.push("Produit");
    if (!hide.desc)     headerParts.push("Description");
    if (!hide.qty)      headerParts.push("Qté");
    if (!hide.price)    headerParts.push("Prix HT");
    if (!hide.tva)      headerParts.push("TVA %");
    if (!hide.discount) headerParts.push("Remise %");
    if (!hideTTC)       headerParts.push("Total TTC");
    const HEADERS = headerParts;

    const rows = items.map((raw) => {
      const it = {
        ref:      raw.ref || "",
        product:  raw.product || "",
        desc:     raw.desc || (raw.product ? "" : (raw.desc || "")),
        qty:      Number(raw.qty || 0),
        price:    Number(raw.price || 0),
        tva:      Number(raw.tva || 0),
        discount: Number(raw.discount || 0),
      };

      const base   = it.qty * it.price;
      const disc   = base * (it.discount / 100);
      const after  = base - disc;
      const tvaAmt = after * (it.tva / 100);
      const lineTT = after + tvaAmt;

      const cells = [];
      if (!hide.ref)      cells.push(`<td>${esc(it.ref)}</td>`);
      if (!hide.product)  cells.push(`<td>${esc(it.product)}</td>`);
      if (!hide.desc)     cells.push(`<td>${esc(it.desc)}</td>`);
      if (!hide.qty)      cells.push(`<td style="text-align:right">${it.qty}</td>`);
      if (!hide.price)    cells.push(`<td style="text-align:right">${fmtMoney(it.price, cur)}</td>`);
      if (!hide.tva)      cells.push(`<td style="text-align:right">${it.tva}%</td>`);
      if (!hide.discount) cells.push(`<td style="text-align:right">${it.discount > 0 ? it.discount + "%" : "0"}</td>`);
      if (!hideTTC)       cells.push(`<td style="text-align:right">${fmtMoney(lineTT, cur)}</td>`);
      return `<tr class="pdf-row">${cells.join("")}</tr>`;
    }).join("");

    let subtotalItems = 0, totalDisc = 0, totalTVA_items = 0;
    items.forEach((raw) => {
      const qty   = Number(raw.qty || 0);
      const price = Number(raw.price || 0);
      const tva   = Number(raw.tva || 0);
      const discP = Number(raw.discount || 0);
      const base  = qty * price;
      const disc  = base * (discP / 100);
      const after = base - disc;
      const tvaAmt= after * (tva / 100);
      subtotalItems += base;
      totalDisc     += disc;
      totalTVA_items+= tvaAmt;
    });

    const totalHT_items   = subtotalItems - totalDisc;
    const totalHT_display = totalHT_items + (shipEnabled ? shipHT : 0);
    const totalTVA_disp   = totalTVA_items + (shipEnabled ? shipTVA : 0);
    const totalTTC_all    = totalHT_display + totalTVA_disp + (stampEnabled ? stampTTC : 0);

    const wordsTarget       = totalTTC_all;
    const wordsTgtText      = SHOW_WORDS ? amountInWords(wordsTarget, cur) : "";
    const wordsHeaderFinal  = wordsHeader;

    const miniRows = [];
    if (shipEnabled && shipHT > 0) {
      miniRows.push(`<tr><td>${esc(shipLabel)}</td><td class="right">${fmtMoney(shipTTC, cur)}</td></tr>`);
    }
    miniRows.push(
      `<tr class="head"><th>Total HT</th><th class="right">${fmtMoney(totalHT_display, cur)}</th></tr>`,
      `<tr><td>TVA</td><td class="right">${fmtMoney(totalTVA_disp, cur)}</td></tr>`
    );
    if (stampEnabled && stampHT > 0) {
      miniRows.push(`<tr><td>${esc(stampLabel)}</td><td class="right">${fmtMoney(stampTTC, cur)}</td></tr>`);
    }
    miniRows.push(`<tr class="grand"><th>Total TTC</th><th class="right">${fmtMoney(totalTTC_all, cur)}</th></tr>`);

    const companyAddressHTML = hasVal(company.address)
      ? `<p class="pdf-small" style="margin:0px; padding-top:2px; text-transform:capitalize"><em style="font-weight:600">Adresse&nbsp;:</em> ${esc(company.address)}</p>`
      : ``;

    const isParticulier = (state?.clientType || state?.client?.type) === 'particulier';
    const idLabel = isParticulier ? "CIN / Passeport" : "MF";

    const clientIdHTML = hasVal(client.vat)
      ? `<p class="pdf-small" style="padding-top:2px; margin:0px"><em style="font-weight:600">${idLabel}&nbsp;:</em> ${esc(client.vat)}</p>`
      : ``;

    const clientAddressHTML = hasVal(client.address)
      ? `<p class="pdf-small" style="padding-top:2px; margin:0px; text-transform:capitalize; white-space:pre-line"><em style="font-weight:600">Adresse&nbsp;:</em> ${esc(client.address)}</p>`
      : ``;

    const clientPhoneHTML = hasVal(client.phone)
      ? `<p class="pdf-small" style="padding-top:2px; margin:0px"><em style="font-weight:600">Téléphone&nbsp;:</em> ${esc(client.phone)}</p>`
      : ``;

    const clientEmailHTML = hasVal(client.email)
      ? `<p class="pdf-small" style="padding-top:2px; margin:0"><em style="font-weight:600">Email&nbsp;:</em>${esc(client.email)}</p>`
      : ``;

    const companyCSV = joinCSV([
      hasVal(company.name)    ? esc(company.name)    : "",
      hasVal(company.vat)     ? esc(company.vat)     : "",
      hasVal(company.address) ? esc(company.address) : "",
      hasVal(company.phone)   ? esc(company.phone)   : "",
      hasVal(company.email)   ? esc(company.email)   : ""
    ]);

    const notesHTML =
      state.notes && state.notes.trim()
        ? `<div class="pdf-notes">
             <div class="pdf-notes-title"><span style="font-weight:600">Notes&nbsp;:</span>${esc(state.notes).replace(/\n/g, "<br/>")}</div>
           </div>`
        : "";

    const amountWordsBlock =
      (SHOW_WORDS || notesHTML)
        ? `<div class="pdf-amount-words">
             ${SHOW_WORDS ? `${wordsHeaderFinal}<br/><strong>${esc(wordsTgtText)}</strong>` : ""}
             ${notesHTML}
           </div>`
        : "";

    return `
      <div class="pdf-page">
        <div class="pdf-head">
          <h1 class="pdf-title">${DOC_LABEL} N° : <span style="font-weight:600">${esc(meta.number || "—")}</span></h1>
          <div class="pdf-logo-wrap">
            ${logo ? `<img src="${logo}" class="pdf-logo" alt="Logo">` : ""}
          </div>
        </div>

        <div class="pdf-divider"></div>

        <div class="pdf-grid-2">
          <div>
            <p style="margin:0;text-transform:uppercase;font-weight:700">${esc(company.name || "")}</p>
            <p class="pdf-small" style="padding-top:2px; margin:0px"><em style="font-weight:600">MF&nbsp;:</em> ${esc(company.vat || "—")}</p>
            ${companyAddressHTML}
            <p class="pdf-small" style="margin:0px; padding-top:2px;"><em style="font-weight:600">Téléphone&nbsp;:</em> ${esc(company.phone || "—")}</p>
            <p class="pdf-small" style="padding-top:2px; margin:0px"><em style="font-weight:600">Email&nbsp;:</em> ${company.email ? `${esc(company.email)}` : "—"}</p>

            <div class="pdf-meta">
              <div class="pdf-meta-grid">
                <span>Date&nbsp;:</span><span style="font-weight:600">${esc(meta.date || "")}</span>
                <span>${NUM_LABEL}&nbsp;:</span><span style="font-weight:600">${esc(meta.number || "—")}</span>
                <span>Devise&nbsp;:</span><span style="font-weight:600">${esc(cur)}</span>
              </div>
            </div>
          </div>

          <fieldset class="section-box">
            <legend style="margin:0;font-weight:700">Client</legend>
            <p style="margin:0;font-weight:600; text-transform:capitalize; font-size:12px;">${esc(client.name || "—")}</p>
            ${clientIdHTML}
            ${clientAddressHTML}
            ${clientPhoneHTML}
            ${clientEmailHTML}
          </fieldset>
        </div>

        <div class="tableDiv">
          <table class="pdf-table">
            <thead>
              <tr>${HEADERS.map(h => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="pdf-mini-sum">
          <table class="pdf-mini-table">
            <tbody>
              ${miniRows.join("")}
            </tbody>
          </table>
        </div>

        ${amountWordsBlock}

        <div class="pdf-footer">
          <div class="pdf-company">${companyCSV}</div>
          <div class="pdf-sign">
            <p class="pdf-sign-line">Signature et cachet</p>
            <p style="margin:0;font-size:9px">Fait le : ${esc(meta.date || "")}</p>
            <p style="margin-top:4px;font-style:italic;font-size:12px">Merci pour votre confiance&nbsp;!</p>
          </div>
        </div>
      </div>`;
  }

  function render(state, assets) {
    injectCssOnce();
    const root = ensureRoot();
    root.innerHTML = build(state, assets);
  }

  function show(state, assets) {
    render(state, assets);
    document.body.classList.add("printing");
  }

  function hide() {
    document.body.classList.remove("printing");
    const root = document.getElementById("pdfRoot");
    if (root) root.innerHTML = "";
  }

  function cleanup() { hide(); }

  global.PDFView = { build, render, show, hide, cleanup, css: PDF_CSS };
})(window);
