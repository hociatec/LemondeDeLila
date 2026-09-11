import type { GameEffectInstruction } from '../contracts/effect-ir';
import {
  requireFinite,
  requirePositiveInteger,
  requireReference,
  requireCardReference,
  requireTrackPosition,
  requireResourceReference,
  validateEffectCondition,
  validateEffectTarget,
} from './game-effect-reference-validator';

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
  const values: readonly unknown[] = instructions;
  for (const [index, value] of values.entries()) {
    const effectPath = `${path}.${index}`;
    if (!value || typeof value !== 'object')
      fail(effectPath, 'instruction invalide');
    validateInstruction(
      value as GameEffectInstruction,
      effectPath,
      references,
      fail,
    );
  }
}

function validateInstruction(
  instruction: GameEffectInstruction,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  validateEffectTarget(
    'target' in instruction ? instruction.target : undefined,
    `${path}.target`,
    fail,
  );
  const input = { instruction, path, references, fail };
  if (
    validateControlInstruction(input) ||
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

function validateControlInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (instruction.kind === 'conditional') {
    validateEffectCondition(
      instruction.condition,
      `${path}.condition`,
      references,
      fail,
    );
    assertEffectInstructions(
      instruction.then,
      `${path}.then`,
      references,
      fail,
    );
    assertEffectInstructions(
      instruction.else ?? [],
      `${path}.else`,
      references,
      fail,
    );
    return true;
  }
  return validateReactionInstruction({ instruction, path, references, fail });
}

function validateReactionInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (instruction.kind !== 'reaction') return false;
  validateEffectTarget(instruction.reactor, `${path}.reactor`, fail);
  if (instruction.availability) {
    validateEffectTarget(
      instruction.availability.owner,
      `${path}.availability.owner`,
      fail,
    );
    if (instruction.availability.kind === 'cards') {
      requireReference(
        references.hands,
        instruction.availability.handId,
        `${path}.availability.handId`,
        fail,
      );
      for (const [index, cardId] of instruction.options.entries()) {
        requireCardReference(
          references,
          instruction.availability.handId,
          cardId,
          `${path}.options.${index}`,
          fail,
        );
      }
    } else if (
      instruction.availability.amount != null &&
      (!Number.isInteger(instruction.availability.amount) ||
        instruction.availability.amount < 1)
    )
      fail(`${path}.availability.amount`, 'quantité positive attendue');
    if (instruction.availability.kind === 'resources') {
      for (const [index, resource] of instruction.options.entries()) {
        requireResourceReference(
          references,
          resource,
          `${path}.options.${index}`,
          fail,
        );
      }
    }
  }
  if (
    instruction.options.length === 0 ||
    instruction.options.some((option) => !option.trim()) ||
    new Set(instruction.options).size !== instruction.options.length
  )
    fail(`${path}.options`, 'options de réaction invalides');
  for (const [option, reaction] of Object.entries(instruction.reactions)) {
    if (!instruction.options.includes(option))
      fail(`${path}.reactions.${option}`, 'option non déclarée');
    assertEffectInstructions(
      reaction,
      `${path}.reactions.${option}`,
      references,
      fail,
    );
  }
  assertEffectInstructions(
    instruction.fallback ?? [],
    `${path}.fallback`,
    references,
    fail,
  );
  return true;
}

function validateMovementInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (instruction.kind === 'move' || instruction.kind === 'move-to') {
    requireReference(
      references.tracks,
      instruction.trackId,
      `${path}.trackId`,
      fail,
    );
    requireFinite(
      instruction.kind === 'move' ? instruction.spaces : instruction.position,
      path,
      fail,
    );
    if (instruction.kind === 'move-to')
      requireTrackPosition(
        references,
        instruction.trackId,
        instruction.position,
        `${path}.position`,
        fail,
      );
    else if (!Number.isSafeInteger(instruction.spaces))
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
  validateEffectTarget(instruction.left, `${path}.left`, fail);
  validateEffectTarget(instruction.right, `${path}.right`, fail);
  return true;
}

function validateCardInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (
    instruction.kind === 'draw-cards' ||
    instruction.kind === 'discard-random'
  ) {
    requireReference(
      references.decks,
      instruction.deckId,
      `${path}.deckId`,
      fail,
    );
    requireReference(
      references.hands,
      instruction.handId,
      `${path}.handId`,
      fail,
    );
    requirePositiveInteger(instruction.count, `${path}.count`, fail);
    const handDeck = references.handDecks?.get(instruction.handId);
    if (handDeck != null && handDeck !== instruction.deckId)
      fail(`${path}.deckId`, 'pioche différente de celle de la main');
    return true;
  }
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
    validateEffectTarget(instruction.from, `${path}.from`, fail);
    validateEffectTarget(instruction.to, `${path}.to`, fail);
    return true;
  }
  if (instruction.kind === 'steal-card') {
    requireReference(
      references.hands,
      instruction.handId,
      `${path}.handId`,
      fail,
    );
    validateEffectTarget(instruction.from, `${path}.from`, fail);
    validateEffectTarget(instruction.to, `${path}.to`, fail);
    if (instruction.count != null)
      requirePositiveInteger(instruction.count, `${path}.count`, fail);
    return true;
  }
  if (instruction.kind !== 'swap-hands') return false;
  requireReference(
    references.hands,
    instruction.handId,
    `${path}.handId`,
    fail,
  );
  validateEffectTarget(instruction.left, `${path}.left`, fail);
  validateEffectTarget(instruction.right, `${path}.right`, fail);
  return true;
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
    validateEffectTarget(instruction.from, `${path}.from`, fail);
    validateEffectTarget(instruction.to, `${path}.to`, fail);
    if (instruction.count != null)
      requirePositiveInteger(instruction.count, `${path}.count`, fail);
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
  validateEffectTarget(instruction.left, `${path}.left`, fail);
  validateEffectTarget(instruction.right, `${path}.right`, fail);
  return true;
}

function validatePlayerValueInstruction({
  instruction,
  path,
  references,
  fail,
}: ValidationInput): boolean {
  if (
    instruction.kind === 'gain-resource' ||
    instruction.kind === 'lose-resource' ||
    instruction.kind === 'transfer-resource'
  ) {
    requireResourceReference(
      references,
      instruction.resource,
      `${path}.resource`,
      fail,
    );
    requireFinite(instruction.amount, `${path}.amount`, fail);
    if (instruction.kind === 'transfer-resource') {
      validateEffectTarget(instruction.from, `${path}.from`, fail);
      validateEffectTarget(instruction.to, `${path}.to`, fail);
    }
    return true;
  }
  if (instruction.kind === 'gain-score') {
    requireFinite(instruction.amount, `${path}.amount`, fail);
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
  return ['choose-player', 'complete-turn', 'reverse-turn-order'].includes(
    instruction.kind,
  );
}
