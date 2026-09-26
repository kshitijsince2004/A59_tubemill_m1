/**
 * Capacitor requires webDir/index.html. Vite emits operator.html from operator.html entry.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist-operator');
const src = path.join(dist, 'operator.html');
const dest = path.join(dist, 'index.html');

if (!fs.existsSync(src)) {
  console.error('[operator-postbuild] missing operator.html in dist-operator');
  process.exit(1);
}

let html = fs.readFileSync(src, 'utf8');
// Absolute asset paths break under Capacitor file/https scheme — keep relative.
html = html.replace(/(href|src)="\/assets\//g, '$1="./assets/');
fs.writeFileSync(dest, html);
console.log('[operator-postbuild] wrote dist-operator/index.html');
