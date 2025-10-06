// preload.js
"use strict";

const { contextBridge, ipcRenderer } = require("electron");
const fs   = require("fs");
const path = require("path");

/* -------------------- helpers -------------------- */
function fileToDataURL(absPath) {
  try {
    const buf = fs.readFileSync(absPath); // works inside asar too
    const ext = path.extname(absPath).slice(1).toLowerCase();
    const mime =
      ext === "png"   ? "image/png"  :
      ext === "jpg"   || ext === "jpeg" ? "image/jpeg" :
      ext === "webp"  ? "image/webp" :
      ext === "gif"   ? "image/gif"  :
      ext === "bmp"   ? "image/bmp"  :
      "application/octet-stream";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Resolve the logo path in both dev and packaged builds. */
function resolveLogoPath() {
  const candidates = [
    // dev layout (this file at project root)
    path.join(__dirname, "src", "renderer", "assets", "logoSW.png"),
    // if you copy assets next to preload.js during packaging
    path.join(__dirname, "assets", "logoSW.png"),
    // resources folder (packaged app)
    path.join(process.resourcesPath || "", "src", "renderer", "assets", "logoSW.png"),
    path.join(process.resourcesPath || "", "assets", "logoSW.png"),
  ];
  return candidates.find(p => p && fs.existsSync(p)) || null;
}

const logoPath    = resolveLogoPath();
const logoDataURL = logoPath ? fileToDataURL(logoPath) : "";

/* -------------------- expose safe API -------------------- */
contextBridge.exposeInMainWorld("smartwebify", {
  /* ---------- Invoice JSON ---------- */

  // Dialog save (defaults to Desktop in main.js)
  saveInvoiceJSON: (data) => ipcRenderer.invoke("save-invoice-json", data),

  // Silent save directly to Desktop (unique filename)
  saveInvoiceJSONToDesktop: (data) =>
    ipcRenderer.invoke("save-invoice-json", {
      ...data,
      meta: { ...(data?.meta || {}), to: "desktop", silent: true },
    }),

  // Open JSON (dialog)
  openInvoiceJSON: () => ipcRenderer.invoke("open-invoice-json"),

  /* ---------- PDF export ---------- */

  // General export honoring meta.silent / meta.filename / meta.to / meta.saveDir
  exportPDFFromHTML: (payload) =>
    ipcRenderer.invoke("smartwebify:exportPDFFromHTML", payload),

  // Convenience: always save to Desktop (silent, no dialog)
  exportPDFToDesktop: ({ html, css, meta = {} }) =>
    ipcRenderer.invoke("smartwebify:exportPDFFromHTML", {
      html, css,
      meta: { ...meta, to: "desktop", silent: true },
    }),

  // Optional legacy dialog-only export
  exportPDFFromHTMLWithDialog: (payload) =>
    ipcRenderer.invoke("export-pdf-from-html", payload),

  /* ---------- File pickers ---------- */

  pickLogo: () => ipcRenderer.invoke("smartwebify:pickLogo"),

  /* ---------- Openers / Shell ---------- */

  openPath:      (absPath) => ipcRenderer.invoke("smartwebify:openPath", absPath),
  showInFolder:  (absPath) => ipcRenderer.invoke("smartwebify:showInFolder", absPath),
  openExternal:  (url)     => ipcRenderer.invoke("smartwebify:openExternal", url),

  /* ---------- Print-mode signals (unsubscribe-friendly) ---------- */

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

  /* ---------- Assets available to renderer/pdf ---------- */

  assets: {
    // data URL so it works in data: HTML & printToPDF
    logo: logoDataURL,
  },
});
