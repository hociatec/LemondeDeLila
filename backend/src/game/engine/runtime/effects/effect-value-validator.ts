import { validateNumericExpression } from './numeric-expression-validator';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';
import {
  requireResourceReference,
  requirePositiveInteger,
} from './game-effect-reference-validator';
type ValidationInput = {
  instruction: GameEffectInstruction;
  path: string;
  references: GameEffectValidationReferences;
  fail: ValidationFailure;
};

export function validatePlayerValueInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (instruction.kind === 'exchange-resources') {
    for (const side of ['leftOffer', 'rightOffer'] as const) {
      const offer = instruction[side];
      requireResourceReference(
        references,
        offer.resource,
        `${path}.${side}.resource`,
        fail,
      );
      requirePositiveInteger(offer.amount, `${path}.${side}.amount`, fail);
    }
    return true;
  }
  if (
    instruction.kind === 'gain-resource' ||
    instruction.kind === 'set-resource' ||
    instruction.kind === 'lose-resource' ||
    instruction.kind === 'transfer-resource'
  ) {
    const expression =
      instruction.kind === 'set-resource'
        ? instruction.value
        : instruction.amount;
    if (
      instruction.kind !== 'set-resource' &&
      typeof expression === 'number' &&
      expression < 0
    )
      fail(`${path}.amount`, 'negative resource amount');
    requireResourceReference(
      references,
      instruction.resource,
      `${path}.resource`,
      fail,
    );
    validateNumericExpression(
      expression,
      `${path}.${instruction.kind === 'set-resource' ? 'value' : 'amount'}`,
      references,
      fail,
    );
    return true;
  }
  if (instruction.kind === 'gain-score' || instruction.kind === 'set-score') {
    validateNumericExpression(
      instruction.kind === 'set-score' ? instruction.value : instruction.amount,
      `${path}.${instruction.kind === 'set-score' ? 'value' : 'amount'}`,
      references,
      fail,
    );
    return true;
  }
  if (instruction.kind === 'skip-turn' || instruction.kind === 'extra-turn') {
    if (instruction.count != null)
      requirePositiveInteger(instruction.count, `${path}.count`, fail);
    return true;
  }
  if (instruction.kind === 'add-status') {
    if (!instruction.status.trim()) fail(`${path}.status`, 'ID vide');
    if (instruction.turns != null)
      requirePositiveInteger(instruction.turns, `${path}.turns`, fail);
    return true;
  }
  if (instruction.kind !== 'remove-status') return false;
  if (!instruction.status.trim()) fail(`${path}.status`, 'ID vide');
  return true;
}
