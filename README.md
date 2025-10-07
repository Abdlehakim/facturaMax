# Smartwebify Invoice Maker (Windows)

Offline desktop app to create, save (.json), and export PDF invoices — tailored for **Development, Marketing, Graphics, and Design** services.

## Quick Start (Windows)

1. Install Node.js LTS.
2. Open a terminal in this folder and run:
   ```bash
   npm install
   npm start
   ```
   The app window should open.

## Build Unpacked App (for Inno Setup)

```bash
npm run pack:win
```

This creates `dist/win-unpacked/`.

## Create Windows Installer with Inno Setup

1. Install **Inno Setup**.
2. Open `Smartwebify_Invoice_Maker.iss` in Inno Setup Compiler.
3. Click **Build**. You'll get `Smartwebify-Invoice-Maker-Setup.exe`.

*(Optional)* You can also create a portable EXE using:
```bash
npm run dist:portable
```

## Features

- Company & client details with **logo upload** (stored locally on your machine).
- Line items with **Qty, Unit, Price, TVA%, Discount%**, and automatic totals.
- One‑click **templates** for common Smartwebify services.
- **Save/Open** invoices as JSON.
- **Export to PDF** using Electron’s `printToPDF` (A4).
- Clean, printable layout.

## Notes

- Company info & logo are persisted locally via `localStorage` only (no cloud).
- Currency options: **TND, EUR, USD** (can be extended in `index.html`).
- TVA default 19% (edit per line as needed).

---

© Smartwebify

npm run dev:site