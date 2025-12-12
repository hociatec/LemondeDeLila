import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = resolveLogPath();

export function playingLog(label: string, payload: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      label,
      ...payload,
    });
    fs.appendFileSync(LOG_PATH, line + '\n', { encoding: 'utf-8' });
  } catch {
    /* ignore logging failures */
  }
}

function resolveLogPath(): string {
  const cwd = process.cwd();
  // Priorité au dossier racine "log" (à côté de backend), sinon fallback sur backend/log.
  const rootLog = path.resolve(cwd, '..', 'log');
  const backendLog = path.resolve(cwd, 'log');
  const targetDir = fs.existsSync(rootLog) || ensureDir(rootLog) ? rootLog : ensureDir(backendLog) ? backendLog : backendLog;
  return path.join(targetDir, 'playing.log');
}

function ensureDir(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}
