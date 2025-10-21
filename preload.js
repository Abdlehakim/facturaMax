"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

function toFileURL(p) {
  if (!p) return null;
  const norm = String(p).replace(/\\/g, "/");
  return "file://" + (norm.startsWith("/") ? norm : "/" + norm);
}
function fileToDataURL(absPath) {
  try {
    const b = fs.readFileSync(absPath);
    const ext = path.extname(absPath).slice(1).toLowerCase();
    const mime =
      ext === "svg" ? "image/svg+xml" :
      ext === "png" ? "image/png" :
      (ext === "jpg" || ext === "jpeg") ? "image/jpeg" :
      ext === "webp" ? "image/webp" :
      ext === "gif" ? "image/gif" :
      ext === "bmp" ? "image/bmp" :
      "application/octet-stream";
    return `data:${mime};base64,${b.toString("base64")}`;
  } catch {
    return null;
  }
}
function resolveLogoPath() {
  const candidates = [
    path.join(__dirname, "src", "renderer", "assets", "logoIMG.png"),
    path.join(__dirname, "assets", "logoIMG.png"),
    path.join(process.resourcesPath || "", "src", "renderer", "assets", "logoIMG.png"),
    path.join(process.resourcesPath || "", "assets", "logoIMG.png"),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}
const logoPath = resolveLogoPath();
const logoDataURL = logoPath ? fileToDataURL(logoPath) : "";

function normalizeSavePayload(p) {
  if (!p) return { data: {}, meta: {} };
  if (p.data || p.meta || p.filename) return p;
  return p;
}

contextBridge.exposeInMainWorld("SoukElMeuble", {
  // JSON save (invoice)
  saveInvoiceJSON: async (payload) => {
    const normalized = normalizeSavePayload(payload);
    // returns { ok:true, path, name } or { ok:false, canceled:true }
    return await ipcRenderer.invoke("save-invoice-json", normalized);
  },

  // Explicit silent “Save to Desktop”
  saveInvoiceJSONToDesktop: async (payload) => {
    const normalized = normalizeSavePayload(payload);
    if (!normalized.meta) normalized.meta = {};
    normalized.meta.to = "desktop";
    normalized.meta.silent = true;
    return await ipcRenderer.invoke("save-invoice-json", normalized);
  },

  openInvoiceJSON: () => ipcRenderer.invoke("open-invoice-json"),

  // PDF export
  exportPDFFromHTML: async (payload) => {
    const res = await ipcRenderer.invoke("SoukElMeuble:exportPDFFromHTML", payload);
    // Pass through cancel/error as-is
    if (!res || res.ok !== true) return res || { ok: false, canceled: true };

    const t = String(payload?.meta?.docType || "facture").toLowerCase();
    const label =
      t === "devis" ? "Devis" :
      t === "bl" ? "Bon de livraison" :
      t === "bc" ? "Bon de commande" :
      "Facture";
    const name =
      payload?.meta?.filename ||
      `${label} - ${payload?.meta?.number || new Date().toISOString().slice(0, 10)}.pdf`;

    return { ...res, url: toFileURL(res.path), name };
  },

  pickLogo: () => ipcRenderer.invoke("SoukElMeuble:pickLogo"),
  openPath: (absPath) => ipcRenderer.invoke("SoukElMeuble:openPath", absPath),
  showInFolder: (absPath) => ipcRenderer.invoke("SoukElMeuble:showInFolder", absPath),
  openExternal: (url) => ipcRenderer.invoke("SoukElMeuble:openExternal", url),

  onEnterPrintMode: (cb) => {
    ipcRenderer.removeAllListeners("SoukElMeuble:enterPrint");
    ipcRenderer.on("SoukElMeuble:enterPrint", () => cb?.());
  },
  onExitPrintMode: (cb) => {
    ipcRenderer.removeAllListeners("SoukElMeuble:exitPrint");
    ipcRenderer.on("SoukElMeuble:exitPrint", () => cb?.());
  },

  // Articles API (already cancel-safe)
  saveArticle: (payload) => ipcRenderer.invoke("articles:save", payload),
  saveArticleAuto: (payload) => ipcRenderer.invoke("articles:saveAuto", payload),
  openArticle: () => ipcRenderer.invoke("articles:open"),
  listArticles: () => ipcRenderer.invoke("articles:list"),

  assets: { logo: logoDataURL },
});
