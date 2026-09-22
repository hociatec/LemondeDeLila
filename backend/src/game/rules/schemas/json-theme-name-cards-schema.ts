import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';
import type { ThemeNameCardsProgram } from '../effect-packs/cards-theme-name/program';
import { effectJsonSchema } from '../../engine/runtime/contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../engine/runtime/contracts/json-author-schema';

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
  const fail = (reason: string): never => {
    throw new GameConfigurationError('ThemeNameCards: ' + reason);
  };
  for (const key of ['id', 'effectId'] as const)
    if (
      new Set(program.specialRules.map((rule) => rule[key])).size !==
      program.specialRules.length
    )
      fail('duplicate special binding');
  for (const card of program.specialCards)
    if (!program.specialRules.some((rule) => rule.id === card.effect))
      fail('unknown special rule');
  for (const cards of [program.names, program.themes, program.specialCards])
    if (new Set(cards.map((card) => card.id)).size !== cards.length)
      fail('identifiers must be unique within each catalogue');
  if (program.specialCards.some((card) => card.effects.length === 0))
    fail('special cards require effects');
}
