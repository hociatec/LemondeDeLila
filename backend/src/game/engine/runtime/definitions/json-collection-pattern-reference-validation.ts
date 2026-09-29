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

export function assertFamilyRequestReferences(
  pattern: Extract<JsonGamePattern, { kind: 'family-request' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  counters: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const deck = components.find(
    (item) => item.component === 'cards.deck' && item.id === pattern.deckId,
  );
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === pattern.handId,
  );
  const sets = components.find(
    (item) => item.component === 'cards.sets' && item.id === pattern.setsId,
  );
  if (deck?.component !== 'cards.deck') fail(`${root}.deckId`, 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
  if (
    sets?.component !== 'cards.sets' ||
    sets.deck !== pattern.deckId ||
    sets.hand !== pattern.handId
  )
    fail(`${root}.setsId`, 'unknown card sets or mismatched source');
  if (!counters.has(pattern.pollutionCounter))
    fail(`${root}.pollutionCounter`, 'unknown counter');
  assertUnique(
    pattern.cards.map((card) => card.id),
    `${root}.cards`,
    'id',
    fail,
  );
  for (const type of ['family', 'quiz', 'nature'] as const)
    if (!pattern.cards.some((card) => card.type === type))
      fail(`${root}.cards`, `missing ${type} card`);
  for (const [index, card] of pattern.cards.entries())
    if (card.type === 'quiz' && card.answerIndex >= card.choices.length)
      fail(
        `${root}.cards[${index}].answerIndex`,
        'quiz answer outside choices',
      );
  const familyIds = new Set(
    pattern.cards
      .filter((card) => card.type === 'family')
      .map((card) => card.id),
  );
  if (
    sets?.component === 'cards.sets' &&
    Object.values(sets.sets)
      .flat()
      .some((cardId) => !familyIds.has(cardId))
  )
    fail(`${root}.setsId`, 'set contains a non-family card');
}

export function assertFamilyEffectsReferences(
  pattern: Extract<JsonGamePattern, { kind: 'family-effects' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const deck = components.find(
    (item) => item.component === 'cards.deck' && item.id === pattern.deckId,
  );
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === pattern.handId,
  );
  const sets = components.find(
    (item) => item.component === 'cards.sets' && item.id === pattern.setsId,
  );
  if (deck?.component !== 'cards.deck') fail(`${root}.deckId`, 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
  if (
    sets?.component !== 'cards.sets' ||
    sets.deck !== pattern.deckId ||
    sets.hand !== pattern.handId
  )
    fail(`${root}.setsId`, 'unknown card sets or mismatched source');
  if (!resources.has(pattern.extraDrawResource))
    fail(`${root}.extraDrawResource`, 'unknown extra draw resource');
  assertUnique(
    pattern.cards.map((card) => card.id),
    `${root}.cards`,
    'id',
    fail,
  );
  assertUnique(pattern.familyIds, `${root}.familyIds`, null, fail);
  const ids = new Set(pattern.cards.map((card) => card.id));
  for (const [index, card] of pattern.cards.entries()) {
    if (card.type === 'metier' && !card.family)
      fail(`${root}.cards[${index}].family`, 'profession without family');
    if (card.type === 'special' && card.family)
      fail(`${root}.cards[${index}].family`, 'special card with family');
    if (card.family && !pattern.familyIds.includes(card.family))
      fail(`${root}.cards[${index}].family`, 'unknown card family');
  }
  if (
    sets?.component === 'cards.sets' &&
    (Object.keys(sets.sets).some(
      (family) => !pattern.familyIds.includes(family),
    ) ||
      Object.values(sets.sets)
        .flat()
        .some((cardId) => !ids.has(cardId)))
  )
    fail(`${root}.setsId`, 'invalid family set');
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
