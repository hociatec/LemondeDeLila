import { spawn } from 'node:child_process';
import { DataSource } from 'typeorm';
import { createMysqlConnectionOptions } from '../../../../platform/database/public-api';
import { getProcessEnvironment } from '../../../../platform/config/public-api';

export type MaintenanceChildCommand = {
  token: string;
  argv: string[];
  cwd?: string;
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
    !Array.isArray(input.argv) ||
    !input.argv.length ||
    !input.argv.every((arg) => typeof arg === 'string') ||
    !input.argv[0] ||
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
    const code = await new Promise<number>((resolve, reject) => {
      const [command, ...args] = input.argv;
      let launchError: Error | undefined;
      const child = spawn(command, args, {
        cwd: input.cwd,
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
