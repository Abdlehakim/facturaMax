// InvoiceTable.js
// Exports mount(host) used by app-init-sideBar.js
// Styled similar to stock: header with a primary button (left) + table.

function getInvoicesFallback() {
  const SEM = window.SEM || {};
  if (typeof SEM.getAllInvoices === "function") return SEM.getAllInvoices() || [];
  if (Array.isArray(SEM?.registry?.invoices)) return SEM.registry.invoices;
  if (Array.isArray(SEM?.state?.invoices))     return SEM.state.invoices;
  return [];
}

export function mount(host) {
  if (!host) return;

  host.innerHTML = `
    <div class="inv-header">
      <div class="inv-lead">
        <div class="inv-crumbs" id="invoicesBreadcrumb">
          <span class="crumb current" aria-current="page">Toutes les factures</span>
        </div>
      </div>
      <div class="inv-header-actions">
        <button id="createInvoiceButton" class="btn primary" type="button">Creer facture</button>
      </div>
    </div>
    <section class="grid" id="allInvoicesSection">
      <div class="table-wrap">
        <table id="facturesTable" aria-label="Liste des factures">
          <thead>
            <tr>
              <th class="left" style="width:12%">No de facture</th>
              <th class="left" style="width:16%">Date</th>
              <th class="left" style="width:18%">Client</th>
              <th style="width:14%">Total TTC</th>
              <th style="width:15%">Statut</th>
              <th style="width:15%">Actions</th>
            </tr>
          </thead>
          <tbody id="invTbody">
            <tr class="no-data"><td colspan="6" class="muted">Chargement...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;

  const tbody = host.querySelector("#invTbody");
  const createBtn = host.querySelector("#createInvoiceButton");
  const fmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  createBtn?.addEventListener("click", () => {
    try { window.SEM?.navigate?.("create-facture"); } catch {}
  });

  const SEM = window.SEM || {};
  const isDesktop = !!(window.SoukElMeuble && window.SoukElMeuble.isDesktop);
  const normalizeStatus = (value) => {
    const s = String(value || "").trim().toLowerCase();
    if (s.includes("annul") || s.includes("cancel")) return "Annuler";
    if (s.includes("pay") || s.includes("paye") || s === "payer" || s === "paid") return "Payer";
    return "Payer";
  };

  const load = async () => {
    // Desktop: list from ledger (large limit), then read each invoice JSON for details
    if (isDesktop && window.SoukElMeuble?.invoicesListRecent) {
      try {
        const res = await window.SoukElMeuble.invoicesListRecent({ limit: 1000 });
        const items = Array.isArray(res?.items) ? res.items : [];
        const rows = await Promise.all(
          items.map(async (it) => {
            let data = null;
            try { const r = await window.SoukElMeuble.invoicesRead({ path: it.path }); data = r?.ok ? r.data : null; } catch {}
            const number = it.number || data?.meta?.number || "";
            const date   = it.date   || data?.meta?.date   || "";
            const client = data?.client?.name || data?.customer?.name || data?.meta?.clientName || "";
            const total  = Number(data?.totals?.totalTTC ?? data?.totals?.ttc ?? 0) || 0;
            const status = normalizeStatus((data?.meta?.status || "").trim());
            return { number, date, client, total, status, path: it.path || null };
          })
        );
        return renderRows(rows);
      } catch {}
    }

    // Fallback: custom provider or registry/state
    let rows = [];
    try {
      if (typeof SEM.listInvoices === "function") rows = await SEM.listInvoices();
      else rows = getInvoicesFallback();
    } catch { rows = getInvoicesFallback(); }

    const normalized = rows.map((r) => ({
      number: r.meta?.number ?? r.number ?? "",
      date:   r.meta?.date   ?? r.date   ?? "",
      client: r.customer?.name ?? r.client?.name ?? r.clientName ?? "",
      total:  Number(r.totals?.totalTTC ?? r.totals?.ttc ?? r.totalTTC ?? r.total ?? 0) || 0,
      status: normalizeStatus(r.status ?? r.meta?.status ?? ""),
    }));
    renderRows(normalized);
  };

  function renderRows(rows) {
    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr class="no-data"><td colspan="6" class="muted">Aucune facture trouvee.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const statusVal = String(r.status || '').toLowerCase();
        const selP = statusVal === 'payer' ? 'selected' : '';
        const selA = statusVal.startsWith('annul') ? 'selected' : '';
        const pathAttr = r.path ? ` data-path="${escapeHtml(String(r.path))}"` : '';
        return `
        <tr data-num="${escapeHtml(String(r.number || ""))}"${pathAttr}>
          <td>${escapeHtml(r.number || "")}</td>
          <td>${escapeHtml(r.date || "")}</td>
          <td>${escapeHtml(r.client || "")}</td>
          <td class="center">${fmt.format(Number(r.total) || 0)}</td>
          <td class="center">
            <select data-act="status" aria-label="Statut">
              <option value="payer" ${selP}>Payer</option>
              <option value="annuler" ${selA}>Annuler</option>
            </select>
          </td>
          <td class="actions-cell">
            <button class="btn tiny" data-action="edit">Editer</button>
            <button class="del" data-action="delete">Supprimer</button>
          </td>
        </tr>`;
      })
      .join("");

    // Wire actions for edit/delete and status updates
    tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const tr = e.currentTarget.closest('tr');
        if (!tr) return;
        const path = tr.getAttribute('data-path');
        const num  = tr.getAttribute('data-num');
        try {
          if (path && window.SoukElMeuble?.invoicesRead) {
            const r = await window.SoukElMeuble.invoicesRead({ path });
            if (r?.ok && r.data && typeof window.mergeInvoiceDataIntoState === 'function') {
              window.mergeInvoiceDataIntoState({ data: r.data });
              window.SEM?.bind?.();
              window.SEM?.navigate?.('create-facture');
              return;
            }
          }
          if (window.SEM?.openInvoice) window.SEM.openInvoice(num);
          else window.SEM?.navigate?.('create-facture');
        } catch {}
      });
    });

    tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const tr = e.currentTarget.closest('tr');
        if (!tr) return;
        const path = tr.getAttribute('data-path');
        if (path && window.SoukElMeuble?.invoicesDelete) {
          try {
            const ok = await window.showConfirm?.('Supprimer cette facture ?', { title: 'Confirmer', okText: 'Supprimer', cancelText: 'Annuler' });
            if (ok === false) return;
            const res = await window.SoukElMeuble.invoicesDelete({ path });
            if (res?.ok) tr.remove();
          } catch {}
        }
      });
    });

    tbody.querySelectorAll('select[data-act="status"]').forEach((sel) => {
      sel.addEventListener('change', async (e) => {
        const tr = e.currentTarget.closest('tr');
        const path = tr?.getAttribute('data-path');
        const value = String(e.currentTarget.value || '').toLowerCase();
        if (path && window.SoukElMeuble?.invoicesRead && window.SoukElMeuble?.updateInvoiceFile) {
          try {
            const r = await window.SoukElMeuble.invoicesRead({ path });
            if (r?.ok && r.data) {
              const doc = r.data;
              doc.meta = doc.meta || {};
              doc.meta.status = value;
              await window.SoukElMeuble.updateInvoiceFile({ path, data: doc });
            }
          } catch {}
        }
      });
    });
  }

  load();

  // Optional row click
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



