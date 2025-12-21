import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(process.cwd(), '..', 'log');
const LOG_PATH = path.join(LOG_DIR, 'damenature.log');

export function dameNatureLog(
  label: string,
  payload: Record<string, unknown>,
): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
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
    fs.appendFileSync(LOG_PATH, line + '\n', { encoding: 'utf-8' });
  } catch {
    // ignore logging failures
  }
}
