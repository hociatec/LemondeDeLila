import { authoringProperty } from '../contracts/authoring-diagnostics';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';
import {
  requireCardReference,
  requireReference,
  requireResourceReference,
  validateEffectCondition,
  validateEffectTarget,
} from './game-effect-reference-validator';

type AssertInstructions = (
  instructions: unknown,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
) => void;

export function validateControlInstruction(
  instruction: GameEffectInstruction,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
  assertInstructions: AssertInstructions,
): boolean {
  const nested = (effects: unknown, nestedPath: string) =>
    assertInstructions(effects, nestedPath, references, fail);
  if (instruction.kind === 'conditional') {
    validateEffectCondition(
      instruction.condition,
      `${path}.condition`,
      references,
      fail,
    );
    nested(instruction.then, `${path}.then`);
    nested(instruction.else ?? [], `${path}.else`);
    return true;
  }
  if (instruction.kind === 'repeat') {
    if (
      !Number.isSafeInteger(instruction.count) ||
      instruction.count < 0 ||
      instruction.count > 64
    )
      fail(`${path}.count`, 'répétition entière entre 0 et 64 attendue');
    nested(instruction.effects, `${path}.effects`);
    return true;
  }
  if (instruction.kind === 'switch') {
    instruction.cases.forEach((branch, index) => {
      validateEffectCondition(
        branch.condition,
        `${path}.cases[${index}].condition`,
        references,
        fail,
      );
      nested(branch.effects, `${path}.cases[${index}].effects`);
    });
    nested(instruction.default ?? [], `${path}.default`);
    return true;
  }
  if (instruction.kind === 'random-choice') {
    instruction.choices.forEach((effects, index) =>
      nested(effects, `${path}.choices[${index}]`),
    );
    return true;
  }
  if (instruction.kind === 'stop') return true;
  return validateReaction(instruction, path, references, fail, nested);
}

function validateReaction(
  instruction: GameEffectInstruction,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
  nested: (effects: unknown, path: string) => void,
): boolean {
  if (instruction.kind !== 'reaction') return false;
  const availability = instruction.availability;
  if (availability) {
    validateEffectTarget(
      availability.owner,
      `${path}.availability.owner`,
      fail,
      references,
    );
    if (availability.kind === 'cards') {
      requireReference(
        references.hands,
        availability.handId,
        `${path}.availability.handId`,
        fail,
      );
      instruction.options.forEach((cardId, index) =>
        requireCardReference(
          references,
          availability.handId,
          cardId,
          `${path}.options[${index}]`,
          fail,
        ),
      );
    } else if (
      availability.amount != null &&
      (!Number.isInteger(availability.amount) || availability.amount < 1)
    )
      fail(`${path}.availability.amount`, 'quantité positive attendue');
    if (availability.kind === 'resources')
      instruction.options.forEach((resource, index) =>
        requireResourceReference(
          references,
          resource,
          `${path}.options[${index}]`,
          fail,
        ),
      );
  }
  if (
    !instruction.options.length ||
    instruction.options.some((option) => !option.trim()) ||
    new Set(instruction.options).size !== instruction.options.length
  )
    fail(`${path}.options`, 'options de réaction invalides');
  for (const [option, reaction] of Object.entries(instruction.reactions)) {
    if (!instruction.options.includes(option))
      fail(
        authoringProperty(`${path}.reactions`, option),
        'option non déclarée',
      );
    nested(reaction, authoringProperty(`${path}.reactions`, option));
  }
  nested(instruction.fallback ?? [], `${path}.fallback`);
  return true;
}
