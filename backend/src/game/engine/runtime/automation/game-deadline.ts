import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

/** Millisecond timestamps must fit JavaScript Date and retain integer precision. */
export const MAX_GAME_TIMESTAMP_MS = 8_640_000_000_000_000;

export function isGameTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    Math.abs(value) <= MAX_GAME_TIMESTAMP_MS
  );
}

export function isGameDelay(value: unknown): value is number {
  return isGameTimestamp(value) && value >= 0;
}

export function gameDeadline(nowMs: number, afterMs: number): number {
  if (!isGameTimestamp(nowMs) || !isGameDelay(afterMs)) {
    throw new GameConfigurationError('Durée ou horloge de jeu invalide');
  }
  const deadline = nowMs + afterMs;
  if (!isGameTimestamp(deadline)) {
    throw new GameConfigurationError('Échéance de jeu hors limites');
  }
  return deadline;
}
