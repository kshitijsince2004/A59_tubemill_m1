import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config, assertCollectorModeSupported, assertProductionSecrets, assertBcAdapterSupported } from './config';
import tubeMillRoutes from './routes/tubeMillRoutes';
import { registerCollectorConsumers } from './services/CollectorIngestService';
import { startCollectorLoop } from './collector/CollectorRunner';

try {
  assertProductionSecrets();
  assertCollectorModeSupported();
  assertBcAdapterSupported();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

registerCollectorConsumers();
startCollectorLoop();

const app = express();

if (config.corsOrigin === '*' ) {
  app.use(cors());
} else if (config.corsOrigin && config.corsOrigin !== 'same-origin') {
  app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()) }));
}

app.use(express.json());
// Dev (Vite proxy strips /api) and prod (client calls /api/…)
app.use(tubeMillRoutes);
app.use('/api', tubeMillRoutes);

const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/tubemill') ||
      req.path.startsWith('/internal') ||
      req.path === '/health'
    ) {
      res.status(404).json({ data: null, errors: [{ message: 'Not found' }] });
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(config.port, () => {
  console.log(`A-59 Tubemill API listening on http://localhost:${config.port}`);
  console.log(`Auth mode: ${config.authMode}; Collector: ${config.collectorMode}`);
});
