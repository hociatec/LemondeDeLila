import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';

type Failure = (path: string, reason: string) => never;

export function assertThemedSetCollectionReferences(
  pattern: Extract<JsonGamePattern, { kind: 'themed-set-collection' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === pattern.handId,
  );
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === pattern.deckId,
    )
  )
    fail(`${root}.deckId`, 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
  if (
    !components.some(
      (item) =>
        item.component === 'inventory.set' && item.id === pattern.inventoryId,
    )
  )
    fail(`${root}.inventoryId`, 'unknown inventory');
  assertUnique(
    pattern.cards.map((card) => card.id),
    `${root}.cards`,
    'id',
    fail,
  );
  assertUnique(pattern.themes, `${root}.themes`, null, fail);
  if (pattern.cardsPerCircle !== pattern.themes.length)
    fail(`${root}.cardsPerCircle`, 'one card per theme required');
  if (pattern.handMinimum > pattern.handLimit)
    fail(`${root}.handMinimum`, 'hand minimum exceeds limit');
  for (const [index, theme] of pattern.themes.entries())
    if (!pattern.cards.some((card) => card.theme === theme))
      fail(`${root}.themes[${index}]`, `theme without cards ${theme}`);
}

function assertUnique(
  values: readonly string[],
  root: string,
  member: string | null,
  fail: Failure,
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value))
      fail(`${root}[${index}]${member ? `.${member}` : ''}`, 'duplicate value');
    seen.add(value);
  }
}
