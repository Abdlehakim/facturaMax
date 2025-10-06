// site/web-shim.js — minimal browser shim for Electron-only APIs

// Provide a no-op "smartwebify" object so renderer code doesn't crash in the web demo.
window.smartwebify = window.smartwebify || {
  assets: {},
  exportPDFFromHTML: async () => {
    alert("L'export PDF nécessite la version bureau. Téléchargez l'installeur Windows.");
    return null; // keep same contract as desktop (null = cancelled / not exported)
  },
  openDialog: async () => {
    alert("Ouvrir est disponible dans l'application bureau.");
    return null;
  },
  saveDialog: async () => {
    alert("Enregistrer est disponible dans l'application bureau.");
    return null;
  }
};

// Basic guards in case the renderer probes for ipc/require.
window.require = undefined;
window.process = undefined;

// Set local logo once DOM is ready (works on Vercel)
window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
});
