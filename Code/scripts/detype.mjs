#!/usr/bin/env node
/**
 * Strip TypeScript types from a package src tree via Babel.
 * Usage: node scripts/detype.mjs <packageDir>
 * Example: node scripts/detype.mjs shared
 */
import { transformFileAsync } from '@babel/core';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const codeRoot = path.resolve(__dirname, '..');
const babelConfig = path.join(codeRoot, 'babel.detype.cjs');

const packageArg = process.argv[2];
if (!packageArg) {
  console.error('Usage: node scripts/detype.mjs <packageDir>');
  process.exit(1);
}

const packageDir = path.resolve(codeRoot, packageArg);
const srcDir = path.join(packageDir, 'src');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.tsx?$/.test(ent.name) && !ent.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function outPathFor(file) {
  if (file.endsWith('.tsx')) return file.slice(0, -4) + '.jsx';
  if (file.endsWith('.ts')) return file.slice(0, -3) + '.js';
  return file;
}

async function main() {
  const files = await walk(srcDir);
  console.log(`Detyping ${files.length} files in ${path.relative(codeRoot, srcDir)}…`);

  for (const file of files) {
    const result = await transformFileAsync(file, {
      configFile: babelConfig,
      babelrc: false,
      filename: file,
      sourceMaps: false,
    });
    if (!result?.code && result?.code !== '') {
      console.warn(`No output for ${file}, skipping`);
      continue;
    }
    const out = outPathFor(file);
    await fs.writeFile(out, result.code, 'utf8');
    if (out !== file) {
      await fs.unlink(file);
    }
    console.log(`  ${path.relative(packageDir, file)} → ${path.relative(packageDir, out)}`);
  }

  // Drop ambient-only .d.ts under src (e.g. vite-env.d.ts)
  async function walkDts(dir) {
    let list = [];
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) list = list.concat(await walkDts(full));
      else if (ent.name.endsWith('.d.ts')) list.push(full);
    }
    return list;
  }
  for (const dts of await walkDts(srcDir)) {
    await fs.unlink(dts);
    console.log(`  removed ${path.relative(packageDir, dts)}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
