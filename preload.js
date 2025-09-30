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
      ext === "png"  ? "image/png"  :
      ext === "jpg"  || ext === "jpeg" ? "image/jpeg" :
      ext === "webp" ? "image/webp" :
      ext === "gif"  ? "image/gif"  :
      ext === "bmp"  ? "image/bmp"  :
      "application/octet-stream";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Resolve the logo path in both dev and packaged builds.
 * Your repo shows: src/renderer/assets/logoSW.png
 */
function resolveLogoPath() {
  const candidates = [
    // dev layout (preload.js at project root)
    path.join(__dirname, "src", "renderer", "assets", "logoSW.png"),
    // if you ever copy assets next to preload.js
    path.join(__dirname, "assets", "logoSW.png"),
    // resources path (packaged apps)
    path.join(process.resourcesPath || "", "src", "renderer", "assets", "logoSW.png"),
    path.join(process.resourcesPath || "", "assets", "logoSW.png"),
  ];
  return candidates.find(p => p && fs.existsSync(p)) || null;
}

const logoPath = resolveLogoPath();
const logoDataURL = logoPath ? fileToDataURL(logoPath) : null;

/* -------------------- expose safe API -------------------- */
/* Use contextBridge to keep renderer isolated but give it the hooks it needs */
contextBridge.exposeInMainWorld("smartwebify", {
  // invoice JSON
  saveInvoiceJSON: (data) => ipcRenderer.invoke("save-invoice-json", data),
  openInvoiceJSON: () => ipcRenderer.invoke("open-invoice-json"),

  // PDF export for the *HTML built by pdfView.js*
  exportPDFFromHTML: (payload) => ipcRenderer.invoke("export-pdf-from-html", payload),

  // Optional file pickers (used for logo change)
  pickLogo: () => ipcRenderer.invoke("smartwebify:pickLogo"),

  // Openers for exported files/URLs (renderer will prefer these over window.open)
  openPath: (absPath) => ipcRenderer.invoke("smartwebify:openPath", absPath),
  showInFolder: (absPath) => ipcRenderer.invoke("smartwebify:showInFolder", absPath),
  openExternal: (url) => ipcRenderer.invoke("smartwebify:openExternal", url),

  // print-mode signals (if you still use overlay flow anywhere)
  onEnterPrintMode: (cb) => ipcRenderer.on("enter-print-mode", () => cb && cb()),
  onExitPrintMode:  (cb) => ipcRenderer.on("exit-print-mode",  () => cb && cb()),

  // assets available to the renderer / pdfView
  assets: {
    // IMPORTANT: data URL so it renders in data: HTML & printToPDF
    logo: logoDataURL || "", // empty string if not found
  },
});
