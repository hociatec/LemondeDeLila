import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  GameRoomLockUnavailableError,
  type GameRoomLock,
} from '../../../application/ports/game-room-lock.port';

type MysqlLockResult = { acquired?: number | string | null };

/** MySQL named locks are connection-scoped, so one query runner owns a lock. */
@Injectable()
export class MysqlGameRoomLockService implements GameRoomLock {
  private readonly logger = new Logger(MysqlGameRoomLockService.name);
  private readonly timeoutSeconds: number;

  constructor(
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.timeoutSeconds = config.get<number>(
      'GAME_ROOM_LOCK_TIMEOUT_SECONDS',
      5,
    );
  }

  async runExclusive<T>(
    roomId: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    const lockName = `lmdl:game-room:${roomId}`;
    const startedAtMs = Date.now();
    await runner.connect();
    let acquired = false;
    try {
      const rows = (await runner.query('SELECT GET_LOCK(?, ?) AS acquired', [
        lockName,
        this.timeoutSeconds,
      ])) as MysqlLockResult[];
      acquired = Number(rows[0]?.acquired) === 1;
      if (!acquired) throw new GameRoomLockUnavailableError(roomId);
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
          await runner.query('SELECT RELEASE_LOCK(?) AS released', [lockName]);
        } catch (error) {
          this.logger.error(
            JSON.stringify({
              event: 'game.room_lock.release_failed',
              roomId,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
      await runner.release();
    }
  }
}
