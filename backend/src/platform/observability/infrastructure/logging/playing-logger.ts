import * as fs from 'fs';
import * as path from 'path';

export function playingLog(
  label: string,
  payload: Record<string, unknown>,
): void {
  try {
    if (typeof label !== 'string' || !label || label.length > 128) return;
    if (
      !payload ||
      typeof payload !== 'object' ||
      Object.keys(payload).length > 128
    )
      return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      label,
      event: label,
      roomId: null,
      gameType: null,
      userId: null,
      type: null,
      ...payload,
    });
    if (Buffer.byteLength(line, 'utf8') > 256 * 1024) return;
    fs.appendFileSync(resolveLogPath(), line + '\n', { encoding: 'utf-8' });
  } catch {
    /* ignore logging failures */
  }
}

function resolveLogPath(): string {
  const cwd = process.cwd();
  // Priorite au dossier racine "log" (a cote de backend), sinon fallback sur backend/log.
  const rootLog = path.resolve(cwd, '..', 'log');
  const backendLog = path.resolve(cwd, 'log');
  const targetDir =
    fs.existsSync(rootLog) || ensureDir(rootLog)
      ? rootLog
      : ensureDir(backendLog)
        ? backendLog
        : backendLog;
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
