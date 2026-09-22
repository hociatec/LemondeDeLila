import { Injectable, Logger } from '@nestjs/common';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AdminMaintenanceOwnership } from './admin-maintenance-ownership';
import * as http from 'node:http';
import { getProcessEnvironment } from '../../../../platform/config/public-api';
import { parseStrictInteger } from '../../../../shared/utils/public-api';
import type {
  AdminMaintenanceRuntimePort,
  MaintenanceCommandResult,
  MaintenanceSystemctlShow,
} from '../../application/ports/admin-maintenance-runtime.port';

@Injectable()
export class AdminMaintenanceRuntimeService implements AdminMaintenanceRuntimePort {
  private static readonly MAX_HTTP_BODY_BYTES = 1 * 1024 * 1024;
  private static readonly MAX_SYSTEMCTL_OUTPUT_BYTES = 256 * 1024;
  private readonly logger = new Logger(AdminMaintenanceRuntimeService.name);

  constructor(
    private readonly ownership: AdminMaintenanceOwnership = new AdminMaintenanceOwnership(),
  ) {}

  runCommand(
    argv: string[],
    opts?: { cwd?: string; timeoutMs?: number },
  ): MaintenanceCommandResult {
    const [cmd, ...args] = argv;
    if (typeof cmd !== 'string' || !cmd.trim()) {
      return {
        status: 1,
        stdout: '',
        stderr: '',
        error: 'Commande de maintenance absente',
      };
    }
    const timeoutMs =
      typeof opts?.timeoutMs === 'number' &&
      Number.isSafeInteger(opts.timeoutMs) &&
      opts.timeoutMs >= 1 &&
      opts.timeoutMs <= 10 * 60 * 1000
        ? opts.timeoutMs
        : 60 * 1000;
    const result = spawnSync(cmd, args, {
      encoding: 'utf8',
      env: getProcessEnvironment(),
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      cwd: opts?.cwd,
      timeout: timeoutMs,
    });

    // A timeout/signal can leave subprocesses running after the launcher dies.
    // Keep durable ownership for coordinated recovery instead of unlocking.
    if (result.error || result.signal || result.status === null) {
      const owner = this.ownership.current();
      if (owner) owner.detached = true;
    }

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
    const [cmd, ...args] = argv;
    if (typeof cmd !== 'string' || !cmd.trim()) return;
    const delayMs =
      typeof opts?.delayMs === 'number' &&
      Number.isSafeInteger(opts.delayMs) &&
      opts.delayMs >= 0 &&
      opts.delayMs <= 10 * 60 * 1000
        ? opts.delayMs
        : 0;
    const owner = this.ownership.current();
    if (!owner) throw new Error('Durable maintenance ownership is required');
    const compiled = join(__dirname, 'admin-maintenance-child.js');
    const launch = existsSync(compiled)
      ? [compiled]
      : [
          '-r',
          require.resolve('ts-node/register'),
          join(__dirname, 'admin-maintenance-child.ts'),
        ];
    const child = spawn(
      process.execPath,
      [
        ...launch,
        JSON.stringify({
          token: owner.token,
          argv: [cmd, ...args],
          cwd: opts?.cwd,
          delayMs,
        }),
      ],
      {
        env: getProcessEnvironment(),
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      },
    );
    owner.detached = true;
    child.once('error', () =>
      this.logger.error('admin.maintenance.spawn_failed'),
    );
    child.unref();
  }

  async httpGet(
    url: string,
    timeoutMs: number,
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve) => {
      const safeTimeoutMs =
        Number.isSafeInteger(timeoutMs) &&
        timeoutMs >= 1 &&
        timeoutMs <= 120_000
          ? timeoutMs
          : 10_000;
      let settled = false;
      const finish = (result: { statusCode: number; body: string }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try {
        const req = http.get(url, (res) => {
          const statusCode =
            typeof res.statusCode === 'number' ? res.statusCode : 0;
          res.setEncoding('utf8');
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
            if (
              Buffer.byteLength(body, 'utf8') >
              AdminMaintenanceRuntimeService.MAX_HTTP_BODY_BYTES
            ) {
              res.destroy();
              finish({ statusCode: 0, body: '' });
            }
          });
          res.on('end', () => finish({ statusCode, body }));
        });
        req.on('error', (error) => {
          this.logger.warn(
            JSON.stringify({
              event: 'admin.maintenance.http_probe_failed',
              message: error.message,
            }),
          );
          finish({ statusCode: 0, body: '' });
        });
        req.setTimeout(safeTimeoutMs, () => {
          try {
            req.destroy();
          } catch (error) {
            this.logger.warn(
              JSON.stringify({
                event: 'admin.maintenance.http_probe_destroy_failed',
                message: error instanceof Error ? error.message : String(error),
              }),
            );
          }
          finish({ statusCode: 0, body: '' });
        });
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'admin.maintenance.http_probe_setup_failed',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        finish({ statusCode: 0, body: '' });
      }
    });
  }

  parseSystemctlShow(raw: string): MaintenanceSystemctlShow {
    const lines = String(raw || '')
      .slice(0, AdminMaintenanceRuntimeService.MAX_SYSTEMCTL_OUTPUT_BYTES)
      .split(/\r?\n/)
      .slice(0, 2_000)
      .map((line) => line.trim())
      .filter(Boolean);

    const out: MaintenanceSystemctlShow = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx <= 0) {
        continue;
      }
      const key = line.slice(0, idx).trim();
      if (key.length > 128) continue;
      const value = line
        .slice(idx + 1)
        .trim()
        .slice(0, 4096);
      out[key] = value;
    }
    return out;
  }

  parseTail(rawTail?: string): number {
    const value = parseStrictInteger(rawTail, { min: 1 });
    if (value === null) {
      return 200;
    }
    return Math.max(1, Math.min(2000, value));
  }

  shQuote(value: string): string {
    const raw = String(value ?? '');
    return `'${raw.replaceAll("'", `'\\''`)}'`;
  }
}
