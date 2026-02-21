import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../core/entities/game-state.entity';

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
