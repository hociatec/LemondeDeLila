import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { AdminMaintenanceOwnership } from './admin-maintenance-ownership';
import { AdminMaintenanceRuntimeService } from './admin-maintenance-runtime.service';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
  spawnSync: jest.fn(),
}));

it('transfers durable ownership to the child before returning', () => {
  const ownership = new AdminMaintenanceOwnership();
  const runtime = new AdminMaintenanceRuntimeService(ownership);
  const child = { once: jest.fn(), unref: jest.fn() };
  jest.mocked(spawn).mockReturnValue(child as never);
  const owner = { token: randomUUID(), detached: false };
  ownership.run(owner, () =>
    runtime.spawnDetached(['harmless-command', 'argument'], { delayMs: 350 }),
  );
  expect(owner.detached).toBe(true);
  const [executable, args, options] = jest.mocked(spawn).mock.calls.at(-1)!;
  expect(executable).toBe(process.execPath);
  expect(JSON.parse((args as string[]).at(-1)!)).toEqual({
    token: owner.token,
    argv: ['harmless-command', 'argument'],
    delayMs: 350,
  });
  expect(options).toMatchObject({
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  expect(child.unref).toHaveBeenCalledTimes(1);
});

it('refuses to launch without a durable owner', () => {
  jest.mocked(spawn).mockClear();
  expect(() =>
    new AdminMaintenanceRuntimeService().spawnDetached(['command']),
  ).toThrow('ownership');
  expect(spawn).not.toHaveBeenCalled();
});

it('preserves the durable owner after a synchronous command timeout', () => {
  const ownership = new AdminMaintenanceOwnership();
  const runtime = new AdminMaintenanceRuntimeService(ownership);
  const owner = { token: randomUUID(), detached: false };
  jest.mocked(spawnSync).mockReturnValue({
    status: null,
    signal: 'SIGTERM',
    stdout: '',
    stderr: '',
    error: new Error('timeout'),
  } as never);
  const result = ownership.run(owner, () =>
    runtime.runCommand(['npm', 'run', 'build']),
  );
  expect(result.status).toBe(1);
  expect(owner.detached).toBe(true);
});
