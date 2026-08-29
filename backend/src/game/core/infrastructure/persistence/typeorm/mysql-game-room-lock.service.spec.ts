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
    const runner = {
      connect: jest.fn().mockResolvedValue(undefined),
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

  it('does not replace a successful command result with a release failure', async () => {
    const { service } = setup(1, new Error('connection lost'));
    await expect(
      service.runExclusive(3, async () => 'committed'),
    ).resolves.toBe('committed');
  });
});
