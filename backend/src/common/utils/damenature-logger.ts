import * as fs from 'fs';
import * as path from 'path';

const LOG_PATH = path.resolve(process.cwd(), 'damenature.log');

export function dameNatureLog(label: string, payload: Record<string, unknown>): void {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      label,
      ...payload,
    });
    fs.appendFileSync(LOG_PATH, line + '\n', { encoding: 'utf-8' });
  } catch {
    // ignore logging failures
  }
}
