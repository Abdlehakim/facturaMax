// site/web-shim.js
// Web demo: export PDF by opening a print-only window with your HTML+CSS.
// Works in Chrome/Edge/Firefox/Safari without extra libraries.

function docTypeLabel(val = "") {
  const v = String(val || "").toLowerCase();
  if (v === "devis") return "Devis";
  if (v === "bl")    return "Bon de livraison";
  if (v === "bc")    return "Bon de commande";
  return "Facture";
}

function sanitize(name = "") {
  return String(name).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
}

function buildHtmlDoc(html, css, title) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    /* Ensure backgrounds and colors print */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    ${css || ""}
  </style>
</head>
<body>${html || ""}</body>
</html>`;
}

// Optional: set the logo on the live page for the demo UI
window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});

// --- Public API exposed by preload in desktop; we mimic it in the web demo ---
window.smartwebify = window.smartwebify || {};
window.smartwebify.exportPDFFromHTML = async ({ html, css, meta = {} }) => {
  const name = `${docTypeLabel(meta.docType)} - ${sanitize(meta.number || new Date().toISOString().slice(0,10))}.pdf`;
  const title = name.replace(/\.pdf$/i, ""); // browsers use window.title as default filename

  const printHtml = buildHtmlDoc(html, css, title);

  // Open a popup to render and print
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    alert("La fenêtre d'impression a été bloquée. Autorisez les pop-ups pour ce site, puis réessayez.");
    return null;
  }

  w.document.open();
  w.document.write(printHtml);
  w.document.close();

  // Trigger print once content is ready
  const doPrint = () => {
    // Give the browser a tick to layout
    setTimeout(() => {
      try { w.focus(); } catch {}
      w.print();
      // Close after a short delay (user can cancel and the window will stay)
      setTimeout(() => { try { w.close(); } catch {} }, 1500);
    }, 150);
  };

  if (w.document.readyState === "complete") doPrint();
  else w.onload = doPrint;

  return true; // indicates we attempted to print
};

// Compatibility no-ops for other desktop-only functions
window.smartwebify.openDialog   = async () => null;
window.smartwebify.saveDialog   = async () => null;
window.smartwebify.assets       = window.smartwebify.assets || {};
