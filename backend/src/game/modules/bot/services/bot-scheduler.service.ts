import { Injectable, NotFoundException } from '@nestjs/common';
import { playingLog } from '../../../../common/utils/playing-logger';

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
      playingLog('engine.bot.timer', { roomId, gameType });
      run().catch((err) => {
        if (this.isRoomNotFound(err)) {
          this.clear(key);
          playingLog('engine.bot.stale', {
            roomId,
            gameType,
            reason: err instanceof Error ? err.message : String(err),
          });
          onStale?.(err);
          return;
        }
        playingLog('engine.bot.error', {
          roomId,
          gameType,
          message: err instanceof Error ? err.message : String(err),
        });
      });
    }, delayMs);

    this.timers.set(key, timer);
  }

  private isRoomNotFound(err: unknown): boolean {
    if (err instanceof NotFoundException) return true;
    const message = err instanceof Error ? err.message : String(err ?? '');
    return (
      message.includes('Room introuvable') ||
      message.includes('Table introuvable')
    );
  }
}
