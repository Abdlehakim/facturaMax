// ───────── app-init.js ─────────
(function (w) {
  const SEM = (w.SEM = w.SEM || {});

  if (w.pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "./lib/pdfs/pdf.worker.min.js";
  }

  const fieldToggleMap = {
    ref: "colToggleRef",
    product: "colToggleProduct",
    desc: "colToggleDesc",
    qty: "colToggleQty",
    price: "colTogglePrice",
    tva: "colToggleTva",
    discount: "colToggleDiscount",
  };

  const CLIENTS_DIR_KEY = "clientsDirHandle";
  const DB_NAME = "sem-fs";
  const STORE = "kv";
  const ARTICLES_DIR_KEY = "articlesDirHandle";
  const DOCS_ROOT_KEY = "docsRootHandle";

  function captureClientFromForm() {
    return {
      type: getStr("clientType"),
      name: getStr("clientName"),
      vat: getStr("clientVat"),
      phone: getStr("clientPhone"),
      email: getStr("clientEmail"),
      address: getStr("clientAddress"),
    };
  }
  function fillClientToForm(c = {}) {
    setVal("clientType", c.type ?? "societe");
    setVal("clientName", c.name ?? "");
    setVal("clientVat", c.vat ?? "");
    setVal("clientPhone", c.phone ?? "");
    setVal("clientEmail", c.email ?? "");
    setVal("clientAddress", c.address ?? "");
    if (typeof SEM.updateClientIdLabel === "function") SEM.updateClientIdLabel();
  }
  function safeClientName(s = "client") {
    return String(s).trim().replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 80) || "client";
  }
  function pickSuggestedClientName(c) {
    const n = String(c.name || "").trim();
    const v = String(c.vat || "").trim();
    const e = String(c.email || "").trim();
    const p = String(c.phone || "").trim();
    return safeClientName(n || v || e || p || "client");
  }

  function isEnabled(key) {
    const el = getEl(fieldToggleMap[key]);
    if (!el) return true;
    return !!el.checked;
  }
  function setEnabled(key, enabled) {
    const el = getEl(fieldToggleMap[key]);
    if (!el) return;
    el.checked = !!enabled;
  }
  function captureArticleFromForm() {
    const use = {
      ref: isEnabled("ref"),
      product: isEnabled("product"),
      desc: isEnabled("desc"),
      qty: isEnabled("qty"),
      price: isEnabled("price"),
      tva: isEnabled("tva"),
      discount: isEnabled("discount"),
    };
    return {
      ref: getStr("addRef"),
      product: getStr("addProduct"),
      desc: getStr("addDesc"),
      qty: getNum("addQty", 1),
      price: getNum("addPrice", 0),
      tva: getNum("addTva", 19),
      discount: getNum("addDiscount", 0),
      use,
    };
  }
  function fillArticleToForm(a = {}) {
    setVal("addRef", a.ref ?? "");
    setVal("addProduct", a.product ?? "");
    setVal("addDesc", a.desc ?? "");
    setVal("addQty", String(a.qty ?? 1));
    setVal("addPrice", String(a.price ?? 0));
    setVal("addTva", String(a.tva ?? 19));
    setVal("addDiscount", String(a.discount ?? 0));
    if (a.use && typeof a.use === "object") {
      Object.keys(fieldToggleMap).forEach((k) => {
        const enabled = a.use[k];
        if (typeof enabled === "boolean") setEnabled(k, enabled);
      });
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    }
  }
  function pickSuggestedName(a) {
    const u = {
      ref: isEnabled("ref"),
      product: isEnabled("product"),
      desc: isEnabled("desc"),
    };
    const ref = String(a.ref || "").trim();
    const product = String(a.product || "").trim();
    const desc = String(a.desc || "").trim();
    const first = (u.ref && ref) || (u.product && product) || (u.desc && desc) || "article";
    return first;
  }

  function idbOpen() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  function safeName(s = "article") {
    return String(s).trim().replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 80) || "article";
  }
  function safeCompanyFolderName(s = "Societe") {
    return String(s).trim().replace(/[\/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 80) || "Societe";
  }

  async function pickWritableBaseDir() {
    const handle = await window.showDirectoryPicker({ id: "sem-company-folder", mode: "readwrite", startIn: "documents" });
    const p = await handle.requestPermission({ mode: "readwrite" });
    if (p !== "granted") throw new Error("permission denied");
    return handle;
  }

  async function getCompanyBaseDirHandle() {
    let base = await idbGet(DOCS_ROOT_KEY);
    try {
      if (base) {
        const p = await base.requestPermission({ mode: "readwrite" });
        if (p === "granted") {
          await base.getDirectoryHandle(".", { create: false }).catch(() => {});
          await base.getDirectoryHandle("Articles", { create: true });
          await base.getDirectoryHandle("Clients", { create: true });
          return base;
        }
      }
    } catch {}
    const picked = await pickWritableBaseDir();
    await idbSet(DOCS_ROOT_KEY, picked);
    await picked.getDirectoryHandle("Articles", { create: true });
    await picked.getDirectoryHandle("Clients", { create: true });
    return picked;
  }

  async function getArticlesFolderHandle() {
    try {
      const base = await getCompanyBaseDirHandle();
      const dir = await base.getDirectoryHandle("Articles", { create: true });
      const p = await dir.requestPermission({ mode: "readwrite" });
      if (p !== "granted") throw new Error("permission denied");
      await idbSet(ARTICLES_DIR_KEY, dir);
      return dir;
    } catch {
      const picked = await pickWritableBaseDir();
      await idbSet(DOCS_ROOT_KEY, picked);
      const dir = await picked.getDirectoryHandle("Articles", { create: true });
      await idbSet(ARTICLES_DIR_KEY, dir);
      return dir;
    }
  }

  async function getClientsFolderHandle() {
    try {
      const base = await getCompanyBaseDirHandle();
      const dir = await base.getDirectoryHandle("Clients", { create: true });
      const p = await dir.requestPermission({ mode: "readwrite" });
      if (p !== "granted") throw new Error("permission denied");
      await idbSet(CLIENTS_DIR_KEY, dir);
      return dir;
    } catch {
      const picked = await pickWritableBaseDir();
      await idbSet(DOCS_ROOT_KEY, picked);
      const dir = await picked.getDirectoryHandle("Clients", { create: true });
      await idbSet(CLIENTS_DIR_KEY, dir);
      return dir;
    }
  }

  async function browserSaveArticleWithDialog(article, suggested = "article") {
    const data = JSON.stringify(article, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    if (window.isSecureContext && window.showSaveFilePicker) {
      try {
        const dir = await getArticlesFolderHandle();
        const handle = await window.showSaveFilePicker({
          suggestedName: `${safeName(suggested)}.article.json`,
          startIn: dir,
          types: [{ description: "Article JSON", accept: { "application/json": [".json"] } }],
          excludeAcceptAllOption: false,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName(suggested)}.article.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }

  async function browserSaveClientWithDialog(client, suggested = "client") {
    const data = JSON.stringify(client, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    if (window.isSecureContext && window.showSaveFilePicker) {
      try {
        const dir = await getClientsFolderHandle();
        const handle = await window.showSaveFilePicker({
          suggestedName: `${safeClientName(suggested)}.client.json`,
          startIn: dir,
          types: [{ description: "Client JSON", accept: { "application/json": [".json"] } }],
          excludeAcceptAllOption: false,
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e) {
        if (e && e.name === "AbortError") return false;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${safeClientName(suggested)}.client.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  }

  function enableFirstClickSelectSecondClickCaret(input) {
    if (!input) return;
    let suppressNextMouseUp = false;
    let firstClickDone = false;
    input.addEventListener("mousedown", () => {
      if (document.activeElement !== input || !firstClickDone) {
        setTimeout(() => {
          input.select();
          try {
            input.setSelectionRange(0, input.value.length);
          } catch {}
        }, 0);
        suppressNextMouseUp = true;
        firstClickDone = true;
      } else {
        suppressNextMouseUp = false;
      }
    });
    input.addEventListener(
      "mouseup",
      (e) => {
        if (suppressNextMouseUp) {
          e.preventDefault();
          suppressNextMouseUp = false;
        }
      },
      true
    );
    input.addEventListener("blur", () => {
      firstClickDone = false;
      suppressNextMouseUp = false;
    });
  }

  function killOverlays() {
    document.body.classList.remove("printing", "print-mode");
    const pdfRoot = document.getElementById("pdfRoot");
    if (pdfRoot) {
      pdfRoot.style.display = "none";
      pdfRoot.style.pointerEvents = "none";
      pdfRoot.setAttribute("aria-hidden", "true");
    }
  }

  function unlockAddInputs() {
    ["addRef", "addProduct", "addDesc", "addQty", "addPrice", "addTva", "addDiscount"].forEach((id) => {
      const el = getEl(id);
      if (el) {
        el.disabled = false;
        el.readOnly = false;
      }
    });
  }

  function recoverFocus() {
    killOverlays();
    try {
      window.focus();
    } catch {}
    unlockAddInputs();
  }

  function installFocusGuards() {
    const handler = () => recoverFocus();
    document.addEventListener("pointerdown", handler, true);
    document.addEventListener("keydown", handler, true);
    document.addEventListener("focusin", handler, true);
    window.addEventListener("focus", recoverFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") recoverFocus();
    });
  }

  function init() {
    if (!SEM.COMPANY_LOCKED && typeof SEM.loadCompanyFromLocal === "function") {
      SEM.loadCompanyFromLocal();
    }
    if (typeof SEM.bind === "function") SEM.bind();
    if (typeof SEM.wireLiveBindings === "function") SEM.wireLiveBindings();
    if (typeof SEM.setSubmitMode === "function") SEM.setSubmitMode("add");

    installFocusGuards();

    ["addPrice", "addQty", "addTva", "addDiscount"].forEach((id) => enableFirstClickSelectSecondClickCaret(getEl(id)));

    getEl("btnNew")?.addEventListener("click", () => {
      if (typeof SEM.newInvoice === "function") SEM.newInvoice();
      if (typeof SEM.clearAddFormAndMode === "function") SEM.clearAddFormAndMode();
      if (typeof SEM.bind === "function") SEM.bind();
    });

    getEl("btnOpen")?.addEventListener("click", () => {
      if (typeof onOpenInvoiceClick === "function") onOpenInvoiceClick();
    });

    getEl("btnSave")?.addEventListener("click", () => {
      try {
        window.__includeCompanyForSave = true;
      } catch {}
      if (w.SEM?.readInputs) w.SEM.readInputs();
      else if (typeof readInputs === "function") readInputs();
      saveInvoiceJSON();
    });

    getEl("btnPDF")?.addEventListener("click", () => {
      if (typeof exportCurrentPDF === "function") exportCurrentPDF();
    });

    getEl("btnSubmitItem")?.addEventListener("click", () => {
      if (typeof SEM.submitItemForm === "function") SEM.submitItemForm();
    });

    getEl("btnNewItem")?.addEventListener("click", () => {
      if (typeof SEM.clearAddFormAndMode === "function") SEM.clearAddFormAndMode();
    });

    ["addRef", "addProduct", "addDesc", "addQty", "addPrice", "addTva", "addDiscount"].forEach((id) => {
      const el = getEl(id);
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (typeof SEM.submitItemForm === "function") SEM.submitItemForm();
        }
      });
      if (el) {
        el.addEventListener("focus", () => {
          try {
            el.select();
          } catch {}
        });
        el.addEventListener("click", () => {
          try {
            el.select();
          } catch {}
        });
      }
    });

    getEl("companyLogo")?.addEventListener("click", async () => {
      if (!window.SoukElMeuble?.pickLogo) return;
      const res = await window.SoukElMeuble.pickLogo();
      if (res?.dataUrl) {
        SEM.state.company.logo = res.dataUrl;
        setSrc("companyLogo", res.dataUrl);
      }
    });

    const addFieldset = getEl("addRef")?.closest("fieldset.section-box");
    if (addFieldset) {
      addFieldset.addEventListener("mousedown", recoverFocus, true);
    }

    window.SoukElMeuble?.onEnterPrintMode?.(() => {
      window.PDFView?.show?.(SEM.state, window.SoukElMeuble?.assets || {});
    });
    window.SoukElMeuble?.onExitPrintMode?.(() => {
      window.PDFView?.hide?.();
      recoverFocus();
    });

    getEl("colToggleRef")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    getEl("colTogglePrice")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    getEl("colToggleProduct")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    getEl("colToggleDesc")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    getEl("colToggleQty")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    getEl("colToggleTva")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    getEl("colToggleDiscount")?.addEventListener("change", () => {
      if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();
    });
    if (typeof SEM.applyColumnHiding === "function") SEM.applyColumnHiding();

    getEl("btnSaveArticle")?.addEventListener("click", async () => {
      const article = captureArticleFromForm();
      const hasProduct = article.use?.product && String(article.product || "").trim().length > 0;
      const hasDesc = article.use?.desc && String(article.desc || "").trim().length > 0;
      if (!hasProduct && !hasDesc) {
        await showDialog("Veuillez saisir au moins un Produit ou une Description.", { title: "Article incomplet" });
        return;
      }
      const suggested = pickSuggestedName(article);
      try {
        const ok = await browserSaveArticleWithDialog(article, suggested);
        if (ok) await showDialog("Article enregistré.", { title: "Succès" });
      } catch {
        await showDialog("Échec de l’enregistrement.", { title: "Erreur" });
      }
    });

    getEl("btnLoadArticle")?.addEventListener("click", async () => {
      try {
        const pick = document.createElement("input");
        pick.type = "file";
        pick.accept = ".json,application/json";
        pick.onchange = async () => {
          const f = pick.files?.[0];
          if (!f) return;
          const txt = await f.text();
          const data = JSON.parse(txt);
          fillArticleToForm(data);
          getEl("addProduct")?.focus();
        };
        pick.click();
      } catch {
        await showDialog("Ouverture impossible.", { title: "Erreur" });
      }
    });

    getEl("btnSaveClient")?.addEventListener("click", async () => {
      const client = captureClientFromForm();
      if (!client.name && !client.email && !client.phone) {
        await showDialog("Veuillez saisir au moins un Nom, un E-mail ou un Téléphone.", { title: "Client incomplet" });
        return;
      }
      const suggested = pickSuggestedClientName(client);
      try {
        const ok = await browserSaveClientWithDialog(client, suggested);
        if (ok) await showDialog("Client enregistré.", { title: "Succès" });
      } catch {
        await showDialog("Échec de l’enregistrement du client.", { title: "Erreur" });
      }
    });

    getEl("btnLoadClient")?.addEventListener("click", async () => {
      try {
        const inp = document.createElement("input");
        inp.type = "file";
        inp.accept = ".json,application/json";
        inp.onchange = async () => {
          const f = inp.files?.[0];
          if (!f) return;
          const txt = await f.text();
          const c = JSON.parse(txt);
          fillClientToForm(c || {});
        };
        inp.click();
      } catch {
        await showDialog("Ouverture impossible.", { title: "Erreur" });
      }
    });
  }

  onReady(init);
})(window);
