// site/web-shim.js
// Web shim: direct PDF generation (no print dialog) using html2canvas + jsPDF,
// plus JSON save/open helpers for the web demo.

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

// Build a host with your CSS applied to the provided invoice HTML
function buildHost(html, css) {
  return `
    <style>
      /* make colors render as on screen */
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      ${css || ""}
      html, body { margin: 0; padding: 0; background: #fff; }
    </style>
    <div id="root">${html || ""}</div>
  `;
}

// Render node to a tall canvas
async function renderNodeToCanvas(node, scale = 2) {
  if (typeof window.html2canvas !== "function") {
    throw new Error("html2canvas is not loaded. Include site/lib/html2canvas.min.js first.");
  }
  return await html2canvas(node, {
    scale,           // 2 = sharper, larger file. 3 if you want even sharper.
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    windowWidth: node.scrollWidth,
    windowHeight: node.scrollHeight
  });
}

// Slice the tall canvas into A4 pages and return a jsPDF instance
function canvasToA4Pdf(canvas) {
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    throw new Error("jsPDF is not loaded. Include site/lib/jspdf.umd.min.js first.");
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const pageWidth  = pdf.internal.pageSize.getWidth();   // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight();  // 297mm

  // Target image width = page width
  const imgWidth  = pageWidth;
  const imgHeight = (canvas.height * pageWidth) / canvas.width; // keep aspect

  // Pixels per mm for the scaled image
  const pxPerMM = canvas.height / imgHeight;
  const pageHeightPx = pageHeight * pxPerMM;

  let pageIndex = 0;
  let remaining = canvas.height;

  while (remaining > 0) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - pageIndex * pageHeightPx);

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceHeightPx;

    const ctx = sliceCanvas.getContext("2d");
    ctx.drawImage(
      canvas,
      0, pageIndex * pageHeightPx,           // src x,y
      canvas.width, sliceHeightPx,           // src w,h
      0, 0,                                   // dst x,y
      sliceCanvas.width, sliceCanvas.height  // dst w,h
    );

    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.95);
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, (sliceHeightPx / pxPerMM), undefined, "FAST");

    remaining -= sliceHeightPx;
    pageIndex++;
  }

  return pdf;
}

// Ensure demo shows a logo if the user didn't pick one
window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});

// Public API (mirrors desktop preload API)
window.smartwebify = window.smartwebify || {};

/**
 * Export PDF directly (no print dialog).
 * Returns:
 *  - { ok: true, name, url } on web (Blob URL + auto download)
 *  - In desktop, your preload/main return a file path string (handled separately)
 */
window.smartwebify.exportPDFFromHTML = async ({ html, css, meta = {} }) => {
  const baseName = `${docTypeText(meta.docType)} - ${sanitize(meta.number || today())}.pdf`;

  // Host element off-screen so computed styles/layout are applied
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = "794px"; // ≈ A4 width @96dpi for more consistent sizing
  host.style.background = "#fff";
  host.innerHTML = buildHost(html, css);
  document.body.appendChild(host);

  try {
    const root = host.querySelector("#root");
    const canvas = await renderNodeToCanvas(root, 2); // scale 2 => good quality
    const pdf = canvasToA4Pdf(canvas);

    // 1) Return a Blob URL so UI can "Open" in new tab if desired
    const url = pdf.output("bloburl");

    // 2) Also trigger a download automatically
    pdf.save(baseName);

    return { ok: true, name: baseName, url };
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

  // Best UX on Chromium (lets the user pick Desktop)
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

  // Fallback: force a download
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

  // Input fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.style.display = "none";
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
