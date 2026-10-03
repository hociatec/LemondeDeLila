import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { DataSource } from 'typeorm';
import { createMysqlConnectionOptions } from '../../../../platform/database/public-api';
import { getProcessEnvironment } from '../../../../platform/config/public-api';
import type { ScheduledMaintenanceOperation } from '../../application/ports/admin-maintenance-runtime.port';

export type MaintenanceChildCommand = {
  token: string;
  operation: ScheduledMaintenanceOperation;
  delayMs: number;
};

/** Owns the durable row until completion; interruption leaves it locked. */
export async function runMaintenanceChild(
  input: MaintenanceChildCommand,
): Promise<number> {
  if (
    !input ||
    typeof input.token !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(input.token) ||
    !input.operation ||
    !isScheduledOperation(input.operation) ||
    !Number.isSafeInteger(input.delayMs) ||
    input.delayMs < 0 ||
    input.delayMs > 600_000
  )
    throw new Error('Invalid maintenance child command');
  const environment = getProcessEnvironment();
  const database = new DataSource({
    ...createMysqlConnectionOptions((name) => environment[name]),
    entities: [],
    extra: { connectionLimit: 1 },
  });
  await database.initialize();
  try {
    const rows: unknown = await database.query(
      'SELECT owner_token FROM admin_maintenance_locks WHERE lock_name = ? AND owner_token = ?',
      ['global', input.token],
    );
    if (!Array.isArray(rows) || rows.length !== 1)
      throw new Error('Maintenance ownership unavailable');
    // No TTL can replace this owner during the launch delay or the command.
    await new Promise<void>((resolve) => setTimeout(resolve, input.delayMs));
    const run = (command: string, args: string[], cwd?: string) =>
      new Promise<number>((resolve, reject) => {
        let launchError: Error | undefined;
        const child = spawn(command, args, {
          cwd,
          env: environment,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.once('error', (error) => {
          launchError = error;
        });
        // close follows exit/error and guarantees the child has finished.
        child.once('close', (exitCode, signal) => {
          if (launchError)
            reject(new Error('Maintenance command could not start'));
          else if (signal || exitCode === null)
            reject(new Error('Maintenance command interrupted'));
          else resolve(exitCode ?? 1);
        });
      });
    const operation = input.operation;
    let code: number;
    switch (operation.kind) {
      case 'start-unit':
        assertUnit(operation.unit);
        code = await run('sudo', ['-n', 'systemctl', 'start', operation.unit]);
        break;
      case 'restart-unit':
        assertUnit(operation.unit);
        code = await run('sudo', [
          '-n',
          'systemctl',
          'restart',
          operation.unit,
        ]);
        break;
      case 'build-and-restart':
        assertUnit(operation.unit);
        code = await run('npm', ['run', 'build'], operation.cwd);
        if (code === 0)
          code = await run('sudo', [
            '-n',
            'systemctl',
            'restart',
            operation.unit,
          ]);
        break;
      default:
        throw new Error('Unsupported maintenance operation');
    }
    await database.query(
      'DELETE FROM admin_maintenance_locks WHERE lock_name = ? AND owner_token = ?',
      ['global', input.token],
    );
    return code;
  } finally {
    // A failed/uncertain launch or release retains the row for operator recovery.
    await database.destroy();
  }
}

function assertUnit(unit: string): void {
  if (!/^[a-zA-Z0-9@._-]{1,128}$/.test(unit))
    throw new Error('Invalid maintenance unit');
}

function isScheduledOperation(
  operation: ScheduledMaintenanceOperation,
): operation is ScheduledMaintenanceOperation {
  if (!operation || typeof operation !== 'object') return false;
  if (operation.kind === 'start-unit') return validUnit(operation.unit);
  if (operation.kind === 'restart-unit')
    return validUnit(operation.unit) && validDelay(operation.delayMs);
  return (
    operation.kind === 'build-and-restart' &&
    validUnit(operation.unit) &&
    typeof operation.cwd === 'string' &&
    isAbsolute(operation.cwd) &&
    validDelay(operation.delayMs)
  );
}

function validUnit(unit: unknown): unit is string {
  return typeof unit === 'string' && /^[a-zA-Z0-9@._-]{1,128}$/.test(unit);
}

function validDelay(delayMs: unknown): delayMs is number {
  return (
    typeof delayMs === 'number' &&
    Number.isSafeInteger(delayMs) &&
    delayMs >= 0 &&
    delayMs <= 600_000
  );
}

if (require.main === module) {
  void Promise.resolve()
    .then(() =>
      runMaintenanceChild(
        JSON.parse(process.argv[2] ?? 'null') as MaintenanceChildCommand,
      ),
    )
    .then(
      (code) => {
        process.exitCode = code;
      },
      () => {
        process.stderr.write('admin.maintenance.child.failed\n');
        process.exitCode = 1;
      },
    );
}
