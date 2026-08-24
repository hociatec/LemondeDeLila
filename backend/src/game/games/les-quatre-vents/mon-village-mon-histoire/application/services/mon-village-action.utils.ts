import type { GameStateEntity } from '../../../../../application/models/game-state.model';

import type { MonVillageMetadata } from '../../model/mon-village-state.model';

const ZONE_MAP: Array<{ min: number; max: number; id: number }> = [
  { min: 1, max: 6, id: 1 },
  { min: 7, max: 13, id: 2 },
  { min: 14, max: 20, id: 3 },
  { min: 21, max: 25, id: 4 },
  { min: 26, max: 31, id: 5 },
  { min: 32, max: 36, id: 6 },
  { min: 37, max: 41, id: 7 },
  { min: 42, max: 42, id: 8 },
];

export function asMonVillagePartialMeta(
  value: unknown,
): Partial<MonVillageMetadata> {
  return value != null && typeof value === 'object'
    ? (value as Partial<MonVillageMetadata>)
    : {};
}

export function getMonVillageZoneForTile(n: number): number | null {
  const entry = ZONE_MAP.find((range) => n >= range.min && n <= range.max);
  return entry?.id ?? null;
}

export function describeMonVillagePawnLabel(
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
    .replace(/^l['ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢]\s*/i, '')
    .replace(/^(le|la|les|un|une)\s+/i, '')
    .trim();
  const core = inner || pawn;
  const lowered =
    core.length <= 1
      ? core.toLowerCase()
      : `${core.charAt(0).toLowerCase()}${core.slice(1)}`;
  return `"${feminine ? 'sa' : 'son'} ${lowered}"`;
}
