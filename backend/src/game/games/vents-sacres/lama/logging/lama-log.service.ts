import { Injectable } from '@nestjs/common';
import { GameLogEntry } from '../../../../core/entities/game-state.entity';
import { normalizeGameLogMessage } from '../../../../core/helpers/log-style.helper';

@Injectable()
export class LamaLogService {
  append(log: GameLogEntry[] | undefined, message: string): GameLogEntry[] {
    const entry = this.buildEntry(message);
    if (!entry) {
      return Array.isArray(log) ? [...log] : [];
    }

    const nextLog = Array.isArray(log) ? [...log] : [];
    const lastMessage = String(nextLog[nextLog.length - 1]?.message ?? '');
    if (lastMessage === entry.message) {
      return nextLog;
    }
    nextLog.push(entry);
    return nextLog;
  }

  private buildEntry(message: string): GameLogEntry | null {
    const normalized = normalizeGameLogMessage(message);
    if (!normalized) {
      return null;
    }
    return {
      message: normalized,
      timestamp: new Date().toISOString(),
    };
  }
}
