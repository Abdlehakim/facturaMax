// site/web-shim.js — browser shim + auto-download of latest Windows installer

const GITHUB_OWNER = "Abdlehakim";           // <-- change if different
const GITHUB_REPO  = "smartwebify-invoice-maker"; // <-- your Electron repo
const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
const LATEST_API   = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

let latestAssetUrl = null; // filled after fetch

async function fetchLatestAssetUrl() {
  try {
    const res = await fetch(LATEST_API);
    if (!res.ok) throw new Error("GitHub API error");
    const data = await res.json();
    const asset =
      (data.assets || []).find(a => /Smartwebify-Invoice-Maker-Setup-.*\.exe$/i.test(a.name)) ||
      (data.assets || [])[0];
    latestAssetUrl = asset?.browser_download_url || null;

    // If you add a header download button with id="downloadBtn", wire it:
    const btn = document.getElementById("downloadBtn");
    const meta = document.getElementById("downloadMeta");
    if (btn) btn.href = latestAssetUrl || RELEASES_URL;
    if (meta && data?.tag_name) meta.textContent = `Version ${data.tag_name}`;
  } catch {
    latestAssetUrl = null;
  }
}

// Provide a no-op “smartwebify” so renderer works in the browser
window.smartwebify = window.smartwebify || {
  assets: {},
  exportPDFFromHTML: async () => {
    // Instead of blocking alert, offer download
    const go = confirm(
      "L’export PDF est disponible dans la version bureau.\nVoulez-vous télécharger l’installeur Windows maintenant ?"
    );
    if (go) {
      if (!latestAssetUrl) {
        // best effort: open releases page
        window.open(RELEASES_URL, "_blank");
      } else {
        window.location.href = latestAssetUrl;
      }
    }
    return null; // keep contract with desktop
  },
  openDialog: async () => {
    alert("Ouvrir est disponible dans l’application bureau.");
    return null;
  },
  saveDialog: async () => {
    alert("Enregistrer est disponible dans l’application bureau.");
    return null;
  }
};

// Basic guards
window.require = undefined;
window.process = undefined;

window.addEventListener("DOMContentLoaded", () => {
  const img = document.getElementById("companyLogo");
  if (img && !img.src) img.src = "./logoSW.png";
  fetchLatestAssetUrl();
});
