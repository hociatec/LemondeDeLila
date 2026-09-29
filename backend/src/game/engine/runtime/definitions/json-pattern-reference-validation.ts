import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
import { authoringProperty } from '../contracts/authoring-diagnostics';

type Failure = (path: string, reason: string) => never;

export function assertJsonPatternReferences(
  patterns: readonly JsonGamePattern[] | undefined,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: Failure,
): void {
  for (const [index, pattern] of (patterns ?? []).entries()) {
    if (pattern.kind === 'race' && pattern.delivery)
      assertDeliveryReferences(pattern.delivery, index, components, fail);
    if (pattern.kind === 'ordered-card-collection')
      assertOrderedCollectionReferences(
        pattern,
        index,
        components,
        resources,
        fail,
      );
  }
}

function assertOrderedCollectionReferences(
  pattern: Extract<JsonGamePattern, { kind: 'ordered-card-collection' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  requireDeck(pattern.deckId, `${root}.deckId`, components, fail);
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' && component.id === pattern.handId,
  );
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
  assertUnique(
    pattern.cards.map((card) => card.id),
    `${root}.cards`,
    'id',
    fail,
  );
  assertUnique(
    pattern.cards.map((card) => card.value),
    `${root}.cards`,
    'value',
    fail,
  );
  assertUnique(pattern.sequence, `${root}.sequence`, null, fail);
  const values = new Set(pattern.cards.map((card) => card.value));
  for (const [index, value] of pattern.sequence.entries())
    if (!values.has(value))
      fail(`${root}.sequence[${index}]`, 'unknown card value');
  if (pattern.sequence.length !== values.size)
    fail(`${root}.sequence`, 'sequence must contain every card value');
  for (const [value, reward] of Object.entries(pattern.rewards)) {
    if (!values.has(value))
      fail(authoringProperty(`${root}.rewards`, value), 'unknown card value');
    for (const resource of Object.keys(reward))
      if (!resources.has(resource))
        fail(
          authoringProperty(`${root}.rewards`, resource),
          'unknown reward resource',
        );
  }
  for (const resource of Object.keys(pattern.resourceValues))
    if (!resources.has(resource))
      fail(
        authoringProperty(`${root}.resourceValues`, resource),
        'unknown scored resource',
      );
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

function assertDeliveryReferences(
  delivery: NonNullable<Extract<JsonGamePattern, { kind: 'race' }>['delivery']>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}].delivery`;
  const clientDeck = requireDeck(
    delivery.clientDeckId,
    `${root}.clientDeckId`,
    components,
    fail,
  );
  const eventDeck = requireDeck(
    delivery.eventDeckId,
    `${root}.eventDeckId`,
    components,
    fail,
  );
  assertNumericCardAttribute(
    clientDeck.cards,
    delivery.destinationAttribute,
    `${root}.destinationAttribute`,
    fail,
  );
  assertNumericCardAttribute(
    eventDeck.cards,
    delivery.blockedPositionAttribute,
    `${root}.blockedPositionAttribute`,
    fail,
  );
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' &&
      component.id === delivery.clientHandId,
  );
  if (
    hand?.component !== 'cards.hands' ||
    hand.deck !== delivery.clientDeckId ||
    hand.initial !== 0
  )
    fail(
      `${root}.clientHandId`,
      'client hand must use the client deck and start empty',
    );
}

function requireDeck(
  id: string,
  path: string,
  components: readonly GameComponentDefinition[],
  fail: Failure,
) {
  const deck = components.find(
    (component) => component.component === 'cards.deck' && component.id === id,
  );
  if (deck?.component !== 'cards.deck') fail(path, 'unknown card deck');
  return deck;
}

function assertNumericCardAttribute(
  cards: readonly unknown[],
  attribute: string,
  path: string,
  fail: Failure,
): void {
  for (const [index, card] of cards.entries()) {
    if (card == null || typeof card !== 'object')
      fail(path, `card ${index} must be an object`);
    const attributes = Reflect.get(card, 'attributes');
    if (
      attributes == null ||
      typeof attributes !== 'object' ||
      typeof Reflect.get(attributes, attribute) !== 'number'
    )
      fail(
        authoringProperty(path, attribute),
        `numeric card attribute required on card ${index}`,
      );
  }
}
