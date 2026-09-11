import { GameRuleViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { PlayerValuesKitState } from './player-values-contracts';

export function assertPlayerValues(state: PlayerValuesKitState): void {
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
    for (const status of statuses)
      if (status.remaining !== null) assertGameCount(status.remaining);
  for (const value of Object.values(state.scheduledSkips))
    assertGameCount(value);
  for (const value of Object.values(state.scheduledExtraTurns))
    assertGameCount(value);
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
