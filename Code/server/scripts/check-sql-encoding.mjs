#!/usr/bin/env node
/**
 * Fail if any SQL under Netlify/server migration trees has a UTF-8 BOM or
 * unexpected binary nulls. Windows PowerShell `Set-Content -Encoding utf8`
 * writes a BOM that PostgreSQL rejects as: syntax error at or near "".
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dirs = [
  path.join(root, 'netlify/database/migrations'),
  path.join(root, 'netlify/database/sql'),
  path.join(root, 'server/migrations'),
];

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const failures = [];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const file = path.join(dir, name);
    const buf = fs.readFileSync(file);
    if (buf.length >= 3 && buf.subarray(0, 3).equals(BOM)) {
      failures.push(`${path.relative(root, file)}: UTF-8 BOM (EF BB BF)`);
    }
    if (buf.includes(0)) {
      failures.push(`${path.relative(root, file)}: contains NUL byte`);
    }
  }
}

if (failures.length) {
  console.error('SQL encoding check failed:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\nResave as UTF-8 without BOM (not "UTF-8 with BOM"). On Windows PowerShell use:\n' +
      "  [IO.File]::WriteAllText(path, content, New-Object Text.UTF8Encoding($false))"
  );
  process.exit(1);
}

console.log('SQL encoding check OK (no BOM / NUL in migration trees).');
process.exit(0);
