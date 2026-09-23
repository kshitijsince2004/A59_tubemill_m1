import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { initSuperTokens, getSuperTokensMiddleware, getSuperTokensErrorHandler } from './config/authConfig';
import tubeMillRoutes from './routes/tubeMillRoutes';
import furnaceRoutes from './routes/furnaceRoutes';
import stpRoutes from './routes/stpRoutes';
import drawBenchRoutes from './routes/drawBenchRoutes';
import swageRoutes from './routes/swageRoutes';
import genealogyRoutes from './routes/genealogyRoutes';
import erpRoutes from './routes/erpRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import mhReviewRoutes from './routes/mhReviewRoutes';
import reportRoutes from './routes/reportRoutes';
import auditRoutes from './routes/auditRoutes';
import plantExportRoutes from './routes/plantExportRoutes';
import masterDataRoutes from './routes/masterDataRoutes';
import validationRulesRoutes from './routes/validationRulesRoutes';
import qualityRoutes from './routes/qualityRoutes';
import machineCrewRoutes from './routes/machineCrewRoutes';






export function createApp(options = {}) {
  const { serveClient = false } = options;
  const app = express();

  const stEnabled = initSuperTokens();

  if (config.corsOrigin === '*') {
    app.use(
      cors({
        origin: true,
        allowedHeaders: [
        'content-type',
        'authorization',
        'idempotency-key',
        'x-app-role',
        'x-demo-role',
        'x-service-token',
        'st-auth-mode',
        'fdi-version',
        'rid'],

        exposedHeaders: [
        'front-token',
        'st-access-token',
        'st-refresh-token',
        'anti-csrf',
        'id-refresh-token'],

        credentials: true
      })
    );
  } else if (config.corsOrigin && config.corsOrigin !== 'same-origin') {
    app.use(
      cors({
        origin: config.corsOrigin.split(',').map((s) => s.trim()),
        allowedHeaders: [
        'content-type',
        'authorization',
        'idempotency-key',
        'x-app-role',
        'x-demo-role',
        'x-service-token',
        'st-auth-mode',
        'fdi-version',
        'rid'],

        exposedHeaders: [
        'front-token',
        'st-access-token',
        'st-refresh-token',
        'anti-csrf',
        'id-refresh-token'],

        credentials: true
      })
    );
  }

  app.use(express.json());

  if (stEnabled) {
    app.use(getSuperTokensMiddleware());
  }

  app.use(authRoutes);
  app.use('/api', authRoutes);
  app.use(userRoutes);
  app.use('/api', userRoutes);

  // Dev (Vite proxy strips /api) and prod/Netlify (client calls /api/…)
  const mounts = [
  tubeMillRoutes,
  furnaceRoutes,
  stpRoutes,
  drawBenchRoutes,
  swageRoutes,
  genealogyRoutes,
  erpRoutes,
  mhReviewRoutes,
  reportRoutes,
  auditRoutes,
  plantExportRoutes,
  qualityRoutes,
  machineCrewRoutes,
  masterDataRoutes,
  validationRulesRoutes];

  for (const r of mounts) {
    app.use(r);
    app.use('/api', r);
  }

  if (stEnabled) {
    app.use(getSuperTokensErrorHandler());
  }

  if (serveClient) {
    const clientDist = path.resolve(process.cwd(), 'client/dist');
    const altDist = path.resolve(process.cwd(), '../client/dist');
    const dist = fs.existsSync(clientDist) ? clientDist : altDist;
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
      app.get('*', (req, res) => {
        if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/users') ||
        req.path.startsWith('/machines') ||
        req.path.startsWith('/tubemill') ||
        req.path.startsWith('/furnace') ||
        req.path.startsWith('/stp') ||
        req.path.startsWith('/drawbench') ||
        req.path.startsWith('/swage') ||
        req.path.startsWith('/genealogy') ||
        req.path.startsWith('/stoppages') ||
        req.path.startsWith('/erp') ||
        req.path.startsWith('/reports') ||
        req.path.startsWith('/audit') ||
        req.path.startsWith('/plant') ||
        req.path.startsWith('/quality') ||
        req.path.startsWith('/machine-head') ||
        req.path.startsWith('/master-data') ||
        req.path.startsWith('/validation-rules') ||
        req.path.startsWith('/internal') ||
        req.path === '/health')
        {
          res.status(404).json({ data: null, errors: [{ message: 'Not found' }] });
          return;
        }
        res.sendFile(path.join(dist, 'index.html'));
      });
    }
  }

  return app;
}