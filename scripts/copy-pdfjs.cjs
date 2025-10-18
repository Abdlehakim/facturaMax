// scripts/copy-pdfjs.cjs
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'node_modules', 'pdfjs-dist', 'build');

if (!fs.existsSync(buildDir)) {
  throw new Error('pdfjs-dist not installed. Run: npm i pdfjs-dist');
}

const pick = (names) => {
  for (const n of names) {
    const p = path.join(buildDir, n);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
};

// Try variants that differ across versions
const libSrc = pick(['pdf.min.js', 'pdf.js', 'pdf.min.mjs', 'pdf.mjs']);
const workerSrc = pick(['pdf.worker.min.js', 'pdf.worker.js', 'pdf.worker.min.mjs', 'pdf.worker.mjs']);

if (!libSrc || !workerSrc) {
  throw new Error(`Could not find pdf.js build files in ${buildDir}`);
}

const outDir = path.join(root, 'site', 'lib', 'pdfs');
fs.mkdirSync(outDir, { recursive: true });

const libOut = path.join(outDir, path.basename(libSrc).replace('.mjs', '.js'));
const workerOut = path.join(outDir, path.basename(workerSrc).replace('.mjs', '.js'));

fs.copyFileSync(libSrc, libOut);
fs.copyFileSync(workerSrc, workerOut);

console.log('Copied:');
console.log(`- ${path.basename(libSrc)}    -> ${path.relative(root, libOut)}`);
console.log(`- ${path.basename(workerSrc)} -> ${path.relative(root, workerOut)}`);
