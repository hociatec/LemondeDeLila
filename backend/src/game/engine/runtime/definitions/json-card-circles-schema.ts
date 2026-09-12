import type { CardCirclesProgram } from '../effect-packs/collection-themed-circles/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

export const jsonCardCirclesSchema = object({
  deckId: id,
  handId: id,
  inventoryId: id,
  cards: array(
    object({
      id,
      name: { type: 'string', minLength: 1, maxLength: 2000 },
      theme: id,
    }),
    1,
  ),
  themes: array(id, 1),
  cardsPerCircle: positive,
  circlesToWin: positive,
  handMinimum: positive,
  handLimit: positive,
  finishReason: id,
  eventNamespace: id,
});

export function assertCardCirclesReferences(
  program: CardCirclesProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Card circles: ${reason}`);
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
  if (new Set(program.themes).size !== program.themes.length)
    fail('duplicate theme');
  if (program.cardsPerCircle !== program.themes.length)
    fail('one card per theme required');
  if (program.handMinimum > program.handLimit)
    fail('hand minimum exceeds limit');
  for (const theme of program.themes)
    if (!program.cards.some((card) => card.theme === theme))
      fail(`theme without cards ${theme}`);
}
