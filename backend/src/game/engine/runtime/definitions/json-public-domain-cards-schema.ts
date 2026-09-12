import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { PublicDomainCardsProgram } from '../effect-packs/cards-public-domain/program';
import {
  authorArray as array,
  authorId as id,
  authorInteger as integer,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

export const jsonPublicDomainCardsSchema = object({
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
      category: { enum: ['tresor', 'objet', 'event', 'monster', 'collapse'] },
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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Public-domain cards: ${reason}`);
  };
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === program.handId,
  );
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('unknown hand or mismatched deck');
  if (
    !components.some(
      (item) =>
        item.component === 'inventory.set' && item.id === program.inventoryId,
    )
  )
    fail('unknown inventory');
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
}
