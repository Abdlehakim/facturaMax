(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function sidebarTemplate() {
    return `
      <aside class="sidebar" role="navigation" aria-label="Barre latérale">
        <div class="sidebar__brand">
          <img class="sidebar__logo" src="./assets/logoIMG.png" alt="Logo" />
          <div class="sidebar__title">SoukElMeuble</div>
        </div>
        <nav class="sidebar__nav">
          <a href="#create-facture" class="sidebar__link" data-action="create-facture" data-route="create-facture" aria-current="page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 11v6M9 14h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            <span>Créer facture</span>
          </a>
          <a href="#all-factures" class="sidebar__link" data-action="all-factures" data-route="all-factures">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M8 3H6a2 2 0 0 0-2 2v12m12-14h2a2 2 0 0 1 2 2v12M8 3h8m-8 0v4h8V3M4 17v2a2 2 0 0 0 2 2h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Toutes les factures</span>
          </a>
          <a href="#stock" class="sidebar__link" data-action="stock" data-route="stock">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 22V12M3.3 7.5 12 12l8.7-4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Gestion de stock</span>
          </a>
          <a href="#clients" class="sidebar__link" data-action="clients" data-route="clients">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20 8v6m3-3h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            <span>Gestion de clients</span>
          </a>
        </nav>
        <div class="sidebar__footer"><small>v1.0 — Hors ligne</small></div>
      </aside>`;
  }

  function setActive(action, root = document) {
    $$(".sidebar__link", root).forEach((a) => {
      const isActive = a.dataset.action === action || a.dataset.route === action;
      a.classList.toggle("active", isActive);
      if (isActive) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function currentActionFromLocation(rootEl) {
    const hash = (location.hash || "").replace(/^#/, "");
    if (hash) return hash;
    const initial = rootEl?.dataset?.initial;
    if (initial) return String(initial);
    return "create-facture";
  }

  function navigate(action, root = document) {
    if (!action) return;
    try { history.replaceState({}, "", `#${action}`); } catch (_) {}
    setActive(action, root);
    if (window.SEM?.navigate) { try { window.SEM.navigate(action); return; } catch (e) {} }
    if (typeof window.handleSidebarNavigate === "function") { try { window.handleSidebarNavigate(action); return; } catch (e) {} }
  }

  function bindEvents(container) {
    const links = $$(".sidebar__link", container);
    links.forEach((a, idx) => {
      a.addEventListener("click", (e) => { const action = a.dataset.route || a.dataset.action; if (!action) return; e.preventDefault(); navigate(action, container); });
      a.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); a.click(); }
        if (ev.key === "ArrowDown" || ev.key === "ArrowRight") { ev.preventDefault(); links[(idx + 1) % links.length].focus(); }
        if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") { ev.preventDefault(); links[(idx - 1 + links.length) % links.length].focus(); }
      });
    });
  }

  function mount(target = "#sidebar-root") {
    const host = typeof target === "string" ? document.querySelector(target) : target;
    if (!host) { console.warn(`[sidebar] mount: target "${target}" not found`); return null; }
    host.innerHTML = sidebarTemplate();
    bindEvents(host);
    const start = currentActionFromLocation(host);
    setActive(start, host);
    return host;
  }

  function autoMount() { const el = document.getElementById("sidebar-root"); if (el) mount(el); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount); else autoMount();

  const SEM = (window.SEM = window.SEM || {});
  SEM.sidebar = { mount, navigate: (a) => navigate(a), setActive: (a) => setActive(a), currentAction: () => currentActionFromLocation(document.getElementById("sidebar-root")) };
})();
