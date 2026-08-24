import { resolvePlayerNameFromState } from '../../../../../application/helpers/player-name.helper';
import type { GameStateEntity } from '../../../../../application/models/game-state.model';

export type PendingContext =
  | { kind: 'swap_after_move'; actorId: number }
  | { kind: 'choose_next_player'; actorId: number }
  | { kind: 'choose_next_delta'; actorId: number }
  | { kind: 'mirror_next_roll'; actorId: number }
  | null;

export function clampCaPosition(
  value: number,
  min: number,
  max: number,
): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function finalizeCaState(state: GameStateEntity): GameStateEntity {
  return state;
}

export function asCaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function resolveOtherCaPlayers(
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

export function resolveCaPawnLabel(
  state: GameStateEntity,
  id: number,
): string {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => entry?.id === id);
  const playerRecord = asCaRecord(player);
  const pawn =
    typeof playerRecord.pawn === 'string' ? playerRecord.pawn.trim() : '';
  const resolved = pawn || resolvePlayerNameFromState(state, id);
  return `"${resolved}"`;
}
