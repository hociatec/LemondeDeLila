import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { runMaintenanceChild } from './admin-maintenance-child';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
jest.mock('typeorm', () => ({ DataSource: jest.fn() }));

function fixture() {
  const database = {
    initialize: jest.fn(),
    destroy: jest.fn(),
    query: jest.fn().mockResolvedValue([{}]),
  };
  jest.mocked(DataSource).mockImplementation(() => database as never);
  const child = new EventEmitter();
  let started!: () => void;
  const launched = new Promise<void>((resolve) => {
    started = resolve;
  });
  jest.mocked(spawn).mockImplementation(() => {
    started();
    return child as never;
  });
  const input = { token: randomUUID(), argv: ['command'], delayMs: 0 };
  return { database, child, launched, input };
}

it.each([0, 1])(
  'releases only its token after command completion (code=%s)',
  async (code) => {
    const f = fixture();
    const run = runMaintenanceChild(f.input);
    await f.launched;
    expect(f.database.query).toHaveBeenCalledTimes(1);
    f.child.emit('close', code);
    await expect(run).resolves.toBe(code);
    expect(f.database.query.mock.calls[1]).toEqual([
      expect.stringContaining('AND owner_token = ?'),
      ['global', f.input.token],
    ]);
    expect(f.database.destroy).toHaveBeenCalledTimes(1);
  },
);

it('retains ownership when the command cannot start', async () => {
  const f = fixture();
  const run = runMaintenanceChild(f.input);
  await f.launched;
  f.child.emit('error', new Error('launch failed'));
  f.child.emit('close', -1);
  await expect(run).rejects.toThrow('could not start');
  expect(f.database.query).toHaveBeenCalledTimes(1);
  expect(f.database.destroy).toHaveBeenCalledTimes(1);
});

it('refuses to execute without the exact owner token', async () => {
  const f = fixture();
  jest.mocked(spawn).mockClear();
  f.database.query.mockResolvedValue([]);
  await expect(runMaintenanceChild(f.input)).rejects.toThrow(
    'ownership unavailable',
  );
  expect(spawn).not.toHaveBeenCalled();
  expect(f.database.query).toHaveBeenCalledTimes(1);
});

it('retains ownership after a signal because descendants may still be running', async () => {
  const f = fixture();
  const run = runMaintenanceChild(f.input);
  await f.launched;
  f.child.emit('close', null, 'SIGTERM');
  await expect(run).rejects.toThrow('interrupted');
  expect(f.database.query).toHaveBeenCalledTimes(1);
});

it('rejects malformed commands before connecting', async () => {
  const f = fixture();
  await expect(
    runMaintenanceChild({ ...f.input, token: 'invalid' }),
  ).rejects.toThrow('Invalid');
  await expect(runMaintenanceChild(null as never)).rejects.toThrow('Invalid');
  expect(f.database.initialize).not.toHaveBeenCalled();
});
