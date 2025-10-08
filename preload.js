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
    const buf = fs.readFileSync(absPath);
    const ext = path.extname(absPath).slice(1).toLowerCase();
    const mime =
      ext === "svg"
        ? "image/svg+xml"
        : ext === "png"
        ? "image/png"
        : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
        ? "image/webp"
        : ext === "gif"
        ? "image/gif"
        : ext === "bmp"
        ? "image/bmp"
        : "application/octet-stream";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function resolveLogoPath() {
  const candidates = [
    path.join(__dirname, "src", "renderer", "assets", "logoSW.png"),
    path.join(__dirname, "assets", "logoSW.png"),
    path.join(process.resourcesPath || "", "src", "renderer", "assets", "logoSW.png"),
    path.join(process.resourcesPath || "", "assets", "logoSW.png"),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

const logoPath = resolveLogoPath();
const logoDataURL = logoPath ? fileToDataURL(logoPath) : "";

contextBridge.exposeInMainWorld("smartwebify", {
  saveInvoiceJSON: async (data) => {
    const result = await ipcRenderer.invoke("save-invoice-json", data);
    return !!result;
  },
  saveInvoiceJSONToDesktop: async (data) => {
    const result = await ipcRenderer.invoke("save-invoice-json", {
      ...data,
      meta: { ...(data?.meta || {}), to: "desktop", silent: true },
    });
    return !!result;
  },
  openInvoiceJSON: () => ipcRenderer.invoke("open-invoice-json"),

  exportPDFFromHTML: async (payload) => {
    const res = await ipcRenderer.invoke("smartwebify:exportPDFFromHTML", payload);
    if (!res || !res.ok || !res.path) return null;
    const name =
      payload?.meta?.filename ||
      `${(payload?.meta?.docType ? String(payload.meta.docType).toLowerCase() : "facture") === "devis"
        ? "Devis"
        : payload?.meta?.docType === "bl"
        ? "Bon de livraison"
        : payload?.meta?.docType === "bc"
        ? "Bon de commande"
        : "Facture"} - ${payload?.meta?.number || new Date().toISOString().slice(0, 10)}.pdf`;
    return { ok: true, path: res.path, url: toFileURL(res.path), name };
  },
  exportPDFToDesktop: async ({ html, css, meta = {} }) => {
    const res = await ipcRenderer.invoke("smartwebify:exportPDFFromHTML", {
      html,
      css,
      meta: { ...meta, to: "desktop", silent: true },
    });
    if (!res || !res.ok || !res.path) return null;
    return {
      ok: true,
      path: res.path,
      url: toFileURL(res.path),
      name: meta.filename || "document.pdf",
    };
  },

  pickLogo: () => ipcRenderer.invoke("smartwebify:pickLogo"),
  openPath: (absPath) => ipcRenderer.invoke("smartwebify:openPath", absPath),
  showInFolder: (absPath) => ipcRenderer.invoke("smartwebify:showInFolder", absPath),
  openExternal: (url) => ipcRenderer.invoke("smartwebify:openExternal", url),

  assets: {
    logo: logoDataURL,
  },

  onEnterPrintMode: (cb) => {
    const fn = () => cb && cb();
    ipcRenderer.on("enter-print-mode", fn);
    return () => ipcRenderer.removeListener("enter-print-mode", fn);
    },
  onExitPrintMode: (cb) => {
    const fn = () => cb && cb();
    ipcRenderer.on("exit-print-mode", fn);
    return () => ipcRenderer.removeListener("exit-print-mode", fn);
  },
});
