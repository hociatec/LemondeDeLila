import { Injectable, Logger } from '@nestjs/common';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AdminMaintenanceOwnership } from './admin-maintenance-ownership';
import * as http from 'node:http';
import { isAbsolute } from 'node:path';
import { getProcessEnvironment } from '../../../../platform/config/public-api';
import { parseStrictInteger } from '../../../../shared/utils/public-api';
import type {
  AdminMaintenanceRuntimePort,
  MaintenanceCommandResult,
  MaintenanceOperation,
  ScheduledMaintenanceOperation,
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

  execute(operation: MaintenanceOperation): MaintenanceCommandResult {
    const {
      argv,
      cwd,
      timeoutMs: requestedTimeout,
    } = this.commandFor(operation);
    const [cmd, ...args] = argv;
    const timeoutMs =
      typeof requestedTimeout === 'number' &&
      Number.isSafeInteger(requestedTimeout) &&
      requestedTimeout >= 1 &&
      requestedTimeout <= 10 * 60 * 1000
        ? requestedTimeout
        : 60 * 1000;
    const result = spawnSync(cmd, args, {
      encoding: 'utf8',
      env: getProcessEnvironment(),
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      cwd,
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
      stdout: this.sanitizeOutput(result.stdout, cwd),
      stderr: this.sanitizeOutput(result.stderr, cwd),
      error: result.error
        ? this.sanitizeOutput(result.error.message || result.error, cwd)
        : null,
    };
  }

  schedule(operation: ScheduledMaintenanceOperation): void {
    this.assertScheduledOperation(operation);
    const delayCandidate = 'delayMs' in operation ? operation.delayMs : 0;
    const delayMs =
      Number.isSafeInteger(delayCandidate) &&
      delayCandidate >= 0 &&
      delayCandidate <= 10 * 60 * 1000
        ? delayCandidate
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
          operation,
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

  async probeLoopback(
    port: number,
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
        if (!Number.isSafeInteger(port) || port < 1 || port > 65_535)
          return finish({ statusCode: 0, body: '' });
        const req = http.get(
          { hostname: '127.0.0.1', port, path: '/health', method: 'GET' },
          (res) => {
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
          },
        );
        req.on('error', (error) => {
          this.logger.warn(
            JSON.stringify({
              event: 'admin.maintenance.http_probe_failed',
              message: this.sanitizeOutput(error.message),
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
                message: this.sanitizeOutput(
                  error instanceof Error ? error.message : String(error),
                ),
              }),
            );
          }
          finish({ statusCode: 0, body: '' });
        });
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'admin.maintenance.http_probe_setup_failed',
            message: this.sanitizeOutput(
              error instanceof Error ? error.message : String(error),
            ),
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

  private commandFor(operation: MaintenanceOperation): {
    argv: string[];
    cwd?: string;
    timeoutMs?: number;
  } {
    switch (operation.kind) {
      case 'build':
        this.assertBackendRoot(operation.cwd);
        return {
          argv: ['npm', 'run', 'build'],
          cwd: operation.cwd,
          timeoutMs: operation.timeoutMs,
        };
      case 'migrate':
        this.assertBackendRoot(operation.cwd);
        return {
          argv: ['npm', 'run', 'migration:run'],
          cwd: operation.cwd,
          timeoutMs: operation.timeoutMs,
        };
      case 'daemon-reload':
        return { argv: ['sudo', '-n', 'systemctl', 'daemon-reload'] };
      case 'unit-status':
        this.assertUnit(operation.unit);
        return {
          argv: [
            'sudo',
            '-n',
            'systemctl',
            'show',
            operation.unit,
            '--no-pager',
            '--property=Id,ActiveState,SubState,Result,ExecMainStatus,ExecMainCode,ExecMainStartTimestamp,ExecMainExitTimestamp',
          ],
        };
      case 'unit-logs':
        this.assertUnit(operation.unit);
        if (
          !Number.isSafeInteger(operation.tail) ||
          operation.tail < 1 ||
          operation.tail > 2_000
        )
          throw new Error('Invalid maintenance log limit');
        return {
          argv: [
            'sudo',
            '-n',
            'journalctl',
            '-u',
            operation.unit,
            '--no-pager',
            '-o',
            'short-iso',
            '-n',
            String(operation.tail),
          ],
        };
    }
  }

  private assertUnit(unit: string): void {
    if (!/^[a-zA-Z0-9@._-]{1,128}$/.test(unit))
      throw new Error('Invalid maintenance unit');
  }

  private assertBackendRoot(cwd: string): void {
    if (typeof cwd !== 'string' || !isAbsolute(cwd))
      throw new Error('Invalid maintenance backend root');
  }

  private assertScheduledOperation(
    operation: ScheduledMaintenanceOperation,
  ): void {
    if (!operation || typeof operation !== 'object')
      throw new Error('Invalid scheduled maintenance operation');
    switch (operation.kind) {
      case 'start-unit':
      case 'restart-unit':
        this.assertUnit(operation.unit);
        return;
      case 'build-and-restart':
        this.assertUnit(operation.unit);
        this.assertBackendRoot(operation.cwd);
        return;
      default:
        throw new Error('Invalid scheduled maintenance operation');
    }
  }

  private sanitizeOutput(value: unknown, cwd?: string): string {
    let output = (
      typeof value === 'string'
        ? value
        : Buffer.isBuffer(value)
          ? value.toString('utf8')
          : value instanceof Error
            ? value.message
            : ''
    ).slice(0, 256 * 1024);
    if (cwd) output = output.replaceAll(cwd, '[backend]');
    return output
      .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
      .replace(
        /(authorization|token|password|secret)\s*[:=]\s*\S+/gi,
        '$1=[redacted]',
      )
      .replace(/(?:\/[A-Za-z0-9._-]+){2,}/g, '[path]');
  }
}
