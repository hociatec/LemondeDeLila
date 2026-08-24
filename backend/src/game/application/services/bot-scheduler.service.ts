import { Injectable } from '@nestjs/common';
import { playingLog } from '../../../common/utils/public-api';
import { stringOrEmpty } from '@common/utils/string-value.utils';
import { GameRoomNotFoundError } from '../../domain/errors/game-domain.errors';

@Injectable()
export class BotSchedulerService {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  has(key: string): boolean {
    return this.timers.has(key);
  }

  clear(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  schedule(params: {
    key: string;
    delayMs: number;
    roomId: number;
    gameType: string;
    run: () => Promise<void>;
    onStale?: (err: unknown) => void;
  }): void {
    const { key, delayMs, roomId, gameType, run, onStale } = params;
    if (this.timers.has(key)) return;

    const timer = setTimeout(() => {
      this.timers.delete(key);
      playingLog('engine.bot.timer', { roomId, gameType });
      run().catch((err) => {
        if (this.isRoomNotFound(err)) {
          this.clear(key);
          playingLog('engine.bot.stale', {
            roomId,
            gameType,
            reason: err instanceof Error ? err.message : stringOrEmpty(err),
          });
          onStale?.(err);
          return;
        }
        playingLog('engine.bot.error', {
          roomId,
          gameType,
          message: err instanceof Error ? err.message : stringOrEmpty(err),
        });
      });
    }, delayMs);

    this.timers.set(key, timer);
  }

  private isRoomNotFound(err: unknown): boolean {
    if (err instanceof GameRoomNotFoundError) return true;
    const message = err instanceof Error ? err.message : stringOrEmpty(err);
    return (
      message.includes('Room introuvable') ||
      message.includes('Table introuvable')
    );
  }
}
