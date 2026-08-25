import { GameLogEntry } from '../../../../../core/application/models/game-state.model';
import { normalizeGameLogMessage } from '../../../../../history/public-api';

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


