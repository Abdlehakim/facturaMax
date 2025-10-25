"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const { spawn } = require("child_process");

// Use a predictable userData path in dev
if (!app.isPackaged) {
  const temp = process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp";
  const devData = path.join(temp, "SoukElMeubleInvoiceDev");
  app.setPath("userData", devData);
}

// Useful GPU cache tweak
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
// Prevent Chromium's Web File System pickers in desktop app
app.commandLine.appendSwitch("disable-features", "FileSystemAccessAPI,NativeFileSystemAPI");

// Squirrel shortcut handling
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
      preload: path.join(__dirname, "preload.desktop.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "src", "renderer", "index.html"));
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

// ───────── helpers ─────────
function sanitizeFileName(name = "") {
  let out = String(name)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const base = out.split(".")[0]?.trim();
  if (!base || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) {
    out = `file-${Date.now()}`;
  }
  out = out.replace(/[.\s]+$/g, "");
  if (out.length > 120) out = out.slice(0, 120).trim();
  return out || "file";
}
const withPdfExt = (n = "document") =>
  n.toLowerCase().endsWith(".pdf") ? n : `${n}.pdf`;
const withJsonExt = (n = "document") =>
  n.toLowerCase().endsWith(".json") ? n : `${n}.json`;
const todayStr = () => new Date().toISOString().slice(0, 10);
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
      webPreferences: { sandbox: true, offscreen: true },
    });
    const dataUrl =
      "data:text/html;base64," + Buffer.from(doc).toString("base64");
    const baseDir =
      "file://" + path.join(__dirname, "src", "renderer").replace(/\\/g, "/") + "/";
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

// Program Files helpers & write checks
function getProgramFilesDir() {
  return (
    process.env["ProgramW6432"] ||
    process.env["ProgramFiles"] ||
    "C:\\Program Files"
  );
}
function pfPath(subdir) {
  return path.join(getProgramFilesDir(), "FacturaMax", subdir);
}
async function tryEnsure(dir) {
  try { await fsp.mkdir(dir, { recursive: true }); } catch {}
}
function getClientsSystemFolder() {
  if (process.platform === "win32") {
    return pfPath("Clients");
  }
  return path.join(app.getPath("documents"), "FacturaMax", "Clients");
}
async function canWriteTo(dir) {
  try {
    await fsp.mkdir(dir, { recursive: true });
    const test = path.join(dir, `.write-test-${Date.now()}.tmp`);
    await fsp.writeFile(test, "ok", "utf-8");
    await fsp.unlink(test);
    return true;
  } catch {
    return false;
  }
}
function runElevatedWin(commands) {
  return new Promise((resolve) => {
    const args = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Start-Process cmd -Verb RunAs -ArgumentList '/c ${commands.replace(
        /'/g,
        "''"
      )}'`,
    ];
    const child = spawn("powershell.exe", args, {
      windowsHide: true,
      stdio: "ignore",
    });
    child.on("error", () => resolve({ ok: false, error: "spawn error" }));
    child.on("exit", (code) => resolve({ ok: code === 0 }));
    setTimeout(() => resolve({ ok: true, deferred: true }), 1200);
  });
}
async function ensureClientsFolderWin() {
  const dir = getClientsSystemFolder();
  try {
    await fsp.mkdir(dir, { recursive: true });
    if (await canWriteTo(dir)) return { ok: true, path: dir, elevated: false };
  } catch {}
  const mk = `mkdir "${dir}"`;
  const acl = `icacls "${dir}" /grant *S-1-5-32-545:(OI)(CI)M /T /C`;
  const res = await runElevatedWin(`${mk} && ${acl}`);
  if (res.ok) {
    for (let i = 0; i < 12; i++) {
      if (await canWriteTo(dir)) return { ok: true, path: dir, elevated: true };
      await new Promise((r) => setTimeout(r, 250));
    }
    return { ok: false, error: "UAC OK but write test failed", path: dir };
  }
  return { ok: false, error: "UAC rejected or failed", canceled: true, path: dir };
}
async function ensureClientsSystemFolder() {
  const dir = getClientsSystemFolder();
  if (process.platform === "win32") return ensureClientsFolderWin();
  try {
    await fsp.mkdir(dir, { recursive: true });
    if (await canWriteTo(dir)) return { ok: true, path: dir, elevated: false };
    return { ok: false, error: "Cannot write to folder", path: dir };
  } catch (e) {
    return { ok: false, error: String(e?.message || e), path: dir };
  }
}
function uniqueClientPath(baseDir, baseName) {
  const safe = sanitizeFileName(baseName);
  const fp = path.join(baseDir, withJsonExt(safe));
  return ensureUniquePath(fp);
}

/** ───────── Invoices ledger (auto-number + recent list) ───────── **/
const LEDGER_FILE = path.join(app.getPath("userData"), "invoices-ledger.json");
function readLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER_FILE, "utf-8")); } catch { return { counters:{}, entries:[] }; }
}
function writeLedger(ledger) {
  try { fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2), "utf-8"); } catch {}
}
function yyyymm(dateStr) {
  const s = (dateStr || todayStr()).slice(0,7);
  return s.replace(/-/g,"");
}
function pad4(n) { return String(Math.max(0, Number(n)||0)).padStart(4,"0"); }
function onlyDigits(s){ const m=String(s||"").match(/\d+/); return m ? Number(m[0]) : 0; }
function rebuildCounterForMonth(ledger, monthKey) {
  const maxN = Math.max(
    0,
    ...ledger.entries
      .filter(e => e.docType === "facture" && e.monthKey === monthKey && fs.existsSync(e.path))
      .map(e => onlyDigits(e.number))
  );
  ledger.counters[monthKey] = maxN;
}

// Next number for a date's month
ipcMain.handle("invoices:getNextNumber", async (_evt, { date } = {}) => {
  const ledger = readLedger();
  const mk = yyyymm(date || todayStr());
  const last = ledger.counters[mk] || 0;
  return { ok: true, number: pad4(last + 1), monthKey: mk };
});

// List recent saved invoices (existing on disk)
ipcMain.handle("invoices:listRecent", async (_evt, { limit = 4 } = {}) => {
  const ledger = readLedger();
  const items = ledger.entries
    .filter(e => e.docType === "facture" && fs.existsSync(e.path))
    .sort((a,b) => (b.savedAt||0) - (a.savedAt||0))
    .slice(0, limit)
    .map(e => ({ path: e.path, name: e.name, number: e.number, date: e.date, savedAt: e.savedAt }));
  return { ok: true, items };
});

// Read invoice JSON by path
ipcMain.handle("invoices:read", async (_evt, { path: p }) => {
  try {
    const txt = await fsp.readFile(p, "utf-8");
    const data = JSON.parse(txt);
    return { ok: true, data, text: txt };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

// Delete invoice file + update ledger/counter if it was the last
ipcMain.handle("invoices:delete", async (_evt, { path: p }) => {
  try {
    const ledger = readLedger();
    const entry = ledger.entries.find(e => e.path === p);
    try { await fsp.unlink(p); } catch {}
    ledger.entries = ledger.entries.filter(e => e.path !== p);
    if (entry && entry.docType === "facture") {
      rebuildCounterForMonth(ledger, entry.monthKey);
    }
    writeLedger(ledger);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

/** ───────── Clients IPC ───────── **/
ipcMain.handle("clients:ensureSystemFolder", async () => {
  try {
    return await ensureClientsSystemFolder();
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle("clients:saveDirect", async (_evt, payload = {}) => {
  try {
    const { client = {}, suggestedName = "client" } = payload || {};
    const ensure = await ensureClientsSystemFolder();
    if (!ensure.ok) return { ok: false, ...ensure };
    const base = ensure.path || getClientsSystemFolder();
    const finalPath = uniqueClientPath(
      base,
      suggestedName || client.name || "client"
    );
    await fsp.writeFile(finalPath, JSON.stringify(client, null, 2), "utf-8");
    return { ok: true, path: finalPath, name: path.basename(finalPath) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle("clients:saveWithDialog", async (event, payload = {}) => {
  try {
    const { client = {}, suggestedName = "client" } = payload || {};
    const ensured = await ensureClientsSystemFolder();
    if (!ensured.ok) return { ok: false, ...ensured };
    const baseDir = ensured.path || getClientsSystemFolder();
    const safe = sanitizeFileName(suggestedName || client.name || "client");
    const defaultPath = path.join(baseDir, withJsonExt(safe));
    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Enregistrer le client",
        defaultPath,
        filters: [{ name: "Client JSON", extensions: ["json"] }],
      }
    );
    if (canceled || !filePath) return { ok: false, canceled: true };
    await fsp.writeFile(filePath, JSON.stringify(client, null, 2), "utf-8");
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle("clients:open", async (event, opts = {}) => {
  try {
    const baseDirFromSys = getClientsSystemFolder();
    const startIn = (opts.startInPath && String(opts.startInPath)) || baseDirFromSys;
    await tryEnsure(startIn);
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Charger un client",
        defaultPath: startIn,
        properties: ["openFile"],
        filters: [
          { name: "Client JSON", extensions: ["json"] },
          { name: "Tous les fichiers", extensions: ["*"] },
        ],
      }
    );
    if (canceled || !filePaths?.length) return { canceled: true };
    const filePath = filePaths[0];
    const text = await fsp.readFile(filePath, "utf8");
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { ok: true, path: filePath, name: path.basename(filePath), data, text };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

/** ───────── Invoices: Save / Open (with ledger updates) ───────── **/
ipcMain.handle("save-invoice-json", async (event, payload = {}) => {
  try {
    const incoming =
      payload && payload.data && typeof payload.data === "object"
        ? payload.data
        : payload;

    const meta = incoming?.meta || payload?.meta || {};
    const typeLabel = docTypeLabelFromValue(meta.docType);

    // build default filename
    const numberRaw  = (meta.number ?? "").toString().trim();
    const numberPart = numberRaw ? sanitizeFileName(numberRaw) : "";
    const datePart   = sanitizeFileName(meta.date || todayStr());
    const suggestedBase = numberPart
      ? `${typeLabel} ${numberPart} - ${datePart}`
      : `${typeLabel} ${datePart}`;
    const providedName = (payload?.filename || "").toString().trim().replace(/\.json$/i, "");
    const base = providedName || suggestedBase;
    const fileName = withJsonExt(sanitizeFileName(base));

    const defaultDir = pfPath("Factures");
    await tryEnsure(defaultDir);
    const defaultPath = path.join(defaultDir, fileName);

    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Enregistrer",
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }],
      }
    );
    if (canceled || !filePath) return { ok: false, canceled: true };

    const finalPath = filePath.toLowerCase().endsWith(".json")
      ? filePath
      : `${filePath}.json`;

    fs.writeFileSync(finalPath, JSON.stringify(incoming, null, 2), "utf-8");

    // Update ledger (single source of truth for numbers & recent)
    const ledger = readLedger();
    const entry = {
      path: finalPath,
      name: path.basename(finalPath),
      number: meta.number || "",
      docType: String(meta.docType || "facture").toLowerCase(),
      date: meta.date || todayStr(),
      monthKey: yyyymm(meta.date || todayStr()),
      savedAt: Date.now(),
    };
    // upsert by path
    ledger.entries = ledger.entries.filter(e => e.path !== finalPath);
    ledger.entries.push(entry);
    if (entry.docType === "facture") {
      const n = onlyDigits(entry.number);
      const curr = ledger.counters[entry.monthKey] || 0;
      ledger.counters[entry.monthKey] = Math.max(curr, n);
    }
    writeLedger(ledger);

    return { ok: true, path: finalPath, name: path.basename(finalPath) };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle("open-invoice-json", async (event) => {
  const defaultDir = pfPath("Factures");
  await tryEnsure(defaultDir);
  const { canceled, filePaths } = await dialog.showOpenDialog(
    BrowserWindow.fromWebContents(event.sender),
    {
      title: "Ouvrir",
      defaultPath: defaultDir,
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    }
  );
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

/** ───────── Logo picker ───────── **/
ipcMain.handle("SoukElMeuble:pickLogo", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Choisir un logo",
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "ico", "svg"],
      },
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

/** ───────── PDF Export (default PF\FacturaMax\Factures\pdf) ───────── **/
ipcMain.handle("SoukElMeuble:exportPDFFromHTML", async (event, payload) => {
  const { html = "", css = "", meta = {} } = payload || {};
  try {
    const pdfBuffer = await renderToPdfBuffer(html, css);
    const fileName = withPdfExt(
      sanitizeFileName(
        meta.filename ||
          `${docTypeLabelFromValue(meta.docType)} - ${sanitizeFileName(
            meta.number || todayStr()
          )}`
      )
    );
    const defaultDir = path.join(pfPath("Factures"), "pdf");
    await tryEnsure(defaultDir);
    const defaultPath = path.join(defaultDir, fileName);
    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Exporter PDF",
        defaultPath,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      }
    );
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, pdfBuffer);
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (err) {
    console.error("exportPDFFromHTML error:", err);
    dialog.showErrorBox("Erreur PDF", String(err?.message || err));
    return { ok: false, error: String(err?.message || err) };
  }
});

/** ───────── Shell helpers ───────── **/
ipcMain.handle("SoukElMeuble:openPath", async (_evt, absPath) => {
  try {
    return (await shell.openPath(absPath)) === "";
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

// Generic delete to OS trash (used by renderer when needed)
ipcMain.handle("SoukElMeuble:deletePath", async (_evt, absPath) => {
  try {
    if (!absPath || typeof absPath !== "string") {
      return { ok: false, error: "Chemin invalide." };
    }
    if (shell.trashItem) {
      await shell.trashItem(absPath);
      return { ok: true, trashed: true };
    }
    await fsp.unlink(absPath);
    return { ok: true, trashed: false };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

/** ───────── Articles (same as before) ───────── **/
function ensureSafeName(s = "article") {
  return (
    String(s)
      .trim()
      .replace(/[\/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .substring(0, 60) || "article"
  );
}
function getArticlesDir() {
  return pfPath("Articles");
}
async function ensureArticlesDir() {
  const pfDir = pfPath("Articles");
  try {
    await fsp.mkdir(pfDir, { recursive: true });
    if (await canWriteTo(pfDir)) return pfDir;
  } catch {}
  const docsDir = path.join(app.getPath("documents"), "FacturaMax", "Articles");
  await fsp.mkdir(docsDir, { recursive: true });
  return docsDir;
}
const PREFS_FILE = path.join(app.getPath("userData"), "prefs.json");
function readPrefs() {
  try {
    return JSON.parse(fs.readFileSync(PREFS_FILE, "utf-8"));
  } catch {
    return {};
  }
}
function writePrefs(p) {
  try {
    fs.writeFileSync(PREFS_FILE, JSON.stringify(p, null, 2), "utf-8");
  } catch {}
}
let prefs = readPrefs();
function getLastArticleDir() {
  const d = prefs.lastArticleDir;
  return d && fs.existsSync(d) ? d : null;
}
function setLastArticleDir(dir) {
  if (!dir) return;
  prefs.lastArticleDir = dir;
  writePrefs(prefs);
}

ipcMain.handle("articles:save", async (event, payload = {}) => {
  try {
    const { article = {}, suggestedName = "article" } = payload || {};
    const safe = ensureSafeName(
      suggestedName || article.ref || article.product || "article"
    );
    const fileName = withJsonExt(safe);
    const defaultDir = getLastArticleDir() || getArticlesDir();
    await tryEnsure(defaultDir);
    const defaultPath = path.join(defaultDir, `${fileName}`);
    const { canceled, filePath } = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Enregistrer l’article",
        defaultPath,
        filters: [{ name: "Articles JSON", extensions: ["json"] }],
      }
    );
    if (canceled || !filePath) return { ok: false, canceled: true };
    const finalPath = filePath.toLowerCase().endsWith(".json")
      ? filePath
      : `${filePath}.json`;
    await fsp.writeFile(finalPath, JSON.stringify(article, null, 2), "utf-8");
    setLastArticleDir(path.dirname(finalPath));
    return { ok: true, path: finalPath, name: path.basename(finalPath) };
  } catch (e) {
    console.error("[articles:save] error:", e);
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle("articles:saveAuto", async (_evt, payload = {}) => {
  try {
    const { article = {}, suggestedName = "article" } = payload || {};
    const dir = await ensureArticlesDir();
    const safe = ensureSafeName(
      suggestedName || article.ref || article.product || "article"
    );
    const filePath = ensureUniquePath(path.join(dir, `${safe}.article.json`));
    await fsp.writeFile(filePath, JSON.stringify(article, null, 2), "utf-8");
    return { ok: true, path: filePath, name: path.basename(filePath) };
  } catch (e) {
    console.error("[articles:saveAuto] error:", e);
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle("articles:open", async (event) => {
  try {
    const dir = await ensureArticlesDir();
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Charger un article",
        defaultPath: dir,
        properties: ["openFile"],
        filters: [
          { name: "Articles", extensions: ["json"] },
          { name: "Tous les fichiers", extensions: ["*"] },
        ],
      }
    );
    if (canceled || !filePaths?.[0]) return null;
    const txt = await fsp.readFile(filePaths[0], "utf-8");
    const data = JSON.parse(txt);
    return {
      ref: data.ref ?? "",
      product: data.product ?? "",
      desc: data.desc ?? "",
      qty: Number(data.qty ?? 1),
      price: Number(data.price ?? 0),
      tva: Number(data.tva ?? 19),
      discount: Number(data.discount ?? 0),
    };
  } catch (e) {
    console.error("[articles:open] error:", e);
    throw e;
  }
});
ipcMain.handle("articles:list", async () => {
  try {
    const dir = await ensureArticlesDir();
    const files = await fsp.readdir(dir);
    return files
      .filter((f) => f.toLowerCase().endsWith(".json"))
      .map((f) => path.join(dir, f));
  } catch (e) {
    console.error("[articles:list] error:", e);
    return [];
  }
});
