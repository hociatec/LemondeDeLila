import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type {
  PlayerValuesKitState,
  PlayerStatus,
} from './player-values-contracts';

export function assertPlayerValues(state: PlayerValuesKitState): void {
  for (const values of [
    state.scores,
    ...Object.values(state.resources),
    state.statuses,
    state.scheduledSkips,
    state.scheduledExtraTurns,
  ]) {
    for (const key of Object.keys(values)) {
      assertGamePlayerId(Number(key));
      if (String(Number(key)) !== key)
        throw new GameRuleViolationError('PLAYER_KEY_INVALID');
    }
  }
  for (const value of Object.values(state.scores)) assertGameValue(value);
  for (const [id, values] of Object.entries(state.resources)) {
    assertPlayerValueId(id);
    for (const value of Object.values(values)) assertGameValue(value);
  }
  for (const [id, value] of Object.entries(state.counters ?? {})) {
    assertPlayerValueId(id);
    assertGameValue(value);
  }
  for (const statuses of Object.values(state.statuses))
    for (const status of statuses) {
      assertStatusMetadata(status);
      if (status.remaining !== null) assertGameCount(status.remaining);
    }
  for (const value of Object.values(state.scheduledSkips))
    assertGameCount(value);
  for (const value of Object.values(state.scheduledExtraTurns))
    assertGameCount(value);
}

export function assertStatusMetadata(
  status: Pick<PlayerStatus, 'source' | 'stacks' | 'categories'>,
): void {
  if (status.source?.playerId !== undefined)
    assertGamePlayerId(status.source.playerId);
  if (status.source?.effectId !== undefined)
    assertPlayerValueId(status.source.effectId);
  if (status.stacks !== undefined) {
    assertGameCount(status.stacks);
    if (status.stacks === 0)
      throw new GameRuleViolationError('STATUS_STACKS_INVALID');
  }
  if ((status.categories?.length ?? 0) > 64)
    throw new GameRuleViolationError('STATUS_CATEGORIES_INVALID');
  for (const category of status.categories ?? []) assertPlayerValueId(category);
}

export function assertGamePlayerId(playerId: number): void {
  if (!Number.isSafeInteger(playerId) || playerId === 0)
    throw new GameRuleViolationError('PLAYER_ID_INVALID');
}

export function assertPlayerValueId(id: string): void {
  if (
    typeof id !== 'string' ||
    !id.trim() ||
    id.length > 128 ||
    id === 'prototype' ||
    Object.hasOwn(Object.prototype, id)
  ) {
    throw new GameRuleViolationError(
      'PLAYER_VALUE_ID_INVALID',
      {},
      'Identifiant de ressource ou compteur invalide',
    );
  }
}

/** Signed values may represent debts or penalties, but never non-finite/unsafe magnitudes. */
export function assertGameValue(value: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new GameRuleViolationError(
      'GAME_NUMBER_INVALID',
      {},
      'Valeur numérique hors limites',
    );
  }
}

export function assertGameCount(
  value: number,
  maximum = Number.MAX_SAFE_INTEGER,
): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new GameRuleViolationError(
      'GAME_COUNT_INVALID',
      {},
      'Quantité hors limites',
    );
  }
}
