import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';

export function bounceVoyage(target: number, max: number): number {
  if (max <= 0) return 0;
  if (target < 0) return 0;
  if (target === max) return max;
  if (target < max) return target;
  const over = target - max;
  return max - over;
}

export function normalizeVoyage(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function extractVoyageMoveDelta(text: string): number {
  const parse = (raw: string) => {
    const v = raw.trim().toLowerCase();
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    const map: Record<string, number> = {
      un: 1,
      une: 1,
      deux: 2,
      trois: 3,
      quatre: 4,
      cinq: 5,
      six: 6,
    };
    return map[v] ?? 0;
  };
  const forward = text.match(
    /avance(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (forward) return parse(forward[1]);
  const backward = text.match(
    /recule(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i,
  );
  if (backward) return -parse(backward[1]);
  return 0;
}

export function extractVoyageSkipTurns(text: string): number {
  if (/Passez trois tours/i.test(text)) return 3;
  if (/Passez deux tours/i.test(text)) return 2;
  if (/Passez votre tour/i.test(text) || /Passe ton prochain tour/i.test(text))
    return 1;
  return 0;
}

export function extractVoyageCardCount(text: string): number {
  if (/\b2\b/.test(text) || /\bdeux\b/i.test(text)) return 2;
  if (/\b3\b/.test(text) || /\btrois\b/i.test(text)) return 3;
  return 1;
}

export function asVoyageRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function toVoyageText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function describeVoyagePawnLabel(
  state: GameStateEntity,
  playerId: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === playerId);
  const playerRecord = asVoyageRecord(player);
  const explicitLabel = toVoyageText(playerRecord.pawnLabel).trim();
  if (explicitLabel) return `"${explicitLabel}"`;

  const pawnId = toVoyageText(playerRecord.pawn).trim();
  if (pawnId) return `"${pawnId}"`;

  const fallback = resolvePlayerNameFromState(state, playerId);
  return `"${fallback}"`;
}
