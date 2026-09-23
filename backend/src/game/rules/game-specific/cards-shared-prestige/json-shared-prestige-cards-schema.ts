import { assertUniqueAuthorIds } from '../../../engine/runtime/contracts/authoring-diagnostics';
import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { SharedPrestigeCardsProgram } from './program';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorRef as ref,
} from '../../../engine/runtime/contracts/json-author-schema';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';

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
  const fail = authoringFailure('game.json.sharedPrestigeCards', program);
  const categories = program.mechanics.categories.map((rule) => rule.category);
  assertUniqueAuthorValues(
    categories,
    (i) => `mechanics.categories[${i}].category`,
    fail,
  );
  for (const [i, category] of categories.entries())
    if (!program.cards.some((card) => card.category === category))
      fail(`mechanics.categories[${i}].category`, 'category without cards');
  const decks = new Set(
    components.filter((c) => c.component === 'cards.deck').map((c) => c.id),
  );
  if (
    !components.some(
      (c) => c.component === 'cards.hands' && c.id === program.handId,
    )
  )
    fail('handId', 'unknown hand');
  assertUniqueAuthorValues(program.deckIds, (i) => `deckIds[${i}]`, fail);
  for (const [i, deckId] of program.deckIds.entries())
    if (!decks.has(deckId)) fail(`deckIds[${i}]`, 'unknown deck');
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  for (const [i, card] of program.cards.entries())
    if (!decks.has(card.deck)) fail(`cards[${i}].deck`, 'unknown card deck');
}
