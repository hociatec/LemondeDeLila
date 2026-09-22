import { MysqlAdminMaintenanceLockService } from './mysql-admin-maintenance-lock.service';
import { AdminMaintenanceOwnership } from '../../system/admin-maintenance-ownership';

function fixture() {
  let owner: string | null = null;
  const query = jest.fn(async (sql: string, parameters: string[]) => {
    if (sql.startsWith('INSERT')) {
      if (owner)
        throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      owner = parameters[1];
    } else if (owner === parameters[1]) owner = null;
  });
  const local = {
    runExclusive: jest.fn(async (_operation, run: () => unknown) => run()),
  };
  const ownership = new AdminMaintenanceOwnership();
  const instance = () =>
    new MysqlAdminMaintenanceLockService(
      { query } as never,
      local as never,
      ownership,
    );
  return { query, local, instance, ownership, owner: () => owner };
}

it.each([false, true])(
  'retains detached ownership after HTTP completion (throws=%s)',
  async (fails) => {
    const f = fixture();
    const operation = f.instance().runExclusive('restart', () => {
      f.ownership.current()!.detached = true;
      if (fails) throw new Error('response failed');
      return 'accepted';
    });
    if (fails) await expect(operation).rejects.toThrow('response failed');
    else await expect(operation).resolves.toBe('accepted');
    expect(f.ownership.current()).toBeUndefined();
    expect(f.query).toHaveBeenCalledTimes(1);
    await expect(f.instance().runExclusive('deploy', () => {})).rejects.toThrow(
      'maintenance',
    );
  },
);

it('excludes another host even after arbitrary lease expiry or connection replacement', async () => {
  const f = fixture();
  let finish!: () => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const first = f.instance().runExclusive('migrations', () => {
    started();
    return new Promise<void>((resolve) => {
      finish = resolve;
    });
  });
  await entered;
  const run = jest.fn();
  for (let attempts = 0; attempts < 3; attempts++) {
    await expect(f.instance().runExclusive('deploy', run)).rejects.toThrow(
      'maintenance',
    );
  }
  expect(run).not.toHaveBeenCalled();
  expect(f.local.runExclusive).toHaveBeenCalledTimes(1);
  expect(f.owner()).not.toBeNull();
  finish();
  await first;
  await f.instance().runExclusive('deploy', run);
  expect(run).toHaveBeenCalledTimes(1);
  expect(f.owner()).toBeNull();
});

it('releases only its owner token after the protected operation fails', async () => {
  const f = fixture();
  const error = new Error('command failed');
  await expect(
    f.instance().runExclusive('build', () => {
      throw error;
    }),
  ).rejects.toBe(error);
  expect(f.query.mock.calls[1]).toEqual([
    expect.stringContaining('AND owner_token = ?'),
    ['global', f.query.mock.calls[0][1][1]],
  ]);
  expect(f.owner()).toBeNull();
});

it('does not launch or release an uncertain acquisition', async () => {
  const f = fixture();
  f.query.mockRejectedValueOnce(new Error('connection lost'));
  const run = jest.fn();
  await expect(f.instance().runExclusive('build', run)).rejects.toThrow(
    'connection lost',
  );
  expect(run).not.toHaveBeenCalled();
  expect(f.local.runExclusive).not.toHaveBeenCalled();
  expect(f.query).toHaveBeenCalledTimes(1);
});

it('preserves the lock and reports an uncertain release', async () => {
  const f = fixture();
  await expect(
    f.instance().runExclusive('build', () => {
      f.query.mockRejectedValueOnce(new Error('release failed'));
    }),
  ).rejects.toThrow('release failed');
  await expect(f.instance().runExclusive('deploy', () => {})).rejects.toThrow(
    'maintenance',
  );
});
