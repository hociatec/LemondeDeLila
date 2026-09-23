import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { ThemeNameCardsProgram } from './program';
import { effectJsonSchema } from '../../../engine/runtime/contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/runtime/contracts/json-author-schema';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const operations = [
  'discard-target',
  'add-one-submission',
  'draw-second-prompt',
  'lock-card',
  'random-submit',
  'protect',
  'exchange-with-target',
  'redraw-all',
  'discard-attacker',
  'hide-prompt',
  'exchange-with-neighbor',
  'add-two-submissions',
  'reverse-pending',
  'select-judge',
  'increment-pending-submissions',
  'add-neutral-submission',
  'become-judge',
  'reopen-submissions',
  'discard-two-targets',
  'steal-from-target',
] as const;

export const jsonThemeNameCardsSchema: AuthorSchema = object({
  finishReason: id,
  handSize: { type: 'integer', minimum: 1, maximum: 100 },
  specialHandSize: { type: 'integer', minimum: 0, maximum: 100 },
  maximumSubmission: { type: 'integer', minimum: 1, maximum: 10 },
  redrawCount: { type: 'integer', minimum: 0, maximum: 100 },
  specialRules: array(
    object({
      id,
      effectId: id,
      operation: { enum: operations },
      targeting: {
        enum: [
          'none',
          'held-card',
          'opponent',
          'two-opponents',
          'pending-opponent',
        ],
      },
    }),
  ),
  targetScore: { type: 'integer', minimum: 1, maximum: 1000 },
  names: array(object({ id, name: text }), 1),
  themes: array(object({ id, text }), 1),
  specialCards: array(
    object({
      id,
      name: text,
      description: text,
      effect: id,
      effects: effectJsonSchema,
    }),
    1,
  ),
});

export function assertThemeNameCardsReferences(
  program: ThemeNameCardsProgram,
): void {
  const fail = authoringFailure(
    'game.json.themeNameCards',
    program,
    'ThemeNameCards: ',
  );
  for (const key of ['id', 'effectId'] as const)
    assertUniqueAuthorValues(
      program.specialRules.map((rule) => rule[key]),
      (i) => `specialRules[${i}].${key}`,
      fail,
    );
  for (const [index, card] of program.specialCards.entries())
    if (!program.specialRules.some((rule) => rule.id === card.effect))
      fail(`specialCards[${index}].effect`, 'unknown special rule');
  for (const field of ['names', 'themes', 'specialCards'] as const)
    assertUniqueAuthorValues(
      program[field].map((card) => card.id),
      (i) => `${field}[${i}].id`,
      fail,
    );
  program.specialCards.forEach((card, i) => {
    if (card.effects.length === 0)
      fail(`specialCards[${i}].effects`, 'special cards require effects');
  });
}
