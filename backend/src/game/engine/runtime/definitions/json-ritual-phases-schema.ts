import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { RitualPhasesProgram } from '../effect-packs/cards-ritual-phases/program';
import { effectJsonSchema } from '../contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const specialEffects = [
  'draw_two_choose_one',
  'draw_and_trigger',
  'collect_from_others',
  'take_from_discard',
  'mute_specials',
  'swap_hands',
  'free_family',
  'reshuffle_cycle',
  'peace_turns',
  'reveal_and_steal',
] as const;

export const jsonRitualPhasesSchema: AuthorSchema = object({
  cards: array(
    {
      oneOf: [
        object(
          {
            id,
            type: { const: 'family' },
            name: text,
            familyId: id,
            familyName: text,
          },
          ['id', 'type', 'name', 'familyId', 'familyName'],
        ),
        object(
          {
            id,
            type: { const: 'special' },
            name: text,
            description: text,
            effect: { enum: specialEffects },
            effects: effectJsonSchema,
          },
          ['id', 'type', 'name', 'description', 'effect', 'effects'],
        ),
      ],
    },
    1,
  ),
});

export function assertRitualPhasesReferences(
  program: RitualPhasesProgram,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Ritual phases: ' + reason);
  };
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('card identifiers must be unique');
  const familyCards = program.cards.filter((card) => card.type === 'family');
  if (familyCards.length === 0) fail('at least one family card is required');
  const familyNames = new Map<string, string>();
  for (const card of familyCards) {
    const existingName = familyNames.get(card.familyId);
    if (existingName && existingName !== card.familyName)
      fail('family names must be consistent: ' + card.familyId);
    familyNames.set(card.familyId, card.familyName);
  }
  if (
    program.cards.some(
      (card) => card.type === 'special' && card.effects.length === 0,
    )
  )
    fail('special cards require effects');
}
