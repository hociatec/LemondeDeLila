import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { spawnSync } from 'node:child_process';

type SystemctlShow = Record<string, string>;

const DEPLOY_UNIT = process.env.ADMIN_MAINTENANCE_DEPLOY_UNIT || 'lila-backend-deploy.service';
const BACKEND_SERVICE = process.env.ADMIN_MAINTENANCE_BACKEND_SERVICE || 'lila-backend.service';

@Injectable()
export class AdminMaintenanceService {
  startDeploy() {
    const res = this.run(['sudo', '-n', 'systemctl', 'start', '--no-block', DEPLOY_UNIT]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Échec du déclenchement du déploiement',
        details: res,
      });
    }
    return { ok: true, unit: DEPLOY_UNIT };
  }

  getDeployStatus() {
    return this.getUnitStatus(DEPLOY_UNIT);
  }

  getBackendServiceStatus() {
    return this.getUnitStatus(BACKEND_SERVICE);
  }

  getDeployLogs(input: { tail?: string }) {
    const tail = this.parseTail(input.tail);
    const res = this.run([
      'sudo',
      '-n',
      'journalctl',
      '-u',
      DEPLOY_UNIT,
      '--no-pager',
      '-o',
      'short-iso',
      '-n',
      String(tail),
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: 'Impossible de lire les logs du déploiement',
        details: res,
      });
    }
    return { ok: true, unit: DEPLOY_UNIT, tail, logs: res.stdout };
  }

  private getUnitStatus(unit: string) {
    const res = this.run([
      'sudo',
      '-n',
      'systemctl',
      'show',
      unit,
      '--no-pager',
      '--property=Id,ActiveState,SubState,Result,ExecMainStatus,ExecMainCode,ExecMainStartTimestamp,ExecMainExitTimestamp',
    ]);
    if (res.status !== 0) {
      throw new InternalServerErrorException({
        message: `Impossible de lire le status systemd: ${unit}`,
        details: res,
      });
    }
    const props = this.parseSystemctlShow(res.stdout);
    return { ok: true, unit, ...props };
  }

  private parseSystemctlShow(raw: string): SystemctlShow {
    const lines = String(raw || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const out: SystemctlShow = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx <= 0) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      out[key] = val;
    }
    return out;
  }

  private parseTail(rawTail?: string): number {
    const n = Number.parseInt(String(rawTail || ''), 10);
    if (!Number.isFinite(n) || n <= 0) return 200;
    return Math.max(1, Math.min(2000, n));
  }

  private run(argv: string[]) {
    const [cmd, ...args] = argv;
    const result = spawnSync(cmd, args, {
      encoding: 'utf8',
      env: process.env,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      status: typeof result.status === 'number' ? result.status : 1,
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || ''),
      error: result.error ? String(result.error.message || result.error) : null,
    };
  }
}

