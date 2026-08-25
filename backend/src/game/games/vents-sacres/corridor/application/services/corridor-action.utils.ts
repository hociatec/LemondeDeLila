import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

export function appendUniqueCorridorLogMessages(
  state: GameStateEntity,
  messages: string[],
): GameStateEntity {
  let out = state;
  for (const raw of messages) {
    const message = String(raw ?? '').trim();
    if (!message) continue;
    const last = out.log?.[out.log.length - 1]?.message;
    if (String(last ?? '').trim() === message) continue;
    out = {
      ...out,
      log: [
        ...(out.log ?? []),
        { message, timestamp: new Date().toISOString() },
      ],
    };
  }
  return out;
}

export function toCorridorCellRef(
  pos: { x: number; y: number },
  size: number,
): string {
  const col = toCorridorColumnLetters((pos?.x ?? 0) + 1);
  const row = Math.max(1, size - (pos?.y ?? 0));
  return `${col}${row}`.toLowerCase();
}

export function toCorridorColumnLetters(column: number): string {
  let n = Math.max(1, Math.floor(Number(column) || 1));
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}
