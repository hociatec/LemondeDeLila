import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../models/game-state.model';

export function getSafePlayers(
  baseState: GameStateEntity,
): PlayerStateEntity[] {
  return Array.isArray(baseState.players) ? baseState.players : [];
}

export function getRngMeta(
  metadata: { rng?: Record<string, unknown> } | null | undefined,
): Record<string, unknown> {
  return metadata?.rng ?? {};
}



