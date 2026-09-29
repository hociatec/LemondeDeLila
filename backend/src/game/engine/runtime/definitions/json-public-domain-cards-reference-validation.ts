import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
type Failure = (path: string, reason: string) => never;
export function assertPublicDomainCardsReferences(
  pattern: Extract<JsonGamePattern, { kind: 'public-domain-cards' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const categories = new Set<string>();
  for (const [index, category] of pattern.collectibleCategories.entries()) {
    if (categories.has(category))
      fail(`${root}.collectibleCategories[${index}]`, 'duplicate value');
    categories.add(category);
  }
  if (!categories.has(pattern.lossCategory))
    fail(`${root}.lossCategory`, 'invalid collectible category');
  const deck = components.find(
    (item) => item.component === 'cards.deck' && item.id === pattern.deckId,
  );
  if (deck?.component !== 'cards.deck') fail(`${root}.deckId`, 'unknown deck');
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === pattern.handId,
  );
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
  if (
    !components.some(
      (item) =>
        item.component === 'inventory.set' && item.id === pattern.inventoryId,
    )
  )
    fail(`${root}.inventoryId`, 'unknown inventory');
  const cardIds = new Set<string>();
  for (const [index, card] of pattern.cards.entries()) {
    if (cardIds.has(card.id))
      fail(`${root}.cards[${index}].id`, 'duplicate value');
    cardIds.add(card.id);
  }
}
