/**
 * Validate --chart-* palette: distinct hues + contrast vs light background.
 * Usage: node scripts/validate_palette.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '../src/styles.css');
const css = fs.readFileSync(cssPath, 'utf8');

function parseHex(hex) {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function relLuminance({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function hue({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  switch (max) {
    case rn:
      h = ((gn - bn) / d) % 6;
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

const vars = {};
for (const m of css.matchAll(/--chart-([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
  vars[m[1]] = m[2].trim();
}

const seriesKeys = ['1', '2', '3', '4', '5'];
const missing = seriesKeys.filter((k) => !vars[k]);
if (missing.length) {
  console.error('FAIL missing --chart-* series:', missing.join(', '));
  process.exit(1);
}

const bg = parseHex('#ffffff');
const series = seriesKeys.map((k) => ({ key: k, hex: vars[k], rgb: parseHex(vars[k]) }));

let failed = 0;
for (const s of series) {
  if (!/^#[0-9a-fA-F]{3,8}$/.test(s.hex)) {
    console.error(`FAIL --chart-${s.key} not a hex color: ${s.hex}`);
    failed += 1;
    continue;
  }
  const c = contrast(s.rgb, bg);
  if (c < 3) {
    console.error(`FAIL --chart-${s.key} contrast vs white ${c.toFixed(2)} < 3`);
    failed += 1;
  } else {
    console.log(`PASS --chart-${s.key} contrast ${c.toFixed(2)}`);
  }
}

for (let i = 0; i < series.length; i++) {
  for (let j = i + 1; j < series.length; j++) {
    const dh = Math.abs(hue(series[i].rgb) - hue(series[j].rgb));
    const hueDelta = Math.min(dh, 360 - dh);
    if (hueDelta < 12) {
      console.error(
        `FAIL --chart-${series[i].key} vs --chart-${series[j].key} hue delta ${hueDelta.toFixed(1)}° < 12°`
      );
      failed += 1;
    }
  }
}

const reserved = ['out', 'target'];
for (const k of reserved) {
  if (!vars[k]) {
    console.error(`FAIL missing reserved --chart-${k}`);
    failed += 1;
  } else {
    console.log(`PASS reserved --chart-${k}=${vars[k]}`);
  }
}

if (failed) {
  console.error(`${failed} palette check(s) failed`);
  process.exit(1);
}
console.log('validate_palette OK');
