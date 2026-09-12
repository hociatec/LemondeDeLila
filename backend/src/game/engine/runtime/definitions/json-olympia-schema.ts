import type { OlympiaProgram } from '../contracts/olympia-program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

export const jsonOlympiaSchema: AuthorSchema = object(
  {
    handId: id,
    deckIds: array(id, 1),
    targetScore: { type: 'integer', minimum: 1, maximum: 1000000 },
    winnerReason: id,
    cards: array(
      object(
        {
          id,
          name: { type: 'string', minLength: 1, maxLength: 10000 },
          description: { type: 'string', minLength: 1, maxLength: 10000 },
          category: id,
          deck: id,
          points: { type: 'integer', minimum: -1000000, maximum: 1000000 },
          effects: array(ref('effect')),
        },
        ['id', 'category', 'deck', 'effects'],
      ),
      1,
    ),
  },
  ['handId', 'deckIds', 'targetScore', 'winnerReason', 'cards'],
);

export function assertOlympiaReferences(
  program: OlympiaProgram,
  components: readonly GameComponentDefinition[],
): void {
  const decks = new Set(
    components
      .filter((component) => component.component === 'cards.deck')
      .map((component) => component.id),
  );
  const hands = new Set(
    components
      .filter((component) => component.component === 'cards.hands')
      .map((component) => component.id),
  );
  if (!hands.has(program.handId)) throw new Error('Unknown Olympia hand');
  if (
    new Set(program.deckIds).size !== program.deckIds.length ||
    program.deckIds.some((deckId) => !decks.has(deckId))
  )
    throw new Error('Invalid Olympia decks');
  const cardIds = program.cards.map((card) => card.id);
  if (
    new Set(cardIds).size !== cardIds.length ||
    program.cards.some((card) => !decks.has(card.deck))
  )
    throw new Error('Invalid Olympia cards');
}
