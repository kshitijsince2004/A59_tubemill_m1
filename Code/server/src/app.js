import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { logger } from './lib/logger';
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
import crewRoutes from './routes/crewRoutes';
import machineHandoverRoutes from './routes/machineHandoverRoutes';
import traceabilityRoutes from './routes/traceabilityRoutes';
import operatorRoutes from './routes/operatorRoutes';
import deviceRoutes from './routes/deviceRoutes';

const CORS_ALLOWED_HEADERS = [
  'content-type',
  'authorization',
  'idempotency-key',
  'x-app-role',
  'x-demo-role',
  'x-service-token',
  'x-override-token',
  'x-request-id',
  'x-device-id',
  'x-app-version',
  'st-auth-mode',
  'fdi-version',
  'rid',
];

/** Capacitor WebView origins — required when the operator APK talks to the plant API. */
const CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost'];

function resolveCorsOrigins(raw) {
  const listed = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set(listed);
  for (const o of CAPACITOR_ORIGINS) set.add(o);
  return [...set];
}

const CORS_EXPOSED_HEADERS = [
  'front-token',
  'st-access-token',
  'st-refresh-token',
  'anti-csrf',
  'id-refresh-token',
  'x-request-id',
];

export function createApp(options = {}) {
  const { serveClient = false } = options;
  const app = express();

  const stEnabled = initSuperTokens();

  if (config.corsOrigin === '*') {
    app.use(
      cors({
        origin: true,
        allowedHeaders: CORS_ALLOWED_HEADERS,
        exposedHeaders: CORS_EXPOSED_HEADERS,
        credentials: true,
      })
    );
  } else if (config.corsOrigin && config.corsOrigin !== 'same-origin') {
    app.use(
      cors({
        origin: resolveCorsOrigins(config.corsOrigin),
        allowedHeaders: CORS_ALLOWED_HEADERS,
        exposedHeaders: CORS_EXPOSED_HEADERS,
        credentials: true,
      })
    );
  }

  app.use(express.json());

  // Observability: request id + device id + structured access log (pino)
  app.use((req, res, next) => {
    const incoming = req.header('x-request-id');
    const requestId =
      incoming && String(incoming).trim() ? String(incoming).trim() : crypto.randomUUID();
    const deviceIdRaw = req.header('x-device-id');
    const deviceId =
      deviceIdRaw && String(deviceIdRaw).trim() ? String(deviceIdRaw).trim().slice(0, 128) : null;
    req.requestId = requestId;
    req.deviceId = deviceId;
    res.setHeader('x-request-id', requestId);
    const started = Date.now();
    res.on('finish', () => {
      logger.info({
        request_id: requestId,
        device_id: deviceId,
        method: req.method,
        endpoint: req.originalUrl || req.url,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  // IIS / watchdogs often probe /health (not under /api)
  app.get('/health', async (_req, res) => {
    const { buildHealthPayload } = await import('./routes/healthPayload');
    const payload = await buildHealthPayload();
    const code = payload.status === 'fail' ? 503 : 200;
    res.status(code).json({ data: payload, errors: null });
  });

  if (stEnabled) {
    app.use(getSuperTokensMiddleware());
  }

  // Custom auth helpers under /api (client always uses /api). SuperTokens recipe
  // paths live at apiBasePath (/api/auth) via ST middleware above — keep root free.
  app.use('/api', authRoutes);
  app.use('/api', userRoutes);

  // Process / domain routers: /api only (F23). Vite proxy forwards /api intact.
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
    crewRoutes,
    masterDataRoutes,
    validationRulesRoutes,
    traceabilityRoutes,
    operatorRoutes,
    deviceRoutes,
  ];

  for (const r of mounts) {
    app.use('/api', r);
  }

  app.use('/api/machines/handover', machineHandoverRoutes);

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
          req.path === '/health'
        ) {
          res.status(404).json({ data: null, errors: [{ message: 'Unknown API route' }] });
          return;
        }
        res.sendFile(path.join(dist, 'index.html'));
      });
    }
  }

  return app;
}
