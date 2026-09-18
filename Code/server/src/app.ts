import express, { type Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import tubeMillRoutes from './routes/tubeMillRoutes';

export type CreateAppOptions = {
  /** Serve client/dist from Express (Docker / local `npm start`). Off for Netlify CDN. */
  serveClient?: boolean;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const { serveClient = false } = options;
  const app = express();

  if (config.corsOrigin === '*') {
    app.use(cors());
  } else if (config.corsOrigin && config.corsOrigin !== 'same-origin') {
    app.use(cors({ origin: config.corsOrigin.split(',').map((s) => s.trim()) }));
  }

  app.use(express.json());
  // Dev (Vite proxy strips /api) and prod/Netlify (client calls /api/…)
  app.use(tubeMillRoutes);
  app.use('/api', tubeMillRoutes);

  if (serveClient) {
    const clientDist = path.resolve(process.cwd(), 'client/dist');
    const altDist = path.resolve(process.cwd(), '../client/dist');
    const dist = fs.existsSync(clientDist) ? clientDist : altDist;
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
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
        res.sendFile(path.join(dist, 'index.html'));
      });
    }
  }

  return app;
}
