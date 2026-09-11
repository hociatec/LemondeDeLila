import { GameStateViolationError } from '../../../core/domain/errors/game-domain.errors';
import type { DiceDefinition, PersistedDiceRoll } from './dice-contracts';
import { assertGameCount, assertGameValue } from './numeric-invariants';

/**
 * Validate plain and explicit-policy rolls while old snapshots are readable.
 * Remove the plain-roll branch after the persisted snapshot migration closes.
 */
export function assertDiceRoll(
  id: string,
  roll: PersistedDiceRoll,
  definition: Pick<DiceDefinition, 'count' | 'sides'>,
): void {
  assertGameCount(definition.count, 100);
  assertGameCount(definition.sides, 1_000_000);
  const {
    extraDice = 0,
    keep = 'all',
    multiplier = 1,
    modifier = 0,
  } = roll.policy ?? {};
  assertGameCount(extraDice, 100);
  assertGameValue(multiplier);
  assertGameValue(modifier);
  assertGameValue(roll.total);
  const expectedCount = keep === 'all' ? definition.count + extraDice : 1;
  if (
    definition.count < 1 ||
    definition.sides < 2 ||
    !['all', 'highest', 'lowest'].includes(keep) ||
    !Array.isArray(roll.values) ||
    roll.values.length !== expectedCount ||
    roll.values.some(
      (value) =>
        !Number.isSafeInteger(value) || value < 1 || value > definition.sides,
    ) ||
    roll.total !==
      roll.values.reduce((sum, value) => sum + value, 0) * multiplier + modifier
  )
    throw new GameStateViolationError('Résultat de dés invalide', { id });
}
