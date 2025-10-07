// site/web-shim.js
// Web shim: generate a PDF directly (no print dialog) using html2canvas + jsPDF,
// and provide JSON save/open helpers for the web demo.

// -------------------- small helpers --------------------
function docTypeText(v = "") {
  v = String(v).toLowerCase();
  if (v === "devis") return "Devis";
  if (v === "bl")    return "Bon de livraison";
  if (v === "bc")    return "Bon de commande";
  return "Facture";
}
function sanitize(name = "") {
  return String(name).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Build a tiny host so the invoice HTML gets your CSS applied off-screen
function buildHost(html, css) {
  return `
    <style>
      /* ensure colors print/render as on screen */
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      ${css || ""}
      html, body { margin: 0; padding: 0; background: #fff; }
      #root { width: 100%; }
    </style>
    <div id="root">${html || ""}</div>
  `;
}

// Render a node to a tall canvas (html2canvas must be loaded globally)
async function renderNodeToCanvas(node, scale = 2) {
  return await html2canvas(node, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    windowWidth:  node.scrollWidth,
    windowHeight: node.scrollHeight
  });
}

// Slice a tall canvas into A4 pages, create a PDF Blob + URL, trigger download, and return {ok,name,url}
async function canvasToA4PdfAndDownload(canvas, filename) {
  const { jsPDF } = window.jspdf; // from UMD bundle

  // A4 in millimeters
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Fit canvas to page width; compute resulting height
  const imgWidth  = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width;

  // How many pixels correspond to 1mm at that scaling:
  const pxPerMM      = canvas.height / imgHeight;
  const pageHeightPx = pageHeight * pxPerMM;

  let pageIndex = 0;
  while (true) {
    const srcY = pageIndex * pageHeightPx;
    if (srcY >= canvas.height) break;

    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - srcY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width  = canvas.width;
    sliceCanvas.height = sliceHeightPx;

    const ctx = sliceCanvas.getContext("2d");
    ctx.drawImage(
      canvas,
      0, srcY, canvas.width, sliceHeightPx,   // source
      0, 0,   canvas.width, sliceHeightPx     // destination
    );

    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.95);
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, (sliceHeightPx / pxPerMM), undefined, "FAST");

    pageIndex++;
  }

  // Make a Blob + object URL so we can open it in a new tab
  const blob = pdf.output("blob");
  const url  = URL.createObjectURL(blob);

  // Also trigger a download for convenience
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke after a while (keep long enough for “Open”)
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);

  return { ok: true, name: filename, url };
}

// -------------------- default logo for the demo --------------------
window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});

// Ensure namespace
window.smartwebify = window.smartwebify || {};
window.smartwebify.assets = window.smartwebify.assets || {};

// -------------------- PDF export API (web) --------------------
/**
 * Export PDF directly (no print dialog) on the web.
 * Expects: { html, css, meta }
 * Returns: { ok:true, name: '...', url: 'blob:...' }  (or null on failure)
 */
window.smartwebify.exportPDFFromHTML = async ({ html, css, meta = {} }) => {
  const baseName = `${docTypeText(meta.docType)} - ${sanitize(meta.number || today())}.pdf`;

  // Host element off-screen (A4 ≈ 794px @ 96dpi)
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
    const canvas = await renderNodeToCanvas(root, 2);         // scale=2 for sharper output
    return await canvasToA4PdfAndDownload(canvas, baseName);  // -> {ok,name,url}
  } catch (e) {
    console.error("PDF export (web) failed:", e);
    alert("Impossible de générer le PDF dans le navigateur.");
    return null;
  } finally {
    host.remove();
  }
};

// -------------------- JSON save / open (web) --------------------
/**
 * Save JSON to user-chosen location (File System Access API when available),
 * otherwise fall back to a normal download to the default folder.
 */
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

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
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

  // Fallback: classic <input type="file">
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
      try { resolve(JSON.parse(await f.text())); }
      catch { resolve(null); }
    };
    input.click();
  });
};

// -------------------- stubs to match desktop API surface --------------------
window.smartwebify.saveInvoiceJSON              = async (data) => window.smartwebify.saveInvoiceJSONToDesktop(data);
window.smartwebify.exportPDFFromHTMLWithDialog  = async (p)    => window.smartwebify.exportPDFFromHTML(p);
window.smartwebify.pickLogo                     = async ()     => null;
window.smartwebify.openPath                     = async ()     => false;
window.smartwebify.showInFolder                 = async ()     => false;
window.smartwebify.openExternal                 = async (url)  => { try { window.open(url, "_blank", "noopener"); return true; } catch { return false; } };
window.smartwebify.onEnterPrintMode             = () => () => {};
window.smartwebify.onExitPrintMode              = () => () => {};
