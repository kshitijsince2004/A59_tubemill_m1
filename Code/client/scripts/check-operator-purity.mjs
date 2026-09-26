/**
 * Fail the operator APK build if management / admin surface strings leak into the bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, '../dist-operator');

const FORBIDDEN = [
  '/admin/integrations',
  '/admin/users',
  '/admin/master-data',
  '/admin/validation-rules',
  '/plant/live',
  '/plant/dpr-export',
  'MachineHeadDashboard',
  'PlantHeadDashboard',
  'IntegrationsAdmin',
  'MasterDataAdmin',
  'ValidationRulesAdmin',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(js|css|html|map)$/i.test(name)) files.push(p);
  }
  return files;
}

if (!fs.existsSync(dist)) {
  console.error(`[check:operator-purity] missing ${dist} — run build:operator first`);
  process.exit(1);
}

const hits = [];
for (const file of walk(dist)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) {
      hits.push({ file: path.relative(dist, file), needle });
    }
  }
}

if (hits.length) {
  console.error('[check:operator-purity] excluded surface found in operator bundle:');
  for (const h of hits) console.error(`  ${h.needle} in ${h.file}`);
  process.exit(1);
}

console.log('[check:operator-purity] ok — no excluded management surface in dist-operator');
