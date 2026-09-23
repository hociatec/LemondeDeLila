import { assertUniqueAuthorIds } from '../../../engine/runtime/contracts/authoring-diagnostics';
import { assertUniqueAuthorValues } from '../../../engine/runtime/contracts/authoring-diagnostics';
import { authoringFailure } from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { CardCirclesProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../../../engine/runtime/contracts/json-author-schema';

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
  const fail = authoringFailure(
    'game.json.cardCircles',
    program,
    'Card circles: ',
  );
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
  assertUniqueAuthorValues(program.themes, (i) => `themes[${i}]`, fail);
  if (program.cardsPerCircle !== program.themes.length)
    fail('cardsPerCircle', 'one card per theme required');
  if (program.handMinimum > program.handLimit)
    fail('handMinimum', 'hand minimum exceeds limit');
  for (const [i, theme] of program.themes.entries())
    if (!program.cards.some((card) => card.theme === theme))
      fail(`themes[${i}]`, `theme without cards ${theme}`);
}
