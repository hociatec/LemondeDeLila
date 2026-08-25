import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../../../core/application/models/game-state.model';

import {
  CAT_PATTES_DEFAULT_ROUNDS,
  CAT_PATTES_GOAL,
} from '../../model/cat-pattes-state.model';
import type { CatPattesMetadata } from '../../model/cat-pattes-state.model';

export function isCatPattesBotLike(
  player: PlayerStateEntity | null | undefined,
): boolean {
  if (!player) return false;
  if (player.isBot === true) return true;
  const username = String(player.username ?? '')
    .trim()
    .toLowerCase();
  if (username.includes('bot')) return true;
  return false;
}

export function toCatPattesPlayerId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function areCatPattesPlayerIdsEqual(
  left: unknown,
  right: unknown,
): boolean {
  const a = toCatPattesPlayerId(left);
  const b = toCatPattesPlayerId(right);
  return a != null && b != null && a === b;
}

export function getCatPattesGoal(meta: CatPattesMetadata): number {
  const parsed = Number(meta.goalPattes ?? CAT_PATTES_GOAL);
  if (!Number.isFinite(parsed)) return CAT_PATTES_GOAL;
  const rounded = Math.round(parsed);
  if (rounded <= 0) return CAT_PATTES_GOAL;
  return rounded;
}

export function getCatPattesRoundsToPlay(meta: CatPattesMetadata): number {
  const parsed = Number(meta.roundsToPlay ?? CAT_PATTES_DEFAULT_ROUNDS);
  if (!Number.isFinite(parsed)) return CAT_PATTES_DEFAULT_ROUNDS;
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 20) return CAT_PATTES_DEFAULT_ROUNDS;
  return rounded;
}

export function resolveCatPattesWinnerByTotalPattes(
  state: GameStateEntity,
  meta: CatPattesMetadata,
): number | null {
  const players = Array.isArray(state.players) ? state.players : [];
  if (players.length === 0) return null;
  let winnerId: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const player of players) {
    if (typeof player?.id !== 'number') continue;
    const score = Number(meta.points?.[player.id] ?? 0);
    const safeScore = Number.isFinite(score) ? score : 0;
    if (winnerId == null || safeScore > bestScore) {
      winnerId = player.id;
      bestScore = safeScore;
    }
  }
  return winnerId;
}
