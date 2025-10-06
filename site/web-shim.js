// site/web-shim.js
// Web shim: generate a PDF directly (no print dialog) using html2canvas + jsPDF,
// and provide JSON save/open helpers for the web demo.

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

// A tiny host document so the HTML has your CSS applied
function buildHost(html, css) {
  return `
    <style>
      /* ensure colors print/render as on screen */
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      ${css || ""}
      body { margin: 0; }
    </style>
    <div id="root">${html || ""}</div>
  `;
}

// Render node to a tall canvas
async function renderNodeToCanvas(node, scale = 2) {
  // html2canvas is loaded globally (html2canvas)
  return await html2canvas(node, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight
  });
}

// Slice the tall canvas into A4 pages and emit a PDF download
async function canvasToA4PdfAndDownload(canvas, filename) {
  // jsPDF UMD is loaded globally at window.jspdf.jsPDF
  const { jsPDF } = window.jspdf;

  // A4 size in millimeters
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Convert canvas to JPEG at a good quality
  const imgWidth = pageWidth; // we scale image to fit width
  const imgHeight = (canvas.height * pageWidth) / canvas.width; // keep aspect

  // How many PDF pages?
  let remainingHeight = imgHeight;
  let position = 0;

  // We draw from the canvas in chunks by shifting a viewport
  // But jsPDF can accept the whole image each page by offsetting via 'position'
  // The simpler approach: draw the full image each time and move the viewport with 'position' (negative Y)
  // However, jsPDF doesn't support y-offset for images directly. So we create page slices.
  // We'll slice the canvas into page-height chunks first.

  const pxPerMM = canvas.height / imgHeight; // pixels per millimeter after scaling to fit width
  const pageHeightPx = pageHeight * pxPerMM;

  let pageIndex = 0;
  while (remainingHeight > 0) {
    const sliceCanvas = document.createElement("canvas");
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - pageIndex * pageHeightPx);

    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;

    const ctx = sliceCanvas.getContext("2d");
    ctx.drawImage(
      canvas,
      0, pageIndex * pageHeightPx,              // source x,y
      canvas.width, sliceHeightPx,              // source w,h
      0, 0,                                     // dest x,y
      sliceCanvas.width, sliceCanvas.height     // dest w,h
    );

    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.95);

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, (sliceHeightPx / pxPerMM), undefined, "FAST");

    remainingHeight -= pageHeight;
    pageIndex += 1;
  }

  pdf.save(filename);
}

window.addEventListener("DOMContentLoaded", () => {
  // Ensure demo has a logo if user didn't upload one
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});

// Public API used by your renderer (same signature as desktop)
window.smartwebify = window.smartwebify || {};

/**
 * Export PDF directly (no print dialog).
 * Expect: { html, css, meta }
 */
window.smartwebify.exportPDFFromHTML = async ({ html, css, meta = {} }) => {
  const baseName = `${docTypeText(meta.docType)} - ${sanitize(meta.number || today())}.pdf`;

  // Host element off-screen
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = "794px";  // A4 width at 96dpi ≈ 794px
  host.style.background = "#fff";
  host.innerHTML = buildHost(html, css);
  document.body.appendChild(host);

  try {
    const root = host.querySelector("#root");
    // Increase scale for sharper output; 2 is a good balance
    const canvas = await renderNodeToCanvas(root, 2);
    await canvasToA4PdfAndDownload(canvas, baseName);
    return { ok: true, name: baseName };
  } catch (e) {
    console.error("PDF export (web) failed:", e);
    alert("Impossible de générer le PDF dans le navigateur.");
    return null;
  } finally {
    host.remove();
  }
};

/* ---------- JSON save/open for the web ---------- */
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

  // Fallback: download to default folder
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
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
    input.type = "file"; input.accept = "application/json"; input.style.display = "none";
    document.body.appendChild(input);
    input.onchange = async () => {
      const f = input.files && input.files[0]; input.remove();
      if (!f) return resolve(null);
      try { resolve(JSON.parse(await f.text())); } catch { resolve(null); }
    };
    input.click();
  });
};

/* ---------- Stubs for desktop-only extras ---------- */
window.smartwebify.saveInvoiceJSON = async (data) =>
  window.smartwebify.saveInvoiceJSONToDesktop(data);
window.smartwebify.exportPDFFromHTMLWithDialog = async (p) =>
  window.smartwebify.exportPDFFromHTML(p);
window.smartwebify.pickLogo = async () => null;
window.smartwebify.openPath = async () => false;
window.smartwebify.showInFolder = async () => false;
window.smartwebify.openExternal = async (url) => { try { window.open(url, "_blank", "noopener"); return true; } catch { return false; } };
window.smartwebify.onEnterPrintMode = () => () => {};
window.smartwebify.onExitPrintMode  = () => () => {};
window.smartwebify.assets = window.smartwebify.assets || {};
