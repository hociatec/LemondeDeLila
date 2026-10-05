import { validatePlayerValueInstruction } from './effect-value-validator';
import { assertEffectJson } from '../contracts/effect-json-schema';
import { AuthoringError } from '../contracts/authoring-error';
import { validateCardMove } from './card-location-validator';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import {
  requirePositiveInteger,
  requireReference,
  requireCardReference,
  requireTrackPosition,
  validateEffectTarget,
  validateInstructionTargets,
} from './game-effect-reference-validator';
import { validateNumericExpression } from './numeric-expression-validator';
import { validateControlInstruction } from './effect-control-validator';

import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';
export type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';
type ValidationInput = {
  instruction: GameEffectInstruction;
  path: string;
  references: GameEffectValidationReferences;
  fail: ValidationFailure;
};

export function assertEffectInstructions(
  instructions: unknown,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): asserts instructions is readonly GameEffectInstruction[] {
  if (!Array.isArray(instructions)) fail(path, 'séquence d’effets invalide');
  try {
    assertEffectJson(instructions, path, true);
  } catch (error) {
    // Preserve the caller's definition identity and diagnostic contract.
    if (error instanceof AuthoringError) fail(error.path, error.expected);
    throw error;
  }
  const values: readonly GameEffectInstruction[] = instructions;
  for (const [index, value] of values.entries()) {
    const effectPath = `${path}[${index}]`;
    if (!value || typeof value !== 'object')
      fail(effectPath, 'instruction invalide');
    validateInstruction(value, effectPath, references, fail);
  }
}

function validateInstruction(
  instruction: GameEffectInstruction,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  validateInstructionTargets(instruction, path, references, fail);
  const input = { instruction, path, references, fail };
  if (
    validateControlInstruction(
      instruction,
      path,
      references,
      fail,
      assertEffectInstructions,
    ) ||
    validateMovementInstruction(input) ||
    validateCardInstruction(input) ||
    validateInventoryInstruction(input) ||
    validatePlayerValueInstruction(input) ||
    validateMiscInstruction(input)
  )
    return;
  fail(
    path,
    `type d’effet inconnu « ${String((instruction as { kind?: unknown }).kind)} »`,
  );
}

function validateMovementInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (
    instruction.kind === 'move' ||
    instruction.kind === 'move-to' ||
    instruction.kind === 'move-relative-to' ||
    instruction.kind === 'move-to-tag'
  ) {
    requireReference(
      references.tracks,
      instruction.trackId,
      `${path}.trackId`,
      fail,
    );
    if (instruction.kind === 'move-to-tag') {
      const tags = references.trackTags?.get(instruction.trackId);
      if (tags && !tags.has(instruction.tag))
        fail(`${path}.tag`, 'tag de piste inconnu');
      return true;
    }
    const expression =
      instruction.kind === 'move'
        ? instruction.spaces
        : instruction.kind === 'move-to'
          ? instruction.position
          : (instruction.offset ?? 0);
    validateNumericExpression(
      expression,
      `${path}.${instruction.kind === 'move' ? 'spaces' : instruction.kind === 'move-to' ? 'position' : 'offset'}`,
      references,
      fail,
    );
    if (instruction.kind === 'move-relative-to') {
      validateEffectTarget(
        instruction.reference,
        `${path}.reference`,
        fail,
        references,
      );
    } else if (
      instruction.kind === 'move-to' &&
      typeof instruction.position === 'number'
    )
      requireTrackPosition(
        references,
        instruction.trackId,
        instruction.position,
        `${path}.position`,
        fail,
      );
    else if (
      instruction.kind === 'move' &&
      typeof instruction.spaces === 'number' &&
      !Number.isSafeInteger(instruction.spaces)
    )
      fail(`${path}.spaces`, 'distance entière requise');
    return true;
  }
  if (instruction.kind !== 'swap-positions') return false;
  requireReference(
    references.tracks,
    instruction.trackId,
    `${path}.trackId`,
    fail,
  );
  return true;
}

function validateCardInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (validateCardMove(instruction, path, references, fail)) return true;
  if (validateCardCollection(instruction, path, references, fail)) return true;
  if (instruction.kind === 'give-card') {
    requireReference(
      references.hands,
      instruction.handId,
      `${path}.handId`,
      fail,
    );
    requireCardReference(
      references,
      instruction.handId,
      instruction.cardId,
      `${path}.cardId`,
      fail,
    );
    return true;
  }
  if (instruction.kind === 'steal-card') {
    requireReference(
      references.hands,
      instruction.handId,
      `${path}.handId`,
      fail,
    );
    if (instruction.count != null)
      requirePositiveInteger(instruction.count, `${path}.count`, fail);
    return true;
  }
  if (
    instruction.kind !== 'swap-hands' &&
    instruction.kind !== 'exchange-random-cards'
  )
    return false;
  requireReference(
    references.hands,
    instruction.handId,
    `${path}.handId`,
    fail,
  );
  return true;
}

function validateCardCollection(
  instruction: GameEffectInstruction,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): boolean {
  if (
    instruction.kind === 'draw-cards' ||
    instruction.kind === 'discard-random' ||
    instruction.kind === 'draw-to-zone'
  ) {
    requireReference(
      references.decks,
      instruction.deckId,
      `${path}.deckId`,
      fail,
    );
    if (instruction.kind === 'draw-to-zone') {
      requireReference(
        references.zoneDecks ?? new Map(),
        instruction.zoneId,
        `${path}.zoneId`,
        fail,
      );
    } else {
      requireReference(
        references.hands,
        instruction.handId,
        `${path}.handId`,
        fail,
      );
    }
    requirePositiveInteger(instruction.count, `${path}.count`, fail);
    const handDeck =
      instruction.kind === 'draw-to-zone'
        ? references.zoneDecks?.get(instruction.zoneId)
        : references.handDecks?.get(instruction.handId);
    if (
      handDeck != null &&
      handDeck !== instruction.deckId &&
      (instruction.kind === 'draw-to-zone' ||
        !references.handAcceptedDecks
          ?.get(instruction.handId)
          ?.has(instruction.deckId))
    )
      fail(`${path}.deckId`, 'pioche différente de la destination');
    return true;
  }
  if (instruction.kind === 'shuffle-cards') {
    requireReference(
      references.decks,
      instruction.deckId,
      `${path}.deckId`,
      fail,
    );
    return true;
  }
  return false;
}

function validateInventoryInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (instruction.kind === 'discard-random-inventory') {
    requireReference(
      references.inventories,
      instruction.inventoryId,
      `${path}.inventoryId`,
      fail,
    );
    requirePositiveInteger(instruction.count, `${path}.count`, fail);
    return true;
  }
  if (instruction.kind === 'steal-random-inventory') {
    requireReference(
      references.inventories,
      instruction.inventoryId,
      `${path}.inventoryId`,
      fail,
    );
    if (instruction.count != null)
      requirePositiveInteger(instruction.count, `${path}.count`, fail);
    if (instruction.skipSourceIfEmpty != null)
      requirePositiveInteger(
        instruction.skipSourceIfEmpty,
        `${path}.skipSourceIfEmpty`,
        fail,
      );
    return true;
  }
  if (
    instruction.kind !== 'swap-inventories' &&
    instruction.kind !== 'exchange-random-inventory'
  )
    return false;
  requireReference(
    references.inventories,
    instruction.inventoryId,
    `${path}.inventoryId`,
    fail,
  );
  return true;
}

function validateMiscInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (instruction.kind === 'roll-dice') {
    requireReference(
      references.diceSets,
      instruction.diceId ?? 'main',
      `${path}.diceId`,
      fail,
    );
    return true;
  }
  if (instruction.kind === 'custom') {
    if (
      !references.effects ||
      !Object.hasOwn(references.effects, instruction.effectId)
    ) {
      fail(`${path}.effectId`, `effet inconnu « ${instruction.effectId} »`);
    }
    const resolver = references.effects?.[instruction.effectId];
    if (resolver && typeof resolver === 'object' && 'input' in resolver) {
      const schema = resolver.input;
      if (
        schema &&
        typeof schema === 'object' &&
        'parse' in schema &&
        typeof schema.parse === 'function'
      ) {
        try {
          const parse = schema.parse as (
            value: unknown,
            path: string,
          ) => unknown;
          parse.call(
            schema,
            structuredClone(instruction.data ?? {}),
            `${path}.data`,
          );
        } catch (error) {
          fail(
            `${path}.data`,
            error instanceof Error
              ? error.message
              : 'Données d’effet invalides',
          );
        }
      }
    }
    return true;
  }
  if (instruction.kind === 'transition-phase') {
    if (!instruction.phase.trim()) fail(`${path}.phase`, 'ID vide');
    if (references.phases)
      requireReference(
        references.phases,
        instruction.phase,
        `${path}.phase`,
        fail,
      );
    return true;
  }
  if (instruction.kind === 'narrate') {
    validateNarrationInstruction(instruction, path, references, fail);
    return true;
  }
  return [
    'choose-player',
    'complete-turn',
    'reverse-turn-order',
    'start-round',
    'end-round',
    'eliminate-player',
  ].includes(instruction.kind);
}

function validateNarrationInstruction(
  instruction: Extract<GameEffectInstruction, { kind: 'narrate' }>,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  if (!instruction.key.trim()) fail(`${path}.key`, 'ID vide');
  if (!instruction.default.trim()) fail(`${path}.default`, 'narration vide');
  for (const [index, variant] of (instruction.variants ?? []).entries()) {
    validateEffectTarget(
      variant.target,
      `${path}.variants[${index}].target`,
      fail,
      references,
    );
    if (!variant.text.trim())
      fail(`${path}.variants[${index}].text`, 'narration vide');
  }
}
