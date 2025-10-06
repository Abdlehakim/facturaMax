// site/web-shim.js
function docTypeLabel(v = "") {
  v = String(v).toLowerCase();
  if (v === "devis") return "Devis";
  if (v === "bl") return "Bon de livraison";
  if (v === "bc") return "Bon de commande";
  return "Facture";
}
function sanitize(s = "") { return String(s).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim(); }
function buildHtmlDoc(html, css, title) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    ${css || ""}
  </style>
</head>
<body>${html || ""}</body>
</html>`;
}

// ensure logo in the web demo
window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});

// Export without popups: render into a hidden iframe, then window.print()
window.smartwebify = window.smartwebify || {};
window.smartwebify.exportPDFFromHTML = async ({ html, css, meta = {} }) => {
  const name = `${docTypeLabel(meta.docType)} - ${sanitize(meta.number || new Date().toISOString().slice(0,10))}`;
  const printHtml = buildHtmlDoc(html, css, name);

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
    // Small delay to ensure layout/fonts are ready
    setTimeout(() => {
      try {
        iframe.contentWindow.document.title = name; // becomes default filename in some browsers
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } finally {
        // cleanup after print dialog opens
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

// No-ops for desktop-only helpers
window.smartwebify.openDialog = async () => null;
window.smartwebify.saveDialog = async () => null;
window.smartwebify.assets = window.smartwebify.assets || {};
