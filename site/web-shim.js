// site/web-shim.js
// Web shim for the browser build.
// - Generates a PDF with html2canvas + jsPDF (no print dialog).
// - If a window is pre-opened by the click handler, streams the PDF into it
//   so the viewer opens in a new tab without being blocked by pop-up rules.
// - Falls back to a normal file download if needed.
// - Also provides JSON save/open helpers for the web demo.

//////////////////////// small utils ////////////////////////
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

// Keep created object URLs alive until page unload (prevents “Ouvrir” no-op)
const __swb_keptUrls = new Set();
function keepObjectUrl(url) {
  if (url) __swb_keptUrls.add(url);
  return url;
}
window.addEventListener("pagehide", () => {
  for (const u of __swb_keptUrls) { try { URL.revokeObjectURL(u); } catch {} }
  __swb_keptUrls.clear();
});

// Host snippet so the HTML has your CSS applied while rendering off-screen
function buildHost(html, css) {
  return `
    <style>
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      ${css || ""}
      html, body { margin: 0; padding: 0; background: #fff; }
      #root { width: 794px; } /* ~A4 width @96dpi */
    </style>
    <div id="root">${html || ""}</div>
  `;
}

// Render a DOM node to a (tall) canvas using html2canvas
async function renderNodeToCanvas(node, scale = 2) {
  return await html2canvas(node, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight
  });
}

// Slice the tall canvas into A4 pages and return a PDF Blob (jsPDF UMD)
async function canvasToA4PdfBlob(canvas) {
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Image size when fitted to page width
  const imgW = pageW;
  const imgH = (canvas.height * pageW) / canvas.width;

  // Pixels per millimeter in the fitted image
  const pxPerMM = canvas.height / imgH;
  const pageHPx = pageH * pxPerMM;

  let y = 0;
  let pageIndex = 0;

  while (y < canvas.height) {
    const sliceH = Math.min(pageHPx, canvas.height - y);

    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;

    const ctx = slice.getContext("2d");
    ctx.drawImage(
      canvas,
      0, y, canvas.width, sliceH, // src
      0, 0, slice.width, slice.height // dst
    );

    const img = slice.toDataURL("image/jpeg", 0.95);
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, pageW, sliceH / pxPerMM, undefined, "FAST");

    y += sliceH;
    pageIndex += 1;
  }

  return pdf.output("blob");
}

// Ensure demo has a logo if none was set
window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});

// Prepare namespace
window.smartwebify = window.smartwebify || {};

/**
 * Export PDF directly (no print dialog) and optionally open it in a pre-opened tab.
 * Params:
 *   {
 *     html, css,
 *     meta: {
 *       number, docType, filename,
 *       // If provided, MUST be opened synchronously by the click handler:
 *       preopen: Window,
 *       // If true, DO NOT open or download. Just return {url, name}.
 *       deferOpen: boolean
 *     }
 *   }
 * Returns:
 *   { ok: true, name: string, url?: string, opened: boolean } | null
 */
window.smartwebify.exportPDFFromHTML = async ({ html, css, meta = {} }) => {
  const name = meta.filename || `${docTypeText(meta.docType)} - ${sanitize(meta.number || today())}.pdf`;

  // Host element off-screen
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = "794px";
  host.style.background = "#fff";
  host.innerHTML = buildHost(html, css);
  document.body.appendChild(host);

  try {
    const root = host.querySelector("#root");
    const canvas = await renderNodeToCanvas(root, 2);
    const blob = await canvasToA4PdfBlob(canvas);
    const url = keepObjectUrl(URL.createObjectURL(blob));

    // NEW: caller wants to control when to open (no navigation, no download)
    if (meta.deferOpen) {
      return { ok: true, name, url, opened: false };
    }

    // If a tab was pre-opened in the click handler, stream the blob into it
    const w = meta.preopen || null;
    if (w && !w.closed) {
      w.location.href = url;              // navigation succeeds under the original user gesture
      return { ok: true, name, url, opened: true };
    }

    // Fallback: download
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // (URL is kept alive so "Ouvrir" can still use it if you show a dialog after)
    return { ok: true, name, url, opened: false };
  } catch (e) {
    console.error("PDF export (web) failed:", e);
    alert("Impossible de générer le PDF dans le navigateur.");
    return null;
  } finally {
    host.remove();
  }
};

//////////////////// JSON save/open (web) ////////////////////
window.smartwebify.saveInvoiceJSONToDesktop = async (payload = {}) => {
  const meta = payload.meta || {};
  const name = `${docTypeText(meta.docType)} - ${sanitize(meta.number || today())}.json`;
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });

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
      return null; // user canceled
    }
  }

  // Fallback: download (keep URL alive briefly just in case)
  const url = keepObjectUrl(URL.createObjectURL(blob));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { ok: true, name };
};

window.smartwebify.openInvoiceJSON = async () => {
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
    } catch { return null; }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return resolve(null);
      try { resolve(JSON.parse(await f.text())); } catch { resolve(null); }
    };
    input.click();
  });
};

//////////////////// renderer API stubs (web) ////////////////////
window.smartwebify.saveInvoiceJSON = async (data) =>
  window.smartwebify.saveInvoiceJSONToDesktop(data);

window.smartwebify.exportPDFFromHTMLWithDialog = async (p) =>
  window.smartwebify.exportPDFFromHTML(p);

window.smartwebify.pickLogo = async () => null;

window.smartwebify.openPath = async () => false;
window.smartwebify.showInFolder = async () => false;
window.smartwebify.openExternal = async (url) => {
  try { window.open(url, "_blank", "noopener"); return true; }
  catch { return false; }
};

window.smartwebify.onEnterPrintMode = () => () => {};
window.smartwebify.onExitPrintMode  = () => () => {};

window.smartwebify.assets = window.smartwebify.assets || {};
