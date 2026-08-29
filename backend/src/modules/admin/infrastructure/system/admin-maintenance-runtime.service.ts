import { Injectable } from '@nestjs/common';
import { spawn, spawnSync } from 'node:child_process';
import * as http from 'node:http';
import { getProcessEnvironment } from '../../../../platform/config/public-api';
import type {
  AdminMaintenanceRuntimePort,
  MaintenanceCommandResult,
  MaintenanceSystemctlShow,
} from '../../application/ports/admin-maintenance-runtime.port';

@Injectable()
export class AdminMaintenanceRuntimeService implements AdminMaintenanceRuntimePort {
  runCommand(
    argv: string[],
    opts?: { cwd?: string; timeoutMs?: number },
  ): MaintenanceCommandResult {
    const [cmd, ...args] = argv;
    const result = spawnSync(cmd, args, {
      encoding: 'utf8',
      env: getProcessEnvironment(),
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      cwd: opts?.cwd,
      timeout: opts?.timeoutMs,
    });

    return {
      status: typeof result.status === 'number' ? result.status : 1,
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
      error: result.error ? String(result.error.message || result.error) : null,
    };
  }

  spawnDetached(
    argv: string[],
    opts?: { cwd?: string; delayMs?: number },
  ): void {
    const delayMs = typeof opts?.delayMs === 'number' ? opts.delayMs : 0;
    setTimeout(
      () => {
        try {
          const [cmd, ...args] = argv;
          const child = spawn(cmd, args, {
            cwd: opts?.cwd,
            env: getProcessEnvironment(),
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
          });
          child.unref();
        } catch {
          // best effort
        }
      },
      Math.max(0, delayMs),
    );
  }

  async httpGet(
    url: string,
    timeoutMs: number,
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve) => {
      try {
        const req = http.get(url, (res) => {
          const statusCode =
            typeof res.statusCode === 'number' ? res.statusCode : 0;
          res.setEncoding('utf8');
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode, body }));
        });
        req.on('error', () => resolve({ statusCode: 0, body: '' }));
        req.setTimeout(timeoutMs, () => {
          try {
            req.destroy();
          } catch {
            /* ignore */
          }
          resolve({ statusCode: 0, body: '' });
        });
      } catch {
        resolve({ statusCode: 0, body: '' });
      }
    });
  }

  parseSystemctlShow(raw: string): MaintenanceSystemctlShow {
    const lines = String(raw || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const out: MaintenanceSystemctlShow = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx <= 0) {
        continue;
      }
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      out[key] = value;
    }
    return out;
  }

  parseTail(rawTail?: string): number {
    const value = Number.parseInt(String(rawTail || ''), 10);
    if (!Number.isFinite(value) || value <= 0) {
      return 200;
    }
    return Math.max(1, Math.min(2000, value));
  }

  shQuote(value: string): string {
    const raw = String(value ?? '');
    return `'${raw.replaceAll("'", `'\\''`)}'`;
  }
}
