// main.js
"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

/* -------- dev cache/location + gpu flags (must be before ready) -------- */
if (!app.isPackaged) {
  const temp = process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp";
  const devData = path.join(temp, "SmartwebifyInvoiceDev");
  app.setPath("userData", devData);
}
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
// app.commandLine.appendSwitch("disable-gpu"); // only if needed

/* -------- squirrel guard (electron-builder) -------- */
const isSquirrel =
  process.platform === "win32" &&
  process.argv.some((a) => a.startsWith("--squirrel"));
if (isSquirrel) app.quit();

const isDev = !app.isPackaged;

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

/* -------- live reload in dev -------- */
function setupDevReload() {
  let chokidar;
  try {
    chokidar = require("chokidar");
  } catch {
    console.warn("Live reload disabled (chokidar not installed).");
    return;
  }

  const watchPaths = [
    path.join(__dirname, "src", "renderer"),
    path.join(__dirname, "main.js"),
    path.join(__dirname, "preload.js"),
  ];
  const watcher = chokidar.watch(watchPaths, { ignoreInitial: true });
  watcher.on("change", (p) => {
    if (p.endsWith("main.js") || p.endsWith("preload.js")) {
      app.relaunch();
      app.exit(0);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });
}

/* ---------------------------- utils ------------------------------- */
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
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function docTypeLabelFromValue(val = "") {
  const v = String(val || "").toLowerCase();
  if (v === "devis") return "Devis";
  if (v === "bl")    return "Bon de livraison";
  if (v === "bc")    return "Bon de commande";
  // default
  return "Facture";
}

/** Build a minimal HTML shell for pdfView/pdfWH output */
function buildHtmlDoc(html, css) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <style>${css || ""}</style>
</head>
<body>${html || ""}</body>
</html>`;
}

/** Render the given HTML/CSS to a PDF Buffer */
async function renderToPdfBuffer(html, css) {
  const doc = buildHtmlDoc(html, css);
  let win;
  try {
    win = new BrowserWindow({
      show: false,
      backgroundColor: "#ffffff",
      width: 900,
      height: 1273, // ~A4 portrait @ ~96dpi
      webPreferences: { sandbox: true },
    });

    const dataUrl = "data:text/html;base64," + Buffer.from(doc).toString("base64");
    await win.loadURL(dataUrl);

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      marginsType: 1,
      pageSize: "A4",
      landscape: false,
    });
    return pdfBuffer;
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

/* -------- app lifecycle -------- */
app.whenReady().then(() => {
  createWindow();
  if (isDev) setupDevReload();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

/* ============================== IPC =============================== */

/* Save invoice JSON — filename uses selected document type + number */
ipcMain.handle("save-invoice-json", async (_evt, payload) => {
  const meta = payload?.meta || {};
  const typeLabel = docTypeLabelFromValue(meta.docType);
  const numOrDate = sanitizeFileName(meta.number || todayStr());
  const suggested = withJsonExt(`${typeLabel} - ${numOrDate}`);

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Enregistrer",
    defaultPath: suggested,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return filePath;
});

/* Open invoice JSON */
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
    dialog.showErrorBox("JSON invalide", "Le fichier sélectionné n’est pas un JSON de facture valide.");
    return null;
  }
});

/* Pick logo → data URL (alias two channels for safety) */
async function pickLogoImpl() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choisir un logo",
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "ico"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths?.[0]) return null;
  const filePath = filePaths[0];
  const base64 = fs.readFileSync(filePath).toString("base64");
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return { dataUrl: `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${base64}` };
}
ipcMain.handle("pick-logo", pickLogoImpl);
ipcMain.handle("smartwebify:pickLogo", pickLogoImpl);

/* Legacy dialog-only PDF export */
ipcMain.handle("export-pdf-from-html", async (_evt, payload) => {
  const { html = "", css = "", meta } = payload || {};
  const defaultName = withPdfExt(`${docTypeLabelFromValue(meta?.docType)} - ${sanitizeFileName(meta?.number || todayStr())}`);

  const save = await dialog.showSaveDialog({
    title: "Exporter PDF",
    defaultPath: defaultName,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (save.canceled || !save.filePath) return null;

  try {
    const pdfBuffer = await renderToPdfBuffer(html, css);
    fs.writeFileSync(save.filePath, pdfBuffer);
    return save.filePath;
  } catch (err) {
    console.error("export-pdf-from-html error:", err);
    dialog.showErrorBox("Erreur PDF", String(err?.message || err));
    return null;
  }
});

/* New export with optional silent autosave and custom filename */
ipcMain.handle("smartwebify:exportPDFFromHTML", async (event, payload) => {
  const { html = "", css = "", meta = {}, silent } = payload || {};
  const isSilent = meta.silent === true || silent === true;

  try {
    const pdfBuffer = await renderToPdfBuffer(html, css);

    if (isSilent) {
      const saveDir =
        (meta.useSameDirAs ? path.dirname(meta.useSameDirAs) : null) ||
        meta.saveDir ||
        app.getPath("downloads");

      const baseName =
        meta.filename ||
        `${docTypeLabelFromValue(meta.docType)} - ${sanitizeFileName(meta.number || todayStr())}.pdf`;

      const fileName = withPdfExt(sanitizeFileName(baseName));
      const fullPath = path.join(saveDir, fileName);
      fs.writeFileSync(fullPath, pdfBuffer);
      return fullPath;
    }

    const defaultName =
      meta.filename ||
      `${docTypeLabelFromValue(meta.docType)} - ${sanitizeFileName(meta.number || todayStr())}.pdf`;

    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Exporter PDF",
        defaultPath: withPdfExt(defaultName),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      }
    );
    if (canceled || !filePath) return null;

    fs.writeFileSync(filePath, pdfBuffer);
    return filePath;
  } catch (err) {
    console.error("smartwebify:exportPDFFromHTML error:", err);
    dialog.showErrorBox("Erreur PDF", String(err?.message || err));
    return null;
  }
});

/* Openers used by renderer openPDFFile() */
ipcMain.handle("smartwebify:openPath", async (_evt, absPath) => {
  try {
    const res = await shell.openPath(absPath);
    return res === "";
  } catch {
    return false;
  }
});
ipcMain.handle("smartwebify:showInFolder", async (_evt, absPath) => {
  try {
    shell.showItemInFolder(absPath);
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("smartwebify:openExternal", async (_evt, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch {
    return false;
  }
});
