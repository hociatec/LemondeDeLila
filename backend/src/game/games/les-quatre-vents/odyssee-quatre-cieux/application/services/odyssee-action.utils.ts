import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import type { OdysseeMetadata } from '../../model/odyssee.types';

const ODYSSEE_DEFAULT_PAWN_NAMES = ['Aube', 'Brise', 'Comete', 'Dune'] as const;

export function asOdysseeRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function asOdysseePartialMeta(
  value: unknown,
): Partial<OdysseeMetadata> {
  return value != null && typeof value === 'object'
    ? (value as Partial<OdysseeMetadata>)
    : {};
}

export function resolveOdysseeWinnerId(
  meta: OdysseeMetadata,
  playerId: number,
): number | null {
  const trackLength = Number(meta.trackLength ?? 56);
  const homeLength = Number(meta.homeLength ?? 6);
  const arrivalProgress = trackLength + homeLength - 1;
  const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId])
    ? meta.pawnsByPlayer[playerId]
    : [];
  return pawns.every((pawn) => Number(pawn?.progress ?? -1) >= arrivalProgress)
    ? playerId
    : null;
}

export function describeOdysseePawnLabel(pawnIndex: number): string {
  const safe = Number.isFinite(pawnIndex) ? pawnIndex : -1;
  return ODYSSEE_DEFAULT_PAWN_NAMES[safe] ?? `Pion ${safe + 1}`;
}

export function describeOdysseePlayerName(
  state: GameStateEntity,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => Number(entry?.id) === playerId);
  const username = String(player?.username ?? '').trim();
  return username || `Joueur ${playerId}`;
}
