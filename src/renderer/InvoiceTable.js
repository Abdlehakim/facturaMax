// InvoiceTable.js
// Exports mount(host) used by app-init-sideBar.js
// Shows a simple table from whatever data source is available.

function getInvoicesFallback() {
  // Try a few likely places; return [] if nothing is found.
  const SEM = window.SEM || {};
  if (typeof SEM.getAllInvoices === "function") return SEM.getAllInvoices() || [];
  if (Array.isArray(SEM?.registry?.invoices)) return SEM.registry.invoices;
  if (Array.isArray(SEM?.state?.invoices))     return SEM.state.invoices;
  return [];
}

export function mount(host) {
  if (!host) return;

  // Build shell
  host.innerHTML = `
    <section class="grid">
      <fieldset class="section-box">
        <legend>Toutes les factures</legend>

        <div id="invTableWrap" class="table-wrap">
          <table class="table" id="invTable" aria-label="Liste des factures">
            <thead>
              <tr>
                <th style="width:160px">N°</th>
                <th style="width:160px">Date</th>
                <th>Client</th>
                <th style="width:140px">Total TTC</th>
                <th style="width:120px">Type</th>
                <th style="width:120px">Statut</th>
              </tr>
            </thead>
            <tbody id="invTbody"><tr><td colspan="6" class="muted">Chargement…</td></tr></tbody>
          </table>
        </div>
      </fieldset>
    </section>
  `;

  const tbody = host.querySelector("#invTbody");
  const fmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Fetch data (sync or async)
  const SEM = window.SEM || {};
  const load = async () => {
    let rows = [];
    try {
      if (typeof SEM.listInvoices === "function") {
        // Prefer an async API if you have it
        rows = await SEM.listInvoices();
      } else {
        rows = getInvoicesFallback();
      }
    } catch {
      rows = getInvoicesFallback();
    }

    // Render
    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Aucune facture trouvée.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((r) => {
        const number = r.meta?.number ?? r.number ?? "";
        const date   = r.meta?.date   ?? r.date   ?? "";
        const client = r.customer?.name ?? r.client?.name ?? r.clientName ?? "";
        const total  = r.totals?.ttc ?? r.totalTTC ?? r.total ?? 0;
        const type   = r.meta?.docType ?? r.docType ?? "facture";
        const status = r.status ?? "brouillon";
        return `
          <tr data-num="${String(number)}">
            <td>${escapeHtml(number)}</td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(client)}</td>
            <td style="text-align:right">${fmt.format(Number(total) || 0)}</td>
            <td>${escapeHtml(String(type).toUpperCase())}</td>
            <td>${escapeHtml(status)}</td>
          </tr>`;
      })
      .join("");
  };

  load();

  // Row click -> open invoice (if app exposes a viewer)
  host.addEventListener("click", (e) => {
    const tr = e.target.closest?.("tr[data-num]");
    if (!tr) return;
    const num = tr.getAttribute("data-num");
    try { SEM.openInvoice?.(num); } catch {}
  });
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
