// app-init-sideBar.js
(function (w) {
  const SEM = (w.SEM = w.SEM || {});
  if (SEM.__SIDEBAR_ROUTER_WIRED) return;
  SEM.__SIDEBAR_ROUTER_WIRED = true;

  const IS_DESKTOP = !!(w.SoukElMeuble && (w.SoukElMeuble.isDesktop ?? true));
  SEM.IS_DESKTOP = IS_DESKTOP;
  SEM.WEB_FS_DISABLED = IS_DESKTOP;

  if (w.pdfjsLib && pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdfs/pdf.worker.min.js";

  const ROUTES = {
    "create-facture": { id: "invoice",           title: "Creer facture",       loader: loadCreateFacture },
    "all-factures":   { id: "screenAllFactures", title: "Toutes les factures", loader: loadAllFactures   },
    "stock":          { id: "screenStock",       title: "Gestion de stock",    loader: loadStock         },
    "clients":        { id: "screenClients",     title: "Gestion de clients",  loader: loadClients       },
  };
  const MOUNTED = Object.create(null);

  function ensurePanel(id, title) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("main");
    el.id = id; el.className = "paper"; el.style.display = "none";
    el.innerHTML = `
      <section class="grid">
        <fieldset class="section-box">
          <legend>${title}</legend>
          <div class="muted">Chargement...</div>
        </fieldset>
      </section>`;
    const app = document.querySelector(".app");
    const footer = document.querySelector(".footer");
    (app && footer) ? app.insertBefore(el, footer) : document.body.appendChild(el);
    return el;
  }

  function setActiveInSidebar(route) {
    if (SEM.sidebar && typeof SEM.sidebar.setActive === "function") { SEM.sidebar.setActive(route); return; }
    document.querySelectorAll("[data-route]").forEach((a) => {
      const isActive = a.getAttribute("data-route") === route;
      a.classList.toggle("active", isActive);
      if (isActive) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function currentActionFromLocation() {
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash) return hash;
    const initial = document.getElementById("sidebar-root")?.getAttribute("data-initial");
    if (initial) return String(initial);
    return "create-facture";
  }

  async function loadCreateFacture(host) {
    try { const { mount } = await import("./gestionFacture/CreateInvoice.js"); mount(host); }
    catch (e) { loadCard(host, "Creer facture"); console.warn("[router] CreateInvoice.js failed:", e); }
  }
  async function loadAllFactures(host) {
    try { const { mount } = await import("./allInvoices/InvoiceTable.js"); mount(host); }
    catch (e) { loadCard(host, "Toutes les factures"); console.warn("[router] allInvoices/InvoiceTable.js failed:", e); }
  }
  async function loadStock(host) {
    try { const { mount } = await import("./gestionStock/Stock.js"); mount(host); }
    catch (e) { loadCard(host, "Gestion de stock"); console.warn("[router] Stock.js failed:", e); }
  }
  async function loadClients(host) {
    try { const { mount } = await import("./gestionClients/Clients.js"); mount(host); }
    catch (e) { loadCard(host, "Gestion de clients"); console.warn("[router] Clients.js failed:", e); }
  }
  async function loadCard(host, title) {
    host.innerHTML = `
      <section class="grid">
        <fieldset class="section-box">
          <legend>${title}</legend>
          <div class="muted">Cette section est prete. Vous pouvez l'alimenter plus tard.</div>
        </fieldset>
      </section>`;
  }

  async function showRoute(route) {
    const def = ROUTES[route] || ROUTES["create-facture"];
    Object.values(ROUTES).forEach(({ id, title }) => ensurePanel(id, title));
    Object.values(ROUTES).forEach(({ id }) => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
    const host = document.getElementById(def.id);
    if (!MOUNTED[def.id]) { try { await def.loader(host, def.title); } catch (e) { console.warn("[router] loader failed:", route, e); } MOUNTED[def.id] = true; }
    if (host) host.style.display = "";
    setActiveInSidebar(route);
    try { history.replaceState({}, "", `#${route}`); } catch {}
    if (route === "create-facture") { try { if (typeof w.autoNumberFromRegistryIfEmpty === "function") w.autoNumberFromRegistryIfEmpty(); } catch {} }
  }

  function wireNavigation() {
    SEM.navigate = (route) => { if (!route) return; showRoute(route); };
    window.addEventListener("hashchange", () => { const route = currentActionFromLocation(); showRoute(route); });
    window.addEventListener("sem:navigate", (e) => { const r = e?.detail?.route; if (r) showRoute(r); });
    document.addEventListener("click", (e) => { const node = e.target.closest?.("[data-route]"); if (!node) return; const r = node.getAttribute("data-route"); if (!r) return; e.preventDefault(); showRoute(r); });
  }

  function init() {
    Object.values(ROUTES).forEach(({ id, title }) => ensurePanel(id, title));
    wireNavigation();
    const initial = currentActionFromLocation();
    showRoute(initial);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window);
