import { resolvePlayerNameFromState } from '../../../../../core/application/helpers/player-name.helper';
import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';

import type {
  GaloponsMetadata,
  GaloponsPawn,
  GaloponsTile,
} from '../../model/galopons.types';

export type GaloponsChooseTargetContext = {
  kind: 'pair_advance' | 'give_apple' | 'help_advance';
  actorId: number;
  replayAfter?: boolean;
};

export function asGaloponsRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function asGaloponsPartialMeta(
  value: unknown,
): Partial<GaloponsMetadata> {
  return value != null && typeof value === 'object'
    ? (value as Partial<GaloponsMetadata>)
    : {};
}

export function clampGaloponsPosition(
  value: number,
  min: number,
  max: number,
): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function extractGaloponsMoveDelta(text: string): number {
  const numWords: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
  };

  const parseNumberish = (raw: string): number => {
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) return n;
    const key = raw.trim().toLowerCase();
    return numWords[key] ?? 0;
  };

  const forwardApos = text.match(/Avancez\s+d['’]\s*(\d+)\s+case/i);
  if (forwardApos) return Number(forwardApos[1]) || 0;
  const forwardOneApos = text.match(
    /Avancez\s+d['’]\s*(un|une)\s+case/i,
  );
  if (forwardOneApos) return 1;

  const forward = text.match(/Avancez\s+de\s+(\d+)\s+case/i);
  if (forward) return Number(forward[1]) || 0;
  const forwardWords = text.match(
    /Avancez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forwardWords) return parseNumberish(forwardWords[1]);

  const backApos = text.match(/Reculez\s+d['’]\s*(\d+)\s+case/i);
  if (backApos) return -(Number(backApos[1]) || 0);
  const backOneApos = text.match(
    /Reculez\s+d['’]\s*(un|une)\s+case/i,
  );
  if (backOneApos) return -1;

  const back = text.match(/Reculez\s+de\s+(\d+)\s+case/i);
  if (back) return -(Number(back[1]) || 0);
  const backWords = text.match(
    /Reculez\s+de\s+(un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backWords) return -parseNumberish(backWords[1]);

  return 0;
}

export function findNextGaloponsTile(
  tiles: GaloponsTile[],
  start: number,
  direction: 1 | -1,
  predicate: (tile: GaloponsTile) => boolean,
): number | null {
  if (direction === -1) {
    for (let i = start - 1; i >= 0; i -= 1) {
      if (predicate(tiles[i])) return i;
    }
    return null;
  }
  for (let i = start + 1; i < tiles.length; i += 1) {
    if (predicate(tiles[i])) return i;
  }
  return null;
}

export function toGaloponsText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

export function resolveGaloponsPawnName(
  pawns: GaloponsPawn[] | undefined,
  pawnId: string,
): string {
  if (!pawnId) return '';
  const pawn = Array.isArray(pawns)
    ? pawns.find((entry) => toGaloponsText(entry?.id) === pawnId)
    : null;
  return toGaloponsText(pawn?.name);
}

export function normalizeGaloponsPawnChoiceLabel(value: string): string {
  const label = toGaloponsText(value);
  if (!label) return '';
  const idx = label.indexOf(':');
  if (idx > 0) {
    const left = label.slice(0, idx).trim();
    if (left.length > 0) return left;
  }
  return label;
}

export function resolveGaloponsPawnLabel(
  state: GameStateEntity,
  meta: GaloponsMetadata,
  id: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === id) ?? null;
  const playerRecord =
    player != null && typeof player === 'object'
      ? (player as Record<string, unknown>)
      : {};
  const explicitLabel =
    typeof playerRecord.pawnLabel === 'string'
      ? String(playerRecord.pawnLabel).trim()
      : '';
  const pawnId =
    toGaloponsText(meta.pawnByPlayerId?.[id]) ||
    (typeof playerRecord.pawn === 'string'
      ? String(playerRecord.pawn).trim()
      : '');
  const pawn =
    explicitLabel || resolveGaloponsPawnName(meta.pawns, pawnId) || pawnId;
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

export function resolveOtherGaloponsPlayers(
  state: GameStateEntity,
  me: number,
): Array<{ id: number; username: string }> {
  const players = Array.isArray(state.players) ? state.players : [];
  return players
    .filter((player) => player?.id != null && player.id !== me)
    .map((player) => ({
      id: player.id,
      username: resolvePlayerNameFromState(state, player.id),
    }));
}
