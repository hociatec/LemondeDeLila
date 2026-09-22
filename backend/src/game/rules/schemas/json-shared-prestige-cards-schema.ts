import type { SharedPrestigeCardsProgram } from '../effect-packs/cards-shared-prestige/program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorRef as ref,
} from '../../engine/runtime/contracts/json-author-schema';
import type { GameComponentDefinition } from '../../engine/runtime/definitions/component-kit';

export const jsonSharedPrestigeCardsSchema: AuthorSchema = object(
  {
    mechanics: object({
      blockDrawStatus: id,
      blockPlayStatus: id,
      reducedGainStatus: id,
      lossProtectionStatus: id,
      gainDivisor: { type: 'integer', minimum: 1, maximum: 1000000 },
      categories: array(
        object(
          {
            category: id,
            blockedBy: array(id),
            globallyBlockedBy: array(id),
            multiplierStatus: id,
            bonusStatus: id,
            penaltyStatus: id,
          },
          ['category', 'blockedBy', 'globallyBlockedBy'],
        ),
      ),
    }),
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
  ['mechanics', 'handId', 'deckIds', 'targetScore', 'winnerReason', 'cards'],
);

export function assertSharedPrestigeCardsReferences(
  program: SharedPrestigeCardsProgram,
  components: readonly GameComponentDefinition[],
): void {
  const categories = program.mechanics.categories.map((rule) => rule.category);
  if (
    new Set(categories).size !== categories.length ||
    categories.some(
      (category) => !program.cards.some((card) => card.category === category),
    )
  )
    throw new Error('Invalid category rules');
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
  if (!hands.has(program.handId))
    throw new Error('Unknown SharedPrestigeCards hand');
  if (
    new Set(program.deckIds).size !== program.deckIds.length ||
    program.deckIds.some((deckId) => !decks.has(deckId))
  )
    throw new Error('Invalid SharedPrestigeCards decks');
  const cardIds = program.cards.map((card) => card.id);
  if (
    new Set(cardIds).size !== cardIds.length ||
    program.cards.some((card) => !decks.has(card.deck))
  )
    throw new Error('Invalid SharedPrestigeCards cards');
}
