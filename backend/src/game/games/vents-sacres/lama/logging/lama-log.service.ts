import { Injectable } from '@nestjs/common';
import { GameLogEntry } from '../../../../core/entities/game-state.entity';

@Injectable()
export class LamaLogService {
  append(log: GameLogEntry[] | undefined, message: string): GameLogEntry[] {
    const entry = this.buildEntry(message);
    if (!entry) {
      return Array.isArray(log) ? [...log] : [];
    }

    const nextLog = Array.isArray(log) ? [...log] : [];
    nextLog.push(entry);
    return nextLog;
  }

  private buildEntry(message: string): GameLogEntry | null {
    const trimmed = (message ?? '').trim();
    if (!trimmed) {
      return null;
    }
    return {
      message: trimmed,
      timestamp: new Date().toISOString(),
    };
  }
}
