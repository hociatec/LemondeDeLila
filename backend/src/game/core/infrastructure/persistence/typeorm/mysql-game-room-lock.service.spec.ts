import type { ConfigService } from '@nestjs/config';
import type { DataSource, QueryRunner } from 'typeorm';
import { GameRoomLockUnavailableError } from '../../../application/ports/game-room-lock.port';
import { MysqlGameRoomLockService } from './mysql-game-room-lock.service';

describe('MysqlGameRoomLockService', () => {
  const setup = (acquired: number, releaseError?: Error) => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ acquired }])
      .mockImplementationOnce(async () => {
        if (releaseError) throw releaseError;
        return [{ released: 1 }];
      });
    const destroy = jest.fn();
    const runner = {
      connect: jest.fn().mockResolvedValue({ destroy }),
      query,
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;
    const dataSource = {
      createQueryRunner: () => runner,
    } as unknown as DataSource;
    const config = {
      get: (_key: string, fallback: number) => fallback,
    } as ConfigService;
    return {
      service: new MysqlGameRoomLockService(dataSource, config),
      destroy,
      runner,
      query,
    };
  };

  it('acquires and releases a parameterized MySQL named lock', async () => {
    const { service, runner, query } = setup(1);

    await expect(service.runExclusive(42, async () => 'ok')).resolves.toBe(
      'ok',
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      'SELECT GET_LOCK(?, ?) AS acquired',
      ['lmdl:game-room:42', 5],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      'SELECT RELEASE_LOCK(?) AS released',
      ['lmdl:game-room:42'],
    );
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('fails closed when MySQL cannot acquire the lock', async () => {
    const { service, runner } = setup(0);
    const operation = jest.fn();

    await expect(service.runExclusive(9, operation)).rejects.toBeInstanceOf(
      GameRoomLockUnavailableError,
    );
    expect(operation).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('preserves a committed result when returning the connection to the pool fails', async () => {
    const { service, runner, destroy } = setup(1);
    jest
      .mocked(runner.release)
      .mockRejectedValueOnce(new Error('pool unavailable'));
    await expect(
      service.runExclusive(9, async () => 'committed'),
    ).resolves.toBe('committed');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('preserves the business error when returning the connection to the pool fails', async () => {
    const { service, runner, destroy } = setup(1);
    const failure = new Error('business rejection');
    jest
      .mocked(runner.release)
      .mockRejectedValueOnce(new Error('pool unavailable'));
    await expect(
      service.runExclusive(9, async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('releases the runner even when connection acquisition fails', async () => {
    const { service, runner } = setup(1);
    const failure = new Error('connection unavailable');
    jest.mocked(runner.connect).mockRejectedValueOnce(failure);
    const operation = jest.fn();
    await expect(service.runExclusive(9, operation)).rejects.toBe(failure);
    expect(operation).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('does not replace a successful command result with a release failure', async () => {
    const { service, destroy } = setup(1, new Error('connection lost'));
    await expect(
      service.runExclusive(3, async () => 'committed'),
    ).resolves.toBe('committed');
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the connection when acquisition acknowledgement is lost', async () => {
    const { service, query, destroy, runner } = setup(1);
    const failure = new Error('response lost');
    query.mockReset().mockRejectedValueOnce(failure);
    const operation = jest.fn();
    await expect(service.runExclusive(3, operation)).rejects.toBe(failure);
    expect(operation).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it.each([0, null, true, undefined])(
    'destroys the connection for unconfirmed release %s',
    async (released) => {
      const { service, query, destroy } = setup(1);
      query
        .mockReset()
        .mockResolvedValueOnce([{ acquired: 1 }])
        .mockResolvedValueOnce([{ released }]);
      await expect(
        service.runExclusive(3, async () => 'committed'),
      ).resolves.toBe('committed');
      expect(destroy).toHaveBeenCalledTimes(1);
    },
  );

  it('returns a clean connection to the pool after a failed operation', async () => {
    const { service, destroy, query } = setup(1);
    const failure = new Error('command failed');
    await expect(
      service.runExclusive(3, () => Promise.reject(failure)),
    ).rejects.toBe(failure);
    expect(query).toHaveBeenCalledTimes(2);
    expect(destroy).not.toHaveBeenCalled();
  });
});
