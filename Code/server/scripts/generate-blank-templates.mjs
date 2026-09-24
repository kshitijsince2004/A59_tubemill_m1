import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildBlankTemplate } from '../src/export/render/TemplateInjector.js';
import layoutDb03 from '../src/export/layouts/DB-FT-03.v1.json' with { type: 'json' };
import layoutDb08 from '../src/export/layouts/DB-FT-08.v1.json' with { type: 'json' };
import layoutN2 from '../src/export/layouts/N2-GAS-FT-01.v1.json' with { type: 'json' };
import layoutExo from '../src/export/layouts/EXO-GAS-FT-02.v1.json' with { type: 'json' };
import layoutStp from '../src/export/layouts/STP-FT-01A.v1.json' with { type: 'json' };
import layoutStp04 from '../src/export/layouts/STP-FT-04.v1.json' with { type: 'json' };
import layoutStp06 from '../src/export/layouts/STP-06.v1.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '../src/export/templates');

const missing = [
  ['DB-FT-03.xlsx', layoutDb03],
  ['DB-FT-08.xlsx', layoutDb08],
  ['N2-GAS-FT-01.xlsx', layoutN2],
  ['EXO-GAS-FT-02.xlsx', layoutExo],
  ['STP-FT-01A.xlsx', layoutStp],
  ['STP-FT-04.xlsx', layoutStp04],
  ['STP-06.xlsx', layoutStp06],
];

for (const [name, layout] of missing) {
  const file = path.join(dir, name);
  if (fs.existsSync(file)) {
    console.log('skip', name);
    continue;
  }
  const buf = await buildBlankTemplate(layout);
  fs.writeFileSync(file, buf);
  console.log('wrote', name, buf.length);
}
