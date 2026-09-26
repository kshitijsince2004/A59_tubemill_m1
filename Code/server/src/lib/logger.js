import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import pino from 'pino';
import { config } from '../config';

const redactionPaths = [
  'pin',
  'password',
  'authorization',
  'headers.authorization',
  'headers.Authorization',
  'req.headers.authorization',
  'serviceToken',
  'apiKey',
  'superTokensApiKey',
  'accessToken',
  'refreshToken',
  'bcClientSecret',
  'SESSION_SECRET',
  'SERVICE_TOKEN',
];

function buildStreams() {
  const streams = [{ stream: process.stdout }];
  const logDir = config.logDir;
  if (logDir) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      const filePath = path.join(logDir, 'zedral-backend.log');
      streams.push({
        stream: pino.destination({ dest: filePath, sync: false, mkdir: true }),
      });
    } catch {
      /* keep stdout only */
    }
  }
  return streams;
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (config.isProduction ? 'info' : 'debug'),
    base: { service: 'zedral-backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: redactionPaths, remove: true },
    formatters: {
      level(label) {
        return { level: label.toUpperCase() };
      },
    },
  },
  pino.multistream(buildStreams()),
);

/**
 * Best-effort Windows Event Log for critical ops events.
 * No-op on non-Windows or when PowerShell eventcreate is unavailable.
 */
export function writeEventLog(entryType, eventId, message) {
  if (process.platform !== 'win32') return;
  const type = entryType === 'Error' || entryType === 'Warning' ? entryType : 'Information';
  const safe = String(message).replace(/"/g, "'").slice(0, 900);
  try {
    spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `try { Write-EventLog -LogName Application -Source Zedral -EntryType ${type} -EventId ${Number(eventId) || 1000} -Message "${safe}" } catch {}`,
      ],
      { detached: true, stdio: 'ignore' },
    ).unref();
  } catch {
    /* ignore */
  }
}

export function childLogger(bindings) {
  return logger.child(bindings);
}
