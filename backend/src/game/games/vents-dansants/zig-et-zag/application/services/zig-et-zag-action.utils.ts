import type { ZigEtZagRoundState } from '../../model/zig-et-zag-state.model';

export function asZigEtZagRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toZigEtZagNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeZigEtZagIdList(list: unknown): number[] {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .map((value) => toZigEtZagNumberOrNull(value))
    .filter((value): value is number => typeof value === 'number');
}

export function normalizeZigEtZagRoundState(
  round: ZigEtZagRoundState,
): ZigEtZagRoundState {
  const plays = Array.isArray(round?.plays) ? round.plays : [];
  const normalizedPlays = plays
    .map((play) => {
      const row = asZigEtZagRecord(play);
      const playerId = toZigEtZagNumberOrNull(row.playerId);
      if (playerId == null) return null;
      return {
        ...row,
        playerId,
        playedCards: Array.isArray(row.playedCards) ? row.playedCards : [],
      };
    })
    .filter((play): play is ZigEtZagRoundState['plays'][number] => Boolean(play));

  return {
    ...round,
    plays: normalizedPlays,
    waitingPlayers: normalizeZigEtZagIdList(round.waitingPlayers),
    tiedPlayers: normalizeZigEtZagIdList(round.tiedPlayers),
  };
}

export function pickZigEtZagNextCurrentPlayerId(
  round: ZigEtZagRoundState,
  fallback: number,
): number {
  const waiting = Array.isArray(round?.waitingPlayers)
    ? round.waitingPlayers
    : [];
  if (!waiting.length) return fallback;
  return waiting[0] ?? fallback;
}
