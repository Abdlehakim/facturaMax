"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

if (!app.isPackaged) {
  const temp = process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp";
  const devData = path.join(temp, "SoukElMeubleInvoiceDev");
  app.setPath("userData", devData);
}
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");

const isSquirrel =
  process.platform === "win32" &&
  process.argv.some((a) => a.startsWith("--squirrel"));
if (isSquirrel) app.quit();

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "src", "renderer", "index.html"));
}

function sanitizeFileName(name = "") {
  return String(name).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
}
function withPdfExt(name = "document") {
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}
function withJsonExt(name = "document") {
  return name.toLowerCase().endsWith(".json") ? name : `${name}.json`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function docTypeLabelFromValue(val = "") {
  const v = String(val || "").toLowerCase();
  if (v === "devis") return "Devis";
  if (v === "bl") return "Bon de livraison";
  if (v === "bc") return "Bon de commande";
  return "Facture";
}
function resolveSaveDir(meta = {}) {
  if (meta.to === "desktop") return app.getPath("desktop");
  if (meta.to === "documents") return app.getPath("documents");
  if (meta.to === "downloads") return app.getPath("downloads");
  if (meta.useSameDirAs) return path.dirname(meta.useSameDirAs);
  if (meta.saveDir) return meta.saveDir;
  return app.getPath("downloads");
}
function ensureUniquePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const { dir, name, ext } = path.parse(filePath);
  let i = 2;
  let candidate = path.join(dir, `${name} (${i})${ext}`);
  while (fs.existsSync(candidate)) {
    i += 1;
    candidate = path.join(dir, `${name} (${i})${ext}`);
  }
  return candidate;
}
function buildHtmlDoc(html, css) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    ${css || ""}
    html, body { margin:0; padding:0; background:#fff; }
  </style>
</head>
<body>${html || ""}</body>
</html>`;
}
async function renderToPdfBuffer(html, css) {
  const doc = buildHtmlDoc(html, css);
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      backgroundColor: "#ffffff",
      width: 900,
      height: 1273,
      webPreferences: {
        sandbox: true,
        offscreen: true,
      },
    });

    const dataUrl =
      "data:text/html;base64," + Buffer.from(doc).toString("base64");

    const baseDir =
      "file://" +
      path.join(__dirname, "src", "renderer").replace(/\\/g, "/") +
      "/";

    await win.loadURL(dataUrl, { baseURLForDataURL: baseDir });

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      marginsType: 1,
      pageSize: "A4",
      landscape: false,
      preferCSSPageSize: true,
    });
    return pdfBuffer;
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
// Save JSON — accept both shapes and always write RAW snapshot
// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
ipcMain.handle("save-invoice-json", async (_evt, payload = {}) => {
  // Accept either a flat snapshot or { data, meta, filename }
  const incoming = (payload && payload.data && typeof payload.data === "object") ? payload.data : payload;
  const meta     = incoming?.meta || payload?.meta || {};
  const typeLabel = docTypeLabelFromValue(meta.docType);
  const numOrDate = sanitizeFileName(meta.number || todayStr());
  const baseName = withJsonExt(`${typeLabel} - ${numOrDate}`);

  const toWrite = incoming; // we always write the flat snapshot

  // Silent destinations
  if (meta?.silent === true || meta?.to || meta?.saveDir) {
    const dir = resolveSaveDir(meta);
    const target = ensureUniquePath(path.join(dir, baseName));
    fs.writeFileSync(target, JSON.stringify(toWrite, null, 2), "utf-8");
    return { ok: true, path: target, name: path.basename(target) };
  }

  // Normal save dialog
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Enregistrer",
    defaultPath: path.join(app.getPath("desktop"), baseName),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return null;

  fs.writeFileSync(filePath, JSON.stringify(toWrite, null, 2), "utf-8");
  return { ok: true, path: filePath, name: path.basename(filePath) };
});


ipcMain.handle("open-invoice-json", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Ouvrir",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths?.[0]) return null;
  const raw = fs.readFileSync(filePaths[0], "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    dialog.showErrorBox(
      "JSON invalide",
      "Le fichier sélectionné n’est pas un JSON de facture valide."
    );
    return null;
  }
});

ipcMain.handle("SoukElMeuble:pickLogo", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choisir un logo",
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "ico", "svg"] },
    ],
    properties: ["openFile"],
  });
  if (canceled || !filePaths?.[0]) return null;
  const filePath = filePaths[0];
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const base64 = fs.readFileSync(filePath).toString("base64");
  const mime =
    ext === "svg"
      ? "image/svg+xml"
      : ext === "jpg"
      ? "image/jpeg"
      : `image/${ext || "png"}`;
  return { dataUrl: `data:${mime};base64,${base64}` };
});

ipcMain.handle("SoukElMeuble:exportPDFFromHTML", async (event, payload) => {
  const { html = "", css = "", meta = {}, silent } = payload || {};
  const isSilent =
    meta.silent === true || silent === true || !!meta.to || !!meta.saveDir;

  try {
    const pdfBuffer = await renderToPdfBuffer(html, css);
    const baseName =
      meta.filename ||
      `${docTypeLabelFromValue(meta.docType)} - ${sanitizeFileName(
        meta.number || todayStr()
      )}.pdf`;
    const fileName = withPdfExt(sanitizeFileName(baseName));

    if (isSilent) {
      const saveDir = resolveSaveDir(meta);
      const target = ensureUniquePath(path.join(saveDir, fileName));
      fs.writeFileSync(target, pdfBuffer);
      return { ok: true, path: target, name: path.basename(target) };
    }

    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Exporter PDF",
        defaultPath: path.join(app.getPath("desktop"), fileName),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      }
    );
    if (canceled || !filePath) return null;

    fs.writeFileSync(filePath, pdfBuffer);
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (err) {
    console.error("exportPDFFromHTML error:", err);
    dialog.showErrorBox("Erreur PDF", String(err?.message || err));
    return null;
  }
});

ipcMain.handle("SoukElMeuble:openPath", async (_evt, absPath) => {
  try {
    const res = await shell.openPath(absPath);
    return res === "";
  } catch {
    return false;
  }
});
ipcMain.handle("SoukElMeuble:showInFolder", async (_evt, absPath) => {
  try {
    shell.showItemInFolder(absPath);
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("SoukElMeuble:openExternal", async (_evt, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
});
