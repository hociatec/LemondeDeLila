import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { RitualPhasesProgram } from './program';
import { effectJsonSchema } from '../../../engine/sdk/extension-api';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

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
  initialHandSize: { type: 'integer', minimum: 1, maximum: 100 },
  exchangeFamilyCount: { type: 'integer', minimum: 1, maximum: 10 },
  finishReason: id,
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
  const fail = authoringFailure(
    'game.json.ritualPhases',
    program,
    'Ritual phases: ',
  );
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  const familyCards = program.cards.filter((card) => card.type === 'family');
  if (familyCards.length === 0)
    fail('cards', 'at least one family card is required');
  const familyNames = new Map<string, string>();
  for (const [i, card] of program.cards.entries()) {
    if (card.type === 'special') {
      if (card.effects.length === 0)
        fail(`cards[${i}].effects`, 'special cards require effects');
      continue;
    }
    const existingName = familyNames.get(card.familyId);
    if (existingName && existingName !== card.familyName)
      fail(
        `cards[${i}].familyName`,
        'family names must be consistent: ' + card.familyId,
      );
    familyNames.set(card.familyId, card.familyName);
  }
}
