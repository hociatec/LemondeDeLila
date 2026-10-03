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
    runtime.schedule({
      kind: 'restart-unit',
      unit: 'test.service',
      delayMs: 350,
    }),
  );
  expect(owner.detached).toBe(true);
  const [executable, args, options] = jest.mocked(spawn).mock.calls.at(-1)!;
  expect(executable).toBe(process.execPath);
  expect(JSON.parse((args as string[]).at(-1)!)).toEqual({
    token: owner.token,
    operation: {
      kind: 'restart-unit',
      unit: 'test.service',
      delayMs: 350,
    },
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
    new AdminMaintenanceRuntimeService().schedule({
      kind: 'start-unit',
      unit: 'test.service',
    }),
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
    runtime.execute({ kind: 'build', cwd: '/backend', timeoutMs: 1000 }),
  );
  expect(result.status).toBe(1);
  expect(owner.detached).toBe(true);
});

it('rejects invalid units before invoking a privileged command', () => {
  jest.mocked(spawnSync).mockClear();
  expect(() =>
    new AdminMaintenanceRuntimeService().execute({
      kind: 'unit-status',
      unit: 'backend.service;id',
    }),
  ).toThrow('Invalid maintenance unit');
  expect(spawnSync).not.toHaveBeenCalled();
});

it('bounds and sanitizes command output before returning it', () => {
  jest.mocked(spawnSync).mockReturnValue({
    status: 1,
    signal: null,
    stdout: `Bearer private-token /home/service/backend/file.ts ${'x'.repeat(300_000)}`,
    stderr: 'password=hunter2 /etc/systemd/system/backend.service',
    error: new Error('token=raw-secret /var/log/backend.log'),
  } as never);
  const result = new AdminMaintenanceRuntimeService().execute({
    kind: 'build',
    cwd: '/home/service/backend',
    timeoutMs: 1_000,
  });
  expect(result.stdout).not.toContain('private-token');
  expect(result.stderr).not.toContain('hunter2');
  expect(result.error).not.toContain('raw-secret');
  expect(JSON.stringify(result)).not.toMatch(/\/(?:home|etc|var)\//);
  expect(result.stdout.length).toBeLessThanOrEqual(256 * 1024);
});
