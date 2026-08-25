import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

import type {
  MissionGalaxieMetadata,
  MissionGalaxiePendingContext,
} from '../../model/mission-galaxie-state.model';

export type MissionGalaxieMetadataWithFlags = MissionGalaxieMetadata & {
  keepTurn?: boolean;
};

export function asMissionGalaxieRecord(
  value: unknown,
): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function asMissionGalaxiePartialMeta(
  value: unknown,
): Partial<MissionGalaxieMetadataWithFlags> {
  return value != null && typeof value === 'object'
    ? (value as Partial<MissionGalaxieMetadataWithFlags>)
    : {};
}

export function readMissionGalaxieEventMoveOptions(
  pending: unknown,
): Array<{ targetPlayerId: number; delta: number }> {
  const row = asMissionGalaxieRecord(pending);
  const data = asMissionGalaxieRecord(row.data);
  const options = Array.isArray(data.options) ? data.options : [];
  return options
    .map((entry) => {
      const option = asMissionGalaxieRecord(entry);
      return {
        targetPlayerId: Number(option.targetPlayerId),
        delta: Number(option.delta),
      };
    })
    .filter(
      (entry) =>
        Number.isFinite(entry.targetPlayerId) && Number.isFinite(entry.delta),
    );
}

export function describeMissionGalaxiePawnLabel(
  state: GameStateEntity,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === playerId) ?? null;
  const pawn =
    typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
  if (!pawn) return '"son pion"';
  const lower = pawn.toLowerCase();
  const feminine = lower.startsWith('la ') || lower.startsWith('une ');
  const inner = pawn
    .replace(/^l['’]\s*/i, '')
    .replace(/^(le|la|les|un|une)\s+/i, '')
    .trim();
  const core = inner || pawn;
  const lowered =
    core.length <= 1
      ? core.toLowerCase()
      : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
  return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
}
