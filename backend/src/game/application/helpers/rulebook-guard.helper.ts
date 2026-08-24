import type { GameStateEntity } from '../models/game-state.model';

export function isStartedState(state: GameStateEntity): boolean {
  return String(state.status ?? '').toLowerCase() === 'started';
}

export function getCurrentTurnPlayerId(state: GameStateEntity): number | null {
  return state.turn?.currentPlayerId ?? null;
}

export function hasPendingState(state: GameStateEntity): boolean {
  return state.pending != null;
}

export function canPlayerActOnTurn(
  state: GameStateEntity,
  playerId: number,
  options?: { allowPending?: boolean },
): boolean {
  if (!isStartedState(state)) return false;
  if (!options?.allowPending && hasPendingState(state)) return false;
  return getCurrentTurnPlayerId(state) === playerId;
}



