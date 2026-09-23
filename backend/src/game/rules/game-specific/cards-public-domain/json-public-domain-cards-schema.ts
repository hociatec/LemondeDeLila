import { assertUniqueAuthorIds } from '../../../engine/runtime/contracts/authoring-diagnostics';
import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { PublicDomainCardsProgram } from './program';
import {
  authorArray as array,
  authorId as id,
  authorInteger as integer,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../../engine/runtime/contracts/json-author-schema';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';

export const jsonPublicDomainCardsSchema = object({
  collectibleCategories: array(id, 1),
  lossCategory: id,
  deckId: id,
  handId: id,
  inventoryId: id,
  discardNextDrawStatus: id,
  handLimit: positive,
  finishReason: id,
  eventNamespace: id,
  cards: array(
    object({
      id,
      name: { type: 'string', minLength: 1, maxLength: 2000 },
      category: id,
      description: { type: 'string', maxLength: 10000 },
      points: { oneOf: [integer, { type: 'null' }] },
      effects: array(ref('effect')),
    }),
    1,
  ),
});

export function assertPublicDomainCardsReferences(
  program: PublicDomainCardsProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = authoringFailure(
    'game.json.publicDomainCards',
    program,
    'Public-domain cards: ',
  );
  assertUniqueAuthorValues(
    program.collectibleCategories,
    (i) => `collectibleCategories[${i}]`,
    fail,
  );
  if (!program.collectibleCategories.includes(program.lossCategory))
    fail('lossCategory', 'invalid collectible category');
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === program.handId,
  );
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('deckId', 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('handId', 'unknown hand or mismatched deck');
  if (
    !components.some(
      (item) =>
        item.component === 'inventory.set' && item.id === program.inventoryId,
    )
  )
    fail('inventoryId', 'unknown inventory');
  assertUniqueAuthorIds(program.cards, 'cards', fail);
}
