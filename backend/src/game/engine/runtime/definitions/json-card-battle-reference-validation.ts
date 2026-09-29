import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
type Failure = (path: string, reason: string) => never;
export function assertCardBattleReferences(
  pattern: Extract<JsonGamePattern, { kind: 'card-battle' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const seen = new Set<string>();
  for (const [index, card] of pattern.cards.entries()) {
    if (seen.has(card.id))
      fail(`${root}.cards[${index}].id`, 'duplicate value');
    seen.add(card.id);
  }
  if (pattern.totalCards !== pattern.cards.length)
    fail(`${root}.totalCards`, 'totalCards must match the card catalogue');
  const deck = components.find(
    (item) => item.component === 'cards.deck' && item.id === pattern.deckId,
  );
  if (deck?.component !== 'cards.deck')
    fail(`${root}.deckId`, 'unknown card deck');
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === pattern.handId,
  );
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
}
