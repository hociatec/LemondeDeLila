import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type QueryRunner } from 'typeorm';
import {
  GameRoomLockUnavailableError,
  type GameRoomLock,
} from '../../../application/ports/game-room-lock.port';

function lockSucceeded(
  rows: unknown,
  field: 'acquired' | 'released',
  expected = 1,
): boolean {
  if (!Array.isArray(rows)) return false;
  const row: unknown = rows[0];
  if (!row || typeof row !== 'object' || !(field in row)) return false;
  const value: unknown = Reflect.get(row, field);
  return value === expected || value === String(expected);
}

function isDisposableConnection(
  connection: unknown,
): connection is { destroy(): void } {
  return (
    !!connection &&
    typeof connection === 'object' &&
    'destroy' in connection &&
    typeof connection.destroy === 'function'
  );
}

function connectionDisposer(connection: unknown): () => void {
  if (!isDisposableConnection(connection)) {
    throw new Error('MySQL lock connection must support destruction');
  }
  return () => connection.destroy();
}

async function releaseLock(
  runner: QueryRunner,
  lockName: string,
): Promise<void> {
  const rows: unknown = await runner.query(
    'SELECT RELEASE_LOCK(?) AS released',
    [lockName],
  );
  if (!lockSucceeded(rows, 'released'))
    throw new Error('MySQL did not confirm lock release');
}

/** MySQL named locks are connection-scoped, so one query runner owns a lock. */
@Injectable()
export class MysqlGameRoomLockService implements GameRoomLock {
  private readonly logger = new Logger(MysqlGameRoomLockService.name);
  private readonly timeoutSeconds: number;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    const configured = Number(config.get<number>('GAME_ROOM_LOCK_TIMEOUT_SECONDS', 5));
    this.timeoutSeconds = Number.isSafeInteger(configured) && configured >= 1 && configured <= 60 ? configured : 5;
  }

  async runExclusive<T>(
    roomId: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!Number.isSafeInteger(roomId) || roomId <= 0) {
      throw new GameRoomLockUnavailableError(roomId);
    }
    const runner = this.dataSource.createQueryRunner();
    const lockName = `lmdl:game-room:${roomId}`;
    const startedAtMs = Date.now();
    let acquired = false;
    let uncertain = false;
    let destroy: (() => void) | undefined;
    try {
      destroy = connectionDisposer(await runner.connect());
      // A lost response can hide a successful acquisition on the server.
      uncertain = true;
      const rows: unknown = await runner.query(
        'SELECT GET_LOCK(?, ?) AS acquired',
        [lockName, this.timeoutSeconds],
      );
      acquired = lockSucceeded(rows, 'acquired');
      uncertain = !lockSucceeded(rows, 'acquired', 0);
      if (!acquired) {
        this.logger.warn(
          JSON.stringify({
            event: 'game.room_lock.acquire_failed',
            roomId,
            waitMs: Date.now() - startedAtMs,
          }),
        );
        throw new GameRoomLockUnavailableError(roomId);
      }
      this.logger.debug(
        JSON.stringify({
          event: 'game.room_lock.acquired',
          roomId,
          waitMs: Date.now() - startedAtMs,
        }),
      );
      return await operation();
    } finally {
      if (acquired) {
        try {
          await releaseLock(runner, lockName);
          uncertain = false;
        } catch {
          this.logger.error(
            JSON.stringify({
              event: 'game.room_lock.release_failed',
              roomId,
            }),
          );
        }
      }
      try {
        // mysql2 removes destroyed connections from its pool before release().
        if (uncertain) destroy?.();
      } finally {
        await runner.release();
      }
    }
  }
}
