import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { RitesProgram } from '../contracts/rites-program';
import { effectJsonSchema } from '../contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const familyIds = [
  'symboles-sacres',
  'creatures-de-paques',
  'traditions-et-fetes',
  'gourmandises-objets',
  'nature-saisons',
] as const;
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

export const jsonRitesSchema: AuthorSchema = object({
  cards: array(
    {
      oneOf: [
        object(
          {
            id,
            type: { const: 'family' },
            name: text,
            familyId: { enum: familyIds },
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

export function assertRitesReferences(program: RitesProgram): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Entre Rites: ' + reason);
  };
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('card identifiers must be unique');
  for (const familyId of familyIds)
    if (
      !program.cards.some(
        (card) => card.type === 'family' && card.familyId === familyId,
      )
    )
      fail('family without cards: ' + familyId);
  if (
    program.cards.some(
      (card) => card.type === 'special' && card.effects.length === 0,
    )
  )
    fail('special cards require effects');
}
