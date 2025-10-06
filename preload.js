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
    // dev layout (preload.js at project root)
    path.join(__dirname, "src", "renderer", "assets", "logoSW.png"),
    // if assets are copied next to preload.js in packaging
    path.join(__dirname, "assets", "logoSW.png"),
    // resources path (packaged apps)
    path.join(process.resourcesPath || "", "src", "renderer", "assets", "logoSW.png"),
    path.join(process.resourcesPath || "", "assets", "logoSW.png"),
  ];
  return candidates.find(p => p && fs.existsSync(p)) || null;
}

const logoPath = resolveLogoPath();
const logoDataURL = logoPath ? fileToDataURL(logoPath) : "";

/* -------------------- expose safe API -------------------- */
contextBridge.exposeInMainWorld("smartwebify", {
  // Invoice JSON
  saveInvoiceJSON: (data) => ipcRenderer.invoke("save-invoice-json", data),
  openInvoiceJSON: () => ipcRenderer.invoke("open-invoice-json"),

  // PDF export (general)
  exportPDFFromHTML: (payload) =>
    ipcRenderer.invoke("smartwebify:exportPDFFromHTML", payload),

  // Convenience: always save to Desktop (silent)
  exportPDFToDesktop: ({ html, css, meta = {} }) =>
    ipcRenderer.invoke("smartwebify:exportPDFFromHTML", {
      html, css,
      meta: { ...meta, to: "desktop", silent: true }
    }),

  // (Optional) Legacy dialog-only export
  exportPDFFromHTMLWithDialog: (payload) =>
    ipcRenderer.invoke("export-pdf-from-html", payload),

  // File pickers
  pickLogo: () => ipcRenderer.invoke("smartwebify:pickLogo"),

  // Openers for exported files/URLs
  openPath: (absPath) => ipcRenderer.invoke("smartwebify:openPath", absPath),
  showInFolder: (absPath) => ipcRenderer.invoke("smartwebify:showInFolder", absPath),
  openExternal: (url) => ipcRenderer.invoke("smartwebify:openExternal", url),

  // Print-mode signals (return unsubscribe for cleanup)
  onEnterPrintMode: (cb) => {
    const listener = () => cb && cb();
    ipcRenderer.on("enter-print-mode", listener);
    return () => ipcRenderer.removeListener("enter-print-mode", listener);
  },
  onExitPrintMode: (cb) => {
    const listener = () => cb && cb();
    ipcRenderer.on("exit-print-mode", listener);
    return () => ipcRenderer.removeListener("exit-print-mode", listener);
  },

  // Assets available to the renderer / pdfView
  assets: {
    // IMPORTANT: data URL so it renders in data: HTML & printToPDF
    logo: logoDataURL, // empty string if not found
  },
});
