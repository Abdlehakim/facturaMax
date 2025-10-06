// site/web-shim.js
// Web shim to mimic the Electron preload API in the browser (Vercel demo).

/* -------------------- small helpers -------------------- */
function docTypeText(v = "") {
  v = String(v).toLowerCase();
  if (v === "devis") return "Devis";
  if (v === "bl") return "Bon de livraison";
  if (v === "bc") return "Bon de commande";
  return "Facture";
}
function sanitize(name = "") {
  return String(name).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function buildPrintHtml(html, css, title) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    ${css || ""}
  </style>
</head>
<body>${html || ""}</body>
</html>`;
}

/* -------------------- nice-to-haves -------------------- */
// Ensure the demo shows a logo without requiring users to pick one
window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});

/* -------------------- API: mirror the desktop preload -------------------- */
window.smartwebify = window.smartwebify || {};

/**
 * Export PDF in the web demo:
 * - Renders invoice HTML+CSS into a hidden iframe (no popup)
 * - Opens the browser print dialog; users choose "Save as PDF"
 */
window.smartwebify.exportPDFFromHTML = async ({ html, css, meta = {} }) => {
  const base = `${docTypeText(meta.docType)} - ${sanitize(meta.number || today())}`;
  const printHtml = buildPrintHtml(html, css, base);

  const blob = new Blob([printHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  iframe.onload = () => {
    // Give a moment for layout/fonts to settle, then print
    setTimeout(() => {
      try {
        iframe.contentWindow.document.title = base; // default filename in some browsers
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        // Clean up shortly after the dialog opens
        setTimeout(() => {
          URL.revokeObjectURL(url);
          iframe.remove();
        }, 1500);
      }
    }, 100);
  };

  iframe.src = url;
  return true;
};

/**
 * Save invoice JSON in the web demo:
 * - Uses File System Access API when available (Chrome/Edge) -> user can choose Desktop
 * - Fallback: regular browser download to the default Downloads folder
 * Returns { ok: true, name } on success, or null if user cancels (FS API path).
 */
window.smartwebify.saveInvoiceJSONToDesktop = async (payload = {}) => {
  const meta = payload.meta || {};
  const name = `${docTypeText(meta.docType)} - ${sanitize(meta.number || today())}.json`;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  // Best experience: File System Access API
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, name };
    } catch {
      // user canceled or denied
      return null;
    }
  }

  // Fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
  return { ok: true, name };
};

/**
 * Open invoice JSON in the web demo:
 * - Uses File System Access API if available
 * - Fallback to <input type="file">
 * Returns parsed object or null.
 */
window.smartwebify.openInvoiceJSON = async () => {
  // FS Access API path
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
        multiple: false,
      });
      if (!handle) return null;
      const file = await handle.getFile();
      const text = await file.text();
      try { return JSON.parse(text); } catch { return null; }
    } catch {
      return null;
    }
  }

  // Input fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        resolve(JSON.parse(text));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
};

/* ---------- Optional compatibility stubs used by desktop code ---------- */
window.smartwebify.exportPDFFromHTMLWithDialog = async (p) =>
  window.smartwebify.exportPDFFromHTML(p);
window.smartwebify.saveInvoiceJSON = async (data) =>
  window.smartwebify.saveInvoiceJSONToDesktop(data);
window.smartwebify.pickLogo = async () => null; // desktop-only
window.smartwebify.openPath = async () => false;
window.smartwebify.showInFolder = async () => false;
window.smartwebify.openExternal = async (url) => { try { window.open(url, "_blank", "noopener"); return true; } catch { return false; } };
window.smartwebify.onEnterPrintMode = () => () => {};
window.smartwebify.onExitPrintMode = () => () => {};
window.smartwebify.assets = window.smartwebify.assets || {};
