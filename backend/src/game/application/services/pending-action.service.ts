import { Injectable } from '@nestjs/common';
import type { GameStateEntity, PendingState } from '../models/game-state.model';

export function createPendingState(
  state: GameStateEntity,
  pending: PendingState,
): GameStateEntity {
  return {
    ...state,
    pending: { ...pending },
  };
}

export function clearPendingState(state: GameStateEntity): GameStateEntity {
  return {
    ...state,
    pending: null,
  };
}

export function resolvePendingState(
  state: GameStateEntity,
  resolver: (state: GameStateEntity, pending: PendingState) => GameStateEntity,
): GameStateEntity {
  const pending = state.pending as PendingState | null;
  if (!pending) return state;
  return resolver(clearPendingState(state), pending);
}

export function getPendingType(state: GameStateEntity): string {
  const pending = state.pending;
  return typeof pending?.type === 'string' ? pending.type.trim() : '';
}

export function isPendingType(state: GameStateEntity, type: string): boolean {
  return getPendingType(state) === String(type ?? '').trim();
}

@Injectable()
export class PendingActionService<TAction = unknown> {
  private pending: Record<number, TAction | undefined> = {};

  set(playerId: number, action: TAction): void {
    this.pending[playerId] = action;
  }

  get(playerId: number): TAction | undefined {
    return this.pending[playerId];
  }

  clear(playerId: number): void {
    delete this.pending[playerId];
  }
}
