import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { FamilyRequestProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../../../engine/sdk/extension-api';

const text = { type: 'string', minLength: 1, maxLength: 2000 } as const;
export const jsonFamilyRequestSchema = object({
  deckId: id,
  handId: id,
  setsId: id,
  cards: array(
    {
      oneOf: [
        object({
          id,
          type: { const: 'family' },
          familyId: id,
          familyName: text,
          memberName: text,
        }),
        object({
          id,
          type: { const: 'quiz' },
          question: text,
          choices: array(text, 2),
          answerIndex: { type: 'integer', minimum: 0, maximum: 100 },
        }),
        object({
          id,
          type: { const: 'nature' },
          description: text,
          delta: { type: 'integer', minimum: -1000000, maximum: 1000000 },
        }),
      ],
    },
    1,
  ),
  pollutionCounter: id,
  pollutionLimit: positive,
  familiesToWin: positive,
  pollutionFinishReason: id,
  familyFinishReason: id,
  eventNamespace: id,
});

export function assertFamilyRequestReferences(
  program: FamilyRequestProgram,
  components: readonly GameComponentDefinition[],
  counters: ReadonlySet<string>,
): void {
  const fail = authoringFailure(
    'game.json.familyRequest',
    program,
    'Family request: ',
  );
  const deck = components.find(
    (component) =>
      component.component === 'cards.deck' && component.id === program.deckId,
  );
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' && component.id === program.handId,
  );
  const sets = components.find(
    (component) =>
      component.component === 'cards.sets' && component.id === program.setsId,
  );
  if (deck?.component !== 'cards.deck') fail('deckId', 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('handId', 'unknown hand or mismatched deck');
  if (
    sets?.component !== 'cards.sets' ||
    sets.deck !== program.deckId ||
    sets.hand !== program.handId
  )
    fail('setsId', 'unknown card sets or mismatched source');
  if (!counters.has(program.pollutionCounter))
    fail('pollutionCounter', 'unknown counter');
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  for (const type of ['family', 'quiz', 'nature'] as const)
    if (!program.cards.some((card) => card.type === type))
      fail('cards', `missing ${type} card`);
  for (const [i, card] of program.cards.entries())
    if (card.type === 'quiz' && card.answerIndex >= card.choices.length)
      fail(`cards[${i}].answerIndex`, 'quiz answer outside choices');
  const familyIds = new Set(
    program.cards
      .filter((card) => card.type === 'family')
      .map((card) => card.id),
  );
  if (
    sets?.component === 'cards.sets' &&
    Object.values(sets.sets)
      .flat()
      .some((cardId) => !familyIds.has(cardId))
  )
    fail('setsId', 'set contains a non-family card');
}
